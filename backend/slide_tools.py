"""Web 层工具：把 ai-slide-producer skill 原本靠 shell 脚本承担的"执行/调 API"
职责上移到 LangGraph 后端（本身就是 Python 进程），做成 deepagents 工具。

这样 agent 不需要 shell（绕开 FilesystemBackend 不支持 execute 的问题），
密钥也只留在后端、不暴露给模型。

四个工具：
- choose_template / choose_render_mode → 两个 human-in-the-loop 交互点（配 interrupt_on）
- build_slides_html → 包装 skill 的 build_html.py，进程内生成可打开的 index.html
- generate_image → 出图 API 职责的 web 层落点（本轮默认 HTML，未配 key 时显式返回不可用）
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from langchain_core.tools import tool

from setup_workspace import WORKSPACE, RUNS, SKILL_DST as SKILL_ROOT

# 渲染唯一路径 = ai_render（模型直接写 HTML）；模板渲染器 build_html 已从 skill 移除。
sys.path.insert(0, str(SKILL_ROOT / "scripts"))

VALID_PRESETS = [
    "teaching-clean",
    "editorial-magazine",
    "swiss-system",
    "blueprint",
    "sketch-notes",
    "corporate",
    "creator-social",
]


@tool
def choose_template(recommended: list[str], note: str = "") -> str:
    """交互点①：请用户从 7 套视觉模板（style preset）中选 1 套。

    在「选模板」决策点调用（生成 design spec / style_lock 之前）。
    `recommended`：你推荐的 2-3 个 preset id（取自：teaching-clean, editorial-magazine,
    swiss-system, blueprint, sketch-notes, corporate, creator-social）。
    `note`：给用户的一句话说明，解释为何这样推荐。
    返回用户选定的 preset id。用户不选时默认 'teaching-clean'。
    """
    # 该函数体仅在用户选择 approve（接受默认）时执行；
    # 选 respond 时由用户的回答直接作为结果回灌。
    return "teaching-clean"


@tool
def confirm_outline(outline_md: str, note: str = "") -> str:
    """交互点：把生成的大纲交给用户确认 / 修改（大纲门禁）。

    在写好 runs/<project>/source/outline.md 之后、进入 slide_plan 之前调用。
    `outline_md`：大纲全文（供 UI 以"左树/右预览"呈现）。
    `note`：给用户的一句话（如"4 章 12 页，约 10 分钟"）。
    返回用户的确认("OK")或修改意见；用户不改时默认放行。
    """
    return "OK"


@tool
def choose_render_mode(note: str = "") -> str:
    """交互点②：请用户选择输出形态——HTML 幻灯片 还是 生成图片。

    在「出图 / HTML」决策点调用。`note`：给用户的一句话说明（含耗时/前置提示）。
    返回 'html' 或 'image'。用户不选时默认 'html'。
    """
    return "html"


def _resolve_project_dir(project: str) -> Path | None:
    project_dir = (RUNS / project).resolve()
    runs_root = RUNS.resolve()
    if project_dir != runs_root and runs_root not in project_dir.parents:
        return None
    return project_dir


@tool
def build_slides_html(project: str, minimal: bool = False) -> str:
    """生成可直接打开的自包含 index.html 幻灯片（模型按 style_lock 直接写 HTML）。

    读取 runs/<project>/source/slide_plan.json 与 style_lock.json（你必须先写好这两份），
    由 ai_render 让模型按 08-web-renderer 契约直接写出 runs/<project>/index.html。
    `project`：runs/ 下的工程目录名（slug）。返回生成的 HTML 绝对路径。
    """
    project_dir = _resolve_project_dir(project)
    if project_dir is None:
        return f"error: project 必须位于 runs/ 之下，收到 {project!r}"
    src = project_dir / "source"
    if not (src / "slide_plan.json").exists():
        return f"error: 缺少 {src}/slide_plan.json —— 请先用 write_file 写好。"
    if not (src / "style_lock.json").exists():
        return f"error: 缺少 {src}/style_lock.json —— 请先用 write_file 写好。"
    out = project_dir / "index.html"
    try:
        import ai_render
        html, note = ai_render.render_deck_html(project_dir)
    except Exception as exc:  # noqa: BLE001
        return f"error: AI 渲染异常：{type(exc).__name__}: {exc}"
    if not html:
        return f"error: AI 渲染失败：{note}（请重试或检查 slide_plan/style_lock）"
    out.write_text(html, encoding="utf-8")
    return (
        f"已生成幻灯片：{out}（{note}）\n"
        f"在浏览器打开：file://{out}\n"
        f"（这是可见产物，请把该路径交给用户。）"
    )


def _resolve_image_out(out_path: str) -> Path:
    """把 out_path 安全落到 runs/ 之下（防穿越）。"""
    p = Path(out_path)
    if p.is_absolute():
        cand = p.resolve()
    elif str(p).startswith("runs/"):
        cand = (WORKSPACE / p).resolve()
    else:
        cand = (RUNS / p).resolve()
    runs_root = RUNS.resolve()
    if runs_root != cand and runs_root not in cand.parents:
        raise ValueError("out_path 必须位于 runs/ 之下")
    return cand


def _img_via_openai_sdk(prompt, dest, api_key, model, base_url, size, response_format=None):
    """OpenAI 兼容 images.generate —— OpenAI 官方（gpt-image-2）与火山方舟 ARK 上的
    即梦 Seedream 共用同一条路径（只差 base_url / model / 尺寸 / response_format）。"""
    import base64
    from openai import OpenAI
    client = OpenAI(base_url=(base_url or None), api_key=api_key)
    kw = {"model": model, "prompt": prompt, "size": size, "n": 1}
    if response_format:                       # gpt-image-2 不收此参；ARK/Seedream 收
        kw["response_format"] = response_format
    r = client.images.generate(**kw)
    d0 = r.data[0]
    b64 = getattr(d0, "b64_json", None)
    if b64:
        data = base64.b64decode(b64)
    else:                                     # 回退：响应给的是 url
        url = getattr(d0, "url", None)
        if not url:
            raise RuntimeError("图片响应既无 b64_json 也无 url")
        import httpx
        data = httpx.get(url, timeout=60).content
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)


def _img_via_gemini(prompt, dest, api_key, model, base_url):
    """Gemini Nano Banana：REST :generateContent，图片在 inline_data.data（base64）。"""
    import base64
    import httpx
    base = base_url or "https://generativelanguage.googleapis.com/v1"
    url = f"{base}/models/{model}:generateContent"
    body = {"contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"responseModalities": ["TEXT", "IMAGE"]}}
    r = httpx.post(url, headers={"x-goog-api-key": api_key,
                                 "Content-Type": "application/json"},
                   json=body, timeout=120)
    r.raise_for_status()
    parts = (r.json().get("candidates") or [{}])[0].get("content", {}).get("parts", []) or []
    for p in parts:
        inl = p.get("inline_data") or p.get("inlineData")
        if inl and inl.get("data"):
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(base64.b64decode(inl["data"]))
            return
    raise RuntimeError("Gemini 响应无 inline image data")


@tool
def generate_image(prompt: str, out_path: str) -> str:
    """web 层出图能力。按 providers 配置选后端：mock（品牌占位图，无需 key）/
    openai（真实出图）/ 未配置则回退 HTML。

    `prompt`：完整出图 prompt；`out_path`：保存路径（如 runs/<project>/images/slide-01.png）。
    返回状态字符串。未配置或失败时返回 'image-backend-unavailable'，
    此时应回退到 HTML 渲染路径（build_slides_html）。
    """
    import providers as P
    import mock_image

    try:
        dest = _resolve_image_out(out_path)
    except ValueError as e:
        return f"image-error：{e}"

    cfg = P.resolve_local()
    img = (cfg or {}).get("image") or {}
    provider = (img.get("provider") or "none").lower()
    key = img.get("api_key", "")
    model = img.get("model", "")
    base_url = img.get("base_url", "")
    d = P.IMAGE_DEFAULTS.get(provider, {})

    if provider == "mock":
        ok = mock_image.render_placeholder(
            prompt, dest, page_label=dest.stem.replace("slide-", "P"))
        if ok:
            return f"image-rendered (mock 占位图)：{dest}"
        return ("image-backend-unavailable：mock 需 Pillow（pip install Pillow）。"
                "请回退到 HTML 路径（build_slides_html）。")

    if provider in ("none", ""):
        return ("image-backend-unavailable：web 后端未配置图片 provider。"
                "请回退到 HTML 路径（build_slides_html）产出可见 deck。")

    if not key:
        return ("image-backend-unavailable：已选 provider 但未配 key。"
                "请回退到 HTML 路径（build_slides_html）。")

    try:
        if provider in ("openai", "jimeng"):
            _img_via_openai_sdk(
                prompt, dest, key, model or d.get("model"),
                base_url or d.get("base_url"), d.get("size", "1024x1024"),
                response_format=("b64_json" if provider == "jimeng" else None))
            return f"image-rendered ({provider})：{dest}"
        if provider == "gemini":
            _img_via_gemini(prompt, dest, key,
                            model or d.get("model"), base_url or d.get("base_url"))
            return f"image-rendered (gemini)：{dest}"
        return (f"image-backend-unavailable：未知 provider {provider}。"
                "请回退到 HTML 路径（build_slides_html）。")
    except Exception as e:  # noqa: BLE001
        return (f"image-backend-error：{type(e).__name__}: {e}"[:200] +
                "。请回退到 HTML 路径（build_slides_html）。")


SLIDE_TOOLS = [confirm_outline, choose_template, choose_render_mode, build_slides_html, generate_image]
