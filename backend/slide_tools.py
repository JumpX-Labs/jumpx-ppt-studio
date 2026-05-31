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

# build_html 是纯 stdlib 脚本，直接 import 进程内调用（不 shell out）。
sys.path.insert(0, str(SKILL_ROOT / "scripts"))
import build_html  # noqa: E402

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
    """生成可直接打开的自包含 index.html 幻灯片。

    读取 runs/<project>/source/slide_plan.json 与 style_lock.json（你必须先写好这两份），
    结合 skill 的模板与 CSS，输出 runs/<project>/index.html。
    `project`：runs/ 下的工程目录名（slug）。`minimal`：是否用极简模板。
    返回生成的 HTML 绝对路径。本工具替代 skill 的 build_html.py 脚本——不要 shell out。
    """
    project_dir = _resolve_project_dir(project)
    if project_dir is None:
        return f"error: project 必须位于 runs/ 之下，收到 {project!r}"
    src = project_dir / "source"
    if not (src / "slide_plan.json").exists():
        return f"error: 缺少 {src}/slide_plan.json —— 请先用 write_file 写好。"
    if not (src / "style_lock.json").exists():
        return f"error: 缺少 {src}/style_lock.json —— 请先用 write_file 写好。"
    try:
        out = build_html.build(project_dir, SKILL_ROOT, minimal=minimal)
    except SystemExit as exc:  # build_html 用 SystemExit 报缺文件
        return f"error: build 失败：{exc}"
    except Exception as exc:  # noqa: BLE001
        return f"error: build 异常：{type(exc).__name__}: {exc}"
    return (
        f"已生成幻灯片：{out}\n"
        f"在浏览器打开：file://{out}\n"
        f"（这是可见产物，请把该路径交给用户。）"
    )


@tool
def generate_image(prompt: str, out_path: str) -> str:
    """交给 web 层后端的图片生成能力（替代 skill 的 generate_images.py）。

    图片 API 调用职责现在在 web 后端，不再是 skill 的 shell 脚本。
    `prompt`：完整出图 prompt；`out_path`：保存路径（如 runs/<project>/images/slide-01.png）。
    返回状态。若后端未配置图片 key，返回 'image-backend-unavailable'，
    此时应回退到 HTML 渲染路径（build_slides_html）。
    """
    has_key = any(
        os.environ.get(k)
        for k in ("OPENAI_API_KEY", "GEMINI_API_KEY", "NANOBANANA_API_KEY")
    )
    if not has_key:
        return (
            "image-backend-unavailable：web 后端未配置图片 API key。"
            "请回退到 HTML 路径（build_slides_html）产出可见 deck。"
        )
    return (
        "image-backend-configured：但本轮脚手架未接入真实出图调用。"
        "请使用 build_slides_html（HTML 路径）产出可见 deck。"
    )


SLIDE_TOOLS = [choose_template, choose_render_mode, build_slides_html, generate_image]
