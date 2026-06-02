"""预烤「选模板」缩略图：用每套 style preset 的真实设计 token 跑一次 ai_render，
截图存成缩略图。选模板时前端直接显示这些 PNG —— 零等待、零运行时 LLM、可一键重生。

为什么是"真实渲染"而不是手写样例：缩略图必须等于模型按该 preset 实际写出来的样子，
否则就又回到"假版式"。preset / skill 一变，重跑本脚本即可。

用法：
  cd backend && JX_SKILL_SRC=<forge skill 路径> .venv/bin/python build_preset_previews.py
  可选：只烤某几套   ... build_preset_previews.py teaching-clean blueprint
"""

from __future__ import annotations

import asyncio
import io
import json
import sys
from pathlib import Path

from PIL import Image

import ai_render
import export_deck
from setup_workspace import RUNS, SKILL_DST

PRESET_DIR = SKILL_DST / "assets" / "style-presets"
OUT_DIR = Path(__file__).parent / "preset_previews"
THUMB_W = 720  # 缩略图宽度（16:9）

# 固定的 2 页样例：封面 + 内容页，足以体现风格的版面气质。
SAMPLE_PAGES = [
    {
        "page_title": "把复杂的事讲清楚",
        "page_role_in_story": "cover",
        "key_message": "一套示例幻灯，用来展示这个风格的版面气质",
        "on_slide_text": {"body": ["示例 · Sample Deck"]},
        "visual_direction": "封面要有气场：大标题 + kicker 小标 + 一个克制的视觉点缀，体现该风格基调",
        "layout_type": "cover",
    },
    {
        "page_title": "三个关键点",
        "page_role_in_story": "core",
        "key_message": "结构清楚，比花哨更重要",
        "on_slide_text": {"body": [
            "先讲为什么——动机决定注意力",
            "再讲是什么——给一个可记忆的结构",
            "最后讲怎么做——落到一个具体动作",
        ]},
        "visual_direction": "用卡片 / 左右对比 / 编号列表体现该风格的排版特征，可加简单示意图",
        "layout_type": "list",
    },
]


def _lock_from_preset(preset: dict) -> dict:
    cp = preset.get("color_palette") or {}
    lock = dict(preset)
    lock["colors"] = {
        "background": cp.get("background_color", "#ffffff"),
        "text": cp.get("text_primary_color", "#111827"),
        "text_secondary": cp.get("text_secondary_color", "#64748B"),
        "primary": cp.get("primary_color", "#111827"),
        "accent": cp.get("accent_color", "#2563EB"),
        "border": cp.get("border_color", "#D7DEE8"),
    }
    lock["font"] = preset.get("font_heading")
    return lock


async def _shoot(html: str) -> list[bytes]:
    run = RUNS / "_preset_preview_tmp"
    (run).mkdir(parents=True, exist_ok=True)
    (run / "index.html").write_text(html, encoding="utf-8")
    return await export_deck._render_slide_pngs(run / "index.html")


def build_one(pid: str) -> str:
    pj = PRESET_DIR / f"{pid}.json"
    if not pj.exists():
        return f"skip {pid}: 无 preset json"
    preset = json.loads(pj.read_text(encoding="utf-8"))
    lock = _lock_from_preset(preset)

    run = RUNS / f"_preview_{pid}"
    src = run / "source"
    src.mkdir(parents=True, exist_ok=True)
    (src / "slide_plan.json").write_text(
        json.dumps({"pages": SAMPLE_PAGES}, ensure_ascii=False, indent=2), encoding="utf-8")
    (src / "style_lock.json").write_text(
        json.dumps(lock, ensure_ascii=False, indent=2), encoding="utf-8")

    html, note = ai_render.render_deck_html(run)
    if not html:
        return f"FAIL {pid}: {note}"
    (run / "index.html").write_text(html, encoding="utf-8")

    pngs = asyncio.run(_shoot(html))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    saved = 0
    for i, data in enumerate(pngs[:2], 1):
        im = Image.open(io.BytesIO(data)).convert("RGB")
        im.thumbnail((THUMB_W, THUMB_W))
        im.save(OUT_DIR / f"{pid}-{i}.png", optimize=True)
        saved += 1
    return f"OK   {pid}: {note}；存 {saved} 张缩略图"


def main():
    want = sys.argv[1:] or [p.stem for p in sorted(PRESET_DIR.glob("*.json"))]
    if not want:
        print(f"没找到 preset（{PRESET_DIR}）。先 ensure_workspace 或设 JX_SKILL_SRC。")
        return
    print(f"preset 源：{PRESET_DIR}\n输出：{OUT_DIR}\n")
    for pid in want:
        print(build_one(pid), flush=True)


if __name__ == "__main__":
    main()
