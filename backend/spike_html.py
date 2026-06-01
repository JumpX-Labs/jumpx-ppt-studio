"""SPIKE：让强模型直接写整套 HTML slides，对比现有模板引擎。

用法：.venv/bin/python spike_html.py <run_id>
产出：workspace/runs/<run_id>/spike/index.html + 渲染 PNG。
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

from setup_workspace import RUNS

load_dotenv()

SYSTEM = """你是世界顶级的 HTML 演示设计师（想象 Stripe / Linear / Apple Keynote 的水准）。
你要把给定的"逐页内容 + 设计 token"做成一套**单文件自包含 HTML 幻灯片**，要求达到专业设计水准——不是填模板，是真正的版面设计。"""

USER_TMPL = """# 任务
把下面这套 deck 内容做成一个 **单文件 index.html**（内联所有 CSS，不依赖任何外部资源/CDN/JS 库）。

# 硬约束
- 横向 deck：`<main id="deck">` 内每页一个 `<section class="slide">`，每页 `width:100vw; height:100vh; overflow:hidden`，16:9 设计基准。
- 自带键盘翻页（← →）+ 底部页码；deck 用 `transform: translateX(-i*100vw)` 切换（保持这个结构，方便外部驱动）。
- 中文用 `"Noto Sans SC", "PingFang SC", sans-serif` 兜底；不要引外部字体。
- 不溢出：每页内容必须在一屏内放下，宁可精炼也不要挤爆。

# 设计要求（这是重点——发挥你的设计能力）
- 每页**根据它的内容和角色，自己决定最合适的版面**（不要千篇一律）：封面要有气场、对比页用左右/卡片、列点用网格或时间线、金句页大留白、收尾页有行动感。
- 强排版层级、充足留白、克制的强调色、必要的分隔与卡片、细节（kicker 小标、页码、装饰线/几何点缀）。
- 用下面的设计 token（配色/字体/字号锚点）作为基调，但**版式由你创造**。
- 可以用 CSS grid/flex、渐变、阴影、圆角、SVG 图标（内联）、CSS 画的简单示意图。追求"像设计师做的"，不是"模板填的"。

# 设计 token（style_lock）
```json
{tokens}
```

# 逐页内容（slide_plan）
```json
{pages}
```

# 输出
直接输出完整的 `<!doctype html>...</html>`，不要任何解释、不要 markdown 代码块包裹。"""


def main(run_id: str) -> None:
    run = RUNS / run_id
    plan = json.loads((run / "source" / "slide_plan.json").read_text(encoding="utf-8"))
    lock = json.loads((run / "source" / "style_lock.json").read_text(encoding="utf-8"))

    # 精简 pages：只给模型创作需要的字段
    pages = []
    for p in plan.get("pages", []):
        pages.append({
            "page_title": p.get("page_title"),
            "role": p.get("page_role_in_story"),
            "key_message": p.get("key_message"),
            "on_slide_text": p.get("on_slide_text"),
            "visual_direction": p.get("visual_direction"),
            "layout_hint": p.get("layout_type"),
        })

    user = USER_TMPL.format(
        tokens=json.dumps(lock, ensure_ascii=False, indent=2),
        pages=json.dumps(pages, ensure_ascii=False, indent=2),
    )

    from openai import OpenAI
    client = OpenAI(base_url=os.environ["ARK_BASE_URL"], api_key=os.environ["ARK_API_KEY"])
    model = os.environ.get("ARK_MODEL", "ark-code-latest")
    print(f"调用 {model} 直接写 HTML（{len(pages)} 页）…")
    resp = client.chat.completions.create(
        model=model, max_tokens=16000, temperature=0.7,
        messages=[{"role": "system", "content": SYSTEM}, {"role": "user", "content": user}],
    )
    html = resp.choices[0].message.content or ""
    # 去掉可能的 markdown 包裹
    if "```" in html:
        import re
        m = re.search(r"```(?:html)?\s*(.*?)```", html, re.S)
        if m:
            html = m.group(1)
    html = html.strip()
    if not html.lower().startswith("<!doctype"):
        i = html.lower().find("<!doctype")
        if i > 0:
            html = html[i:]

    out_dir = run / "spike"
    out_dir.mkdir(exist_ok=True)
    out = out_dir / "index.html"
    out.write_text(html, encoding="utf-8")
    print(f"✅ 写出 {out}（{len(html)} 字节）")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "sleep-redesign")
