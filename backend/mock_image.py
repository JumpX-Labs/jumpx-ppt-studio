"""Mock 图片后端 —— 无 key、确定性，生成品牌占位 PNG。

目的：让 image-first 整条路（generate_image → 落盘 → 渲染嵌图）在**没有真实出图 key**
时也能端到端跑通 / 演示。真 provider（OpenAI/Gemini/…）是它的同接口兄弟：providers 切换即插即用。

依赖 Pillow（可选）。没装时 available() 返回 False，调用方回退到渲染器自带的
"Image pending" 占位框（deck 仍可见）。
"""

from __future__ import annotations

import textwrap
from pathlib import Path

# JumpX 品牌（editorial dev-tool · 暖白纸张）
PAPER = (243, 242, 236)      # #F3F2EC
INK = (26, 25, 23)           # #1A1917
INK2 = (86, 83, 76)          # #56534C
INK3 = (139, 135, 125)       # #8B877D
LINE = (218, 214, 203)       # #DAD6CB
GREEN = (18, 138, 69)        # #128A45 深绿（浅底可读）


def available() -> bool:
    try:
        import PIL  # noqa: F401
        return True
    except Exception:  # noqa: BLE001
        return False


def _font(size: int, bold: bool = False):
    from PIL import ImageFont
    # 优先系统字体；失败回退 PIL 默认位图字体（仍可出图，只是字形朴素）。
    candidates = (
        ["/System/Library/Fonts/Supplemental/Arial Bold.ttf",
         "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]
        if bold else
        ["/System/Library/Fonts/Supplemental/Arial.ttf",
         "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]
    )
    for c in candidates:
        try:
            return ImageFont.truetype(c, size)
        except Exception:  # noqa: BLE001
            continue
    return ImageFont.load_default()


def render_placeholder(prompt: str, out_path, page_label: str = "",
                       width: int = 1280, height: int = 720) -> bool:
    """画一张品牌占位卡：JX 标 + MOCK 标识 + 页码 + 截断的 prompt。写 PNG。
    成功 True；Pillow 不在或出错 False（让调用方走渲染器占位）。"""
    if not available():
        return False
    try:
        from PIL import Image, ImageDraw

        out = Path(out_path)
        out.parent.mkdir(parents=True, exist_ok=True)

        img = Image.new("RGB", (width, height), PAPER)
        d = ImageDraw.Draw(img)

        pad = 64
        # 外框发丝线
        d.rectangle([pad, pad, width - pad, height - pad], outline=LINE, width=2)

        # JX 标（近黑圆角块 + 白字）
        m = 44
        mx, my = pad + 28, pad + 28
        d.rounded_rectangle([mx, my, mx + m, my + m], radius=10, fill=(17, 17, 17))
        jf = _font(24, bold=True)
        _centered_text(d, (mx + m / 2, my + m / 2), "JX", jf, (255, 255, 255))

        # eyebrow
        ef = _font(20, bold=True)
        d.text((mx + m + 18, my + 4), "JUMPX PPT STUDIO", font=ef, fill=INK2)
        d.text((mx + m + 18, my + 26), "MOCK 占位图 · 未配置出图 API", font=_font(16), fill=GREEN)

        # 页码（大数字锚）
        if page_label:
            d.text((pad + 28, pad + 120), page_label, font=_font(72, bold=True), fill=INK)

        # prompt 正文（包裹 + 截断）
        body = (prompt or "").strip().replace("\n", " ")
        wrapped = textwrap.wrap(body, width=42)[:8]
        bf = _font(24)
        y = pad + 230
        d.text((pad + 28, y - 36), "PROMPT", font=_font(15, bold=True), fill=INK3)
        for line in wrapped:
            d.text((pad + 28, y), line, font=bf, fill=INK2)
            y += 36
        if len(textwrap.wrap(body, width=42)) > 8:
            d.text((pad + 28, y), "…", font=bf, fill=INK3)

        # footer
        d.text((pad + 28, height - pad - 40),
               "mock image backend · 配置真实 provider 后即换真图",
               font=_font(16), fill=INK3)

        img.save(out, "PNG")
        return True
    except Exception:  # noqa: BLE001
        return False


def _centered_text(d, center, text, font, fill):
    cx, cy = center
    try:
        l, t, r, b = d.textbbox((0, 0), text, font=font)
        w, h = r - l, b - t
        d.text((cx - w / 2 - l, cy - h / 2 - t), text, font=font, fill=fill)
    except Exception:  # noqa: BLE001
        d.text((cx, cy), text, font=font, fill=fill)
