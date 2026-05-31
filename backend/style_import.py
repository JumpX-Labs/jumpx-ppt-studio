"""风格提取 skill（视觉模型）—— 看图 → 风格 JSON → 产出新风格接进配方。

见 style_extractor/SKILL.md。先只做图片，不做 PPTX。
"""

from __future__ import annotations

import base64
import json
import os
import re
from pathlib import Path

from dotenv import load_dotenv

import recipes as R

load_dotenv()

SKILL_DIR = Path(__file__).resolve().parent / "style_extractor"
PROMPT = (SKILL_DIR / "PROMPT.md").read_text(encoding="utf-8")

# font_feel → 气质最接近的内置 CSS 骨架
SKELETON = {"sans": "teaching-clean", "serif": "editorial-magazine", "handwriting": "sketch-notes"}

_HEX = re.compile(r"^#[0-9a-fA-F]{6}$")


def _client():
    from openai import OpenAI
    return OpenAI(base_url=os.environ["ARK_BASE_URL"], api_key=os.environ["ARK_API_KEY"])


def analyze_image(image_bytes: bytes, mime: str = "image/png") -> dict:
    """调视觉模型，返回风格 dict。失败抛异常。"""
    model = os.environ.get("ARK_VISION_MODEL", "Doubao-Seed-2.0-lite")
    b64 = base64.b64encode(image_bytes).decode()
    resp = _client().chat.completions.create(
        model=model, max_tokens=600,
        messages=[{"role": "user", "content": [
            {"type": "text", "text": PROMPT},
            {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}},
        ]}],
    )
    out = resp.choices[0].message.content or ""
    m = re.search(r"\{.*\}", out, re.S)
    if not m:
        raise ValueError(f"模型未返回 JSON：{out[:200]}")
    return json.loads(m.group(0))


def _slug(label: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (label or "").lower()).strip("-")
    return s or "ref"


def _safe_hex(v, fallback: str) -> str:
    v = (v or "").strip()
    if len(v) == 4 and v.startswith("#"):  # #abc → #aabbcc
        v = "#" + "".join(c * 2 for c in v[1:])
    return v if _HEX.match(v) else fallback


def emit_style(rid: str, style: dict, label: str) -> dict:
    """把风格 dict 落成 preset+css 进配方拷贝，放开 schema 枚举。返回 {style_name, ...}。"""
    rdir = R.recipe_dir(rid)
    if not (rdir / "SKILL.md").exists():
        raise ValueError(f"配方不存在：{rid}")

    feel = (style.get("font_feel") or "sans").lower()
    skeleton = SKELETON.get(feel, "teaching-clean")
    # 唯一 style_name（中文标签 slug 会变 ref，避免撞名覆盖）
    pdir = rdir / "assets" / "style-presets"
    base = f"imported-{_slug(label)}"
    style_name = base
    n = 2
    while (pdir / f"{style_name}.json").exists():
        style_name = f"{base}-{n}"
        n += 1

    # 颜色（带兜底）
    bg = _safe_hex(style.get("background_color"), "#FFFFFF")
    ink = _safe_hex(style.get("primary_color"), "#111827")
    accent = _safe_hex(style.get("accent_color"), "#2563EB")
    muted = _safe_hex(style.get("text_secondary_color"), "#64748B")
    line = _safe_hex(style.get("border_color"), "#D7DEE8")
    font_map = {
        "sans": 'Inter, "Noto Sans SC", sans-serif',
        "serif": 'Georgia, "Noto Serif SC", serif',
        "handwriting": '"Patrick Hand", "Noto Sans SC", cursive',
    }
    font = font_map.get(feel, font_map["sans"])
    density = style.get("density") if style.get("density") in (
        "high", "medium-high", "medium", "medium-low", "low") else "medium"

    # 1) preset.json
    preset = {
        "style_name": style_name,
        "display_name": label or style_name,
        "texture": style.get("texture", ""),
        "mood": style.get("mood", ""),
        "typography": f"{feel} 字体气质",
        "density": density,
        "color_palette": {
            "primary_color": ink, "accent_color": accent, "background_color": bg,
            "text_primary_color": ink, "text_secondary_color": muted, "border_color": line,
        },
        "font_heading": font, "font_body": font,
        "layout_bias": style.get("layout_bias", "grid"),
        "image_style_description": f"参考图导入风格：{style.get('mood','')}，{style.get('texture','')}",
        "negative_constraints": ["no crowded text blocks", "no unreadable small labels"],
        "_imported_from_skeleton": skeleton,
    }
    (rdir / "assets" / "style-presets" / f"{style_name}.json").write_text(
        json.dumps(preset, ensure_ascii=False, indent=2), encoding="utf-8")

    # 2) css：复制骨架，替换 :root 的 7 个 --asp-*
    css = (rdir / "assets" / "styles" / f"{skeleton}.css").read_text(encoding="utf-8")
    repl = {"--asp-bg": bg, "--asp-ink": ink, "--asp-accent": accent,
            "--asp-muted": muted, "--asp-line": line,
            "--asp-font-heading": font, "--asp-font-body": font}
    for var, val in repl.items():
        css = re.sub(rf"({re.escape(var)}\s*:)[^;]*;", lambda mm, v=val: f"{mm.group(1)} {v};", css, count=1)
    (rdir / "assets" / "styles" / f"{style_name}.css").write_text(css, encoding="utf-8")

    # 3) 放开该配方 schema 的 style_name 枚举 → pattern（幂等）
    _relax_style_enum(rdir)

    return {"style_name": style_name, "preset": preset, "skeleton": skeleton}


def _relax_style_enum(rdir: Path) -> None:
    sp = rdir / "schemas" / "style_lock.schema.json"
    if not sp.exists():
        return
    schema = json.loads(sp.read_text(encoding="utf-8"))
    node = schema.get("properties", {}).get("style_name", {})
    if "enum" in node:
        node.pop("enum", None)
        node["type"] = "string"
        node["pattern"] = "^[a-z0-9-]+$"
        sp.write_text(json.dumps(schema, ensure_ascii=False, indent=2), encoding="utf-8")


def list_styles(rid: str) -> list[dict]:
    """配方里可用的风格（内置 + 导入）。"""
    d = R.recipe_dir(rid) / "assets" / "style-presets"
    out = []
    if d.is_dir():
        for f in sorted(d.glob("*.json")):
            try:
                p = json.loads(f.read_text(encoding="utf-8"))
                out.append({"style_name": p.get("style_name", f.stem),
                            "display_name": p.get("display_name", f.stem),
                            "imported": f.stem.startswith("imported-"),
                            "mood": p.get("mood", "")})
            except Exception:  # noqa: BLE001
                pass
    return out


def import_from_image(rid: str, image_bytes: bytes, label: str, mime: str = "image/png") -> dict:
    style = analyze_image(image_bytes, mime)
    result = emit_style(rid, style, label)
    result["analyzed"] = style
    return result
