"""模型能力（Providers）配置 —— BYO-key，按部署模式决定能否落盘。

设计原则（见 README / _local/CODE_REVIEW）：
  - key 由前端持有（localStorage），按请求带来，后端用完即弃。
  - 是否允许"额外存到本机"由环境变量 `STUDIO_TENANCY` 决定：
      local  （默认/自托管）：可选落盘到 workspace/_settings/providers.json（本机、gitignored、0600）。
      shared （公开多租户）：拒绝服务端持久化；key 仅在请求内存里用一次。

安全铁律：
  - 任何路径都 **不 log / 不回显明文 key**；对外只给 mask()。
  - shared 模式 save() 直接抛 PermissionError（路由层转 403）。
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from setup_workspace import WORKSPACE

TENANCY = (os.environ.get("STUDIO_TENANCY") or "local").strip().lower()
if TENANCY not in ("local", "shared"):
    TENANCY = "local"

SETTINGS_PATH = WORKSPACE / "_settings" / "providers.json"

# 出图 provider：3 个真实模型 + mock（无 key 测试）+ none（仅 HTML）
IMAGE_PROVIDERS = ("none", "mock", "openai", "jimeng", "gemini")

# 每个 image provider 的默认 model / base_url（model 可被用户覆盖）。
# - openai：GPT Image 2（2026 旗舰），OpenAI 官方端点，images.generate → b64
# - jimeng：即梦/Seedream 跑在火山方舟 ARK 上，OpenAI 兼容 /images/generations，Bearer key
# - gemini：Nano Banana 2，REST :generateContent，x-goog-api-key 头
IMAGE_DEFAULTS = {
    "openai": {"model": "gpt-image-2", "base_url": "https://api.openai.com/v1", "size": "1536x1024"},
    "jimeng": {"model": "doubao-seedream-4-0-250828", "base_url": "https://ark.cn-beijing.volces.com/api/v3", "size": "2K"},
    "gemini": {"model": "gemini-3.1-flash-image", "base_url": "https://generativelanguage.googleapis.com/v1", "size": "16:9"},
}


# ---- mask / 读写 -----------------------------------------------------------

def mask(key: str) -> str:
    """只回前 3 + 后 4，绝不回明文。空串回空。"""
    if not key:
        return ""
    k = str(key)
    if len(k) <= 8:
        return "•" * len(k)
    return f"{k[:3]}…{k[-4:]}"


def _load_local() -> dict:
    """读本机 providers.json；任何错误都安全降级为空，不抛。"""
    try:
        if SETTINGS_PATH.exists():
            return json.loads(SETTINGS_PATH.read_text(encoding="utf-8")) or {}
    except Exception:  # noqa: BLE001
        pass
    return {}


def _atomic_write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    old = os.umask(0o077)               # 文件仅本用户可读写
    try:
        tmp.write_text(text, encoding="utf-8")
        try:
            os.chmod(tmp, 0o600)
        except OSError:
            pass
        os.replace(tmp, path)           # 原子替换
    finally:
        os.umask(old)


# ---- 解析（取值优先级）-----------------------------------------------------

def _env_defaults() -> dict:
    text = {}
    if os.environ.get("ARK_API_KEY"):
        text = {
            "provider": "ark",
            "base_url": os.environ.get("ARK_BASE_URL", ""),
            "api_key": os.environ.get("ARK_API_KEY", ""),
            "model": os.environ.get("ARK_MODEL", ""),
        }
    image = {"provider": "none"}
    for env, prov in (("OPENAI_API_KEY", "openai"),
                      ("GEMINI_API_KEY", "gemini"),
                      ("NANOBANANA_API_KEY", "nanobanana")):
        if os.environ.get(env):
            image = {"provider": prov, "api_key": os.environ[env], "model": ""}
            break
    return {"text": text, "image": image}


def _merge(base: dict, over: dict) -> dict:
    out = dict(base)
    for sec in ("text", "image"):
        if over.get(sec):
            merged = dict(base.get(sec) or {})
            for k, v in over[sec].items():
                if v not in (None, ""):
                    merged[k] = v
            out[sec] = merged
    return out


def resolve_local() -> dict:
    """服务端可用的有效配置：本机 providers.json 覆盖环境变量默认。
    供 agent / generate_image（服务端态）使用。不含请求级临时 key。"""
    return _merge(_env_defaults(), _load_local())


def resolve(header_json: str | None = None) -> dict:
    """在 resolve_local 之上叠加请求头 X-Provider-Keys（临时、用完即弃）。
    shared 模式的 ephemeral 路径用它；local 也可用（请求级覆盖本机存储）。"""
    base = resolve_local()
    if header_json:
        try:
            over = json.loads(header_json)
            if isinstance(over, dict):
                base = _merge(base, over)
        except Exception:  # noqa: BLE001
            pass
    return base


# ---- 能力 / 对外状态（永不含明文）-----------------------------------------

def _block_public(b: dict) -> dict:
    b = b or {}
    key = b.get("api_key", "")
    provider = b.get("provider", "none")
    return {
        "provider": provider,
        "model": b.get("model", ""),
        "base_url": b.get("base_url", ""),
        "configured": bool(key) or provider == "mock",
        "masked": mask(key),
    }


def public_state() -> dict:
    cfg = resolve_local()
    t = _block_public(cfg.get("text", {}))
    im = _block_public(cfg.get("image", {}))
    return {
        "tenancy": TENANCY,
        "persist_allowed": TENANCY == "local",
        "capabilities": {
            "html": True,                              # 恒可用
            "text": t["configured"],
            "image": im["configured"] and im["provider"] != "none",
        },
        "text": t,
        "image": im,
    }


# ---- 校验 / 持久化 ---------------------------------------------------------

def validate_payload(payload: dict) -> dict:
    """轻校验 + 归一；不校验 key 是否真有效（那是 test_connection 的事）。"""
    if not isinstance(payload, dict):
        raise ValueError("payload 必须是对象")
    out = {}
    if isinstance(payload.get("text"), dict):
        t = payload["text"]
        out["text"] = {
            "provider": "ark",
            "base_url": str(t.get("base_url", "")).strip(),
            "api_key": str(t.get("api_key", "")).strip(),
            "model": str(t.get("model", "")).strip(),
        }
    if isinstance(payload.get("image"), dict):
        im = payload["image"]
        prov = str(im.get("provider", "none")).strip().lower()
        if prov not in IMAGE_PROVIDERS:
            raise ValueError(f"未知 image provider：{prov}")
        out["image"] = {
            "provider": prov,
            "api_key": str(im.get("api_key", "")).strip(),
            "model": str(im.get("model", "")).strip(),
        }
    return out


def save(payload: dict) -> dict:
    """仅 local 模式允许落盘；shared 抛 PermissionError。"""
    if TENANCY != "local":
        raise PermissionError("shared 模式不在服务端保存 key；请仅用浏览器本地存储。")
    clean = validate_payload(payload)
    _atomic_write(SETTINGS_PATH, json.dumps(clean, ensure_ascii=False, indent=2))
    return public_state()


def list_models(base_url: str, api_key: str, limit: int = 300) -> list:
    """拉取 OpenAI 兼容端点的模型列表（用于文本模型"测试成功后选模型"）。"""
    from openai import OpenAI
    client = OpenAI(base_url=(base_url or None), api_key=api_key)
    ms = client.models.list()
    ids = [getattr(m, "id", None) for m in (getattr(ms, "data", None) or [])]
    return sorted([i for i in ids if i])[:limit]


def test_connection(kind: str, provider: str, api_key: str = "",
                    base_url: str = "", model: str = "") -> dict:
    """廉价鉴权校验，**不存储**。
    text：OpenAI 兼容端点 → models.list，成功时回模型列表供前端下拉。
    image：mock 看 Pillow；openai/jimeng 用 models.list 验 key；gemini GET /models 验 key。"""
    provider = (provider or "").strip().lower()

    # —— 文本模型（OpenAI 兼容）——
    if kind == "text":
        if not api_key:
            return {"ok": False, "detail": "未填 api_key", "models": []}
        try:
            models = list_models(base_url or "", api_key)
            return {"ok": True, "detail": f"鉴权通过 · 取到 {len(models)} 个模型", "models": models}
        except Exception as e:  # noqa: BLE001
            return {"ok": False, "detail": f"校验失败：{type(e).__name__}: {e}"[:240], "models": []}

    # —— 图片 provider ——
    if provider == "mock":
        import mock_image
        ok = mock_image.available()
        return {"ok": ok, "detail": "mock 占位图后端可用（无需 key）" if ok
                else "mock 需要 Pillow：pip install Pillow"}
    if not api_key:
        return {"ok": False, "detail": "未填 api_key"}
    try:
        if provider in ("openai", "jimeng"):
            base = base_url or IMAGE_DEFAULTS[provider]["base_url"]
            list_models(base, api_key, limit=1)        # 廉价鉴权，不出图、不计费
            return {"ok": True, "detail": "鉴权通过（未出图、未计费）"}
        if provider == "gemini":
            import httpx
            base = base_url or IMAGE_DEFAULTS["gemini"]["base_url"]
            r = httpx.get(f"{base}/models", headers={"x-goog-api-key": api_key}, timeout=15)
            if r.status_code == 200:
                return {"ok": True, "detail": "鉴权通过"}
            return {"ok": False, "detail": f"校验失败：HTTP {r.status_code} {r.text[:120]}"}
        return {"ok": False, "detail": f"未知 provider：{provider}"}
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "detail": f"校验失败：{type(e).__name__}: {e}"[:240]}
