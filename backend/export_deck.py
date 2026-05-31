"""Deck 导出（Phase 4b-1）：PDF + 逐页 PNG。

唯一渲染原语 = Playwright + Chromium（单机装一次）。我们的产物已是自包含
`index.html`（横向 flex deck，每页 .slide 为 100vw×100vh），所以：
- PDF：注入打印 CSS（deck 改 block、每页 1280×720 + break-after），page.pdf() 矢量输出。
- PNG：视口 1280×720@2x，逐页 transform 定位后整屏截图，打包 zip。

保真优先：直接渲染真实 HTML，CSS 主题 100% 保留。不依赖 LibreOffice。
"""

from __future__ import annotations

import zipfile
from pathlib import Path

from playwright.async_api import async_playwright

import runs as RUN

# 16:9 导出基准（与 deck 的 100vw×100vh 对齐）
W, H = 1280, 720

# 打印态：把横向 flex deck 摊平成「每页一张、1280×720、分页」
_PRINT_CSS = f"""
@page {{ size: {W}px {H}px; margin: 0; }}
html, body {{ margin: 0 !important; padding: 0 !important; background: #fff !important;
  width: auto !important; height: auto !important; overflow: visible !important; }}
.deck {{ position: static !important; display: block !important;
  width: auto !important; height: auto !important; transform: none !important; }}
.slide {{ width: {W}px !important; height: {H}px !important;
  break-after: page; page-break-after: always; overflow: hidden; }}
.slide:last-child {{ break-after: auto; page-break-after: auto; }}
.slide-controls, .slide-index, [data-action], .notes {{ display: none !important; }}
"""

# 截图态：去过渡/去控件，逐页干净截屏
_SHOT_CSS = ".deck{transition:none !important}.slide-controls,.slide-index,[data-action]{display:none !important}"


def _export_dir(rid: str) -> Path | None:
    """run 的 export/ 目录（复用 runs 的安全校验）。"""
    html = RUN.index_html_path(rid)
    if html is None:
        return None
    d = html.parent / "export"
    d.mkdir(parents=True, exist_ok=True)
    return d


async def export_pdf(rid: str) -> Path | None:
    """渲染整本 deck 为矢量 PDF（每页一张幻灯片）。返回文件路径。"""
    html = RUN.index_html_path(rid)
    out_dir = _export_dir(rid)
    if html is None or out_dir is None:
        return None
    out = out_dir / f"{rid}.pdf"
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": W, "height": H})
        await page.goto(html.resolve().as_uri(), wait_until="networkidle")
        await page.add_style_tag(content=_PRINT_CSS)
        await page.emulate_media(media="print")
        await page.pdf(path=str(out), width=f"{W}px", height=f"{H}px",
                       print_background=True,
                       margin={"top": "0", "bottom": "0", "left": "0", "right": "0"})
        await browser.close()
    return out


async def export_png_zip(rid: str) -> Path | None:
    """逐页截图（2x 清晰），打包成 zip。返回 zip 路径。"""
    html = RUN.index_html_path(rid)
    out_dir = _export_dir(rid)
    if html is None or out_dir is None:
        return None
    pngs: list[tuple[str, bytes]] = []
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": W, "height": H},
                                      device_scale_factor=2)
        await page.goto(html.resolve().as_uri(), wait_until="networkidle")
        await page.add_style_tag(content=_SHOT_CSS)
        n = await page.eval_on_selector_all(".slide", "els => els.length")
        for i in range(max(1, n)):
            await page.evaluate(
                "(i) => { const d = document.getElementById('deck');"
                " if (d) d.style.transform = 'translateX(' + (-i * 100) + 'vw)'; }", i)
            await page.wait_for_timeout(140)
            shot = await page.screenshot(type="png")
            pngs.append((f"slide-{i + 1:02d}.png", shot))
        await browser.close()
    out = out_dir / f"{rid}-png.zip"
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, data in pngs:
            zf.writestr(name, data)
    return out
