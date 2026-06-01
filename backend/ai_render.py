"""AI 渲染器：让强模型直接写整套 HTML slides（取代填模板）。

spike 验证质量碾压模板版。保留 deck 外壳契约（#deck / .slide / translateX 翻页），
以便现有「演示模式」与「导出 PDF/PNG/PPTX」继续可用。失败回退模板版（build_html）。
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

SYSTEM = """你是世界顶级的 HTML 演示设计师（Stripe / Linear / Apple Keynote 水准）。
你把"逐页内容 + 设计 token"做成一套专业级的单文件 HTML 幻灯片——不是填模板，是真正做版面设计。"""

# 必须遵守的 deck 外壳契约（让演示/导出能驱动）
CONTRACT = """# 硬契约（必须严格遵守，否则演示和导出会坏）
1. 结构：`<main id="deck" class="deck">` 内，**每页一个** `<section class="slide" data-page-id="P01">`（P01、P02…按序）。slide 数必须 = 内容页数。
2. 布局：`.deck{{position:fixed;inset:0;display:flex;flex-wrap:nowrap;width:{deckvw}vw;height:100vh;transition:transform .4s ease}}`；`.slide{{flex:0 0 100vw;width:100vw;height:100vh;overflow:hidden;position:relative}}`。
3. 翻页：内置 JS，`←/→/空格` 与底部上一页/下一页按钮通过 `deck.style.transform='translateX(-i*100vw)'` 切换；控件放在 `<nav class="slide-controls">`，页码用 `.slide-index` 之外的元素即可（这两个 class 导出时会被隐藏）。
4. 自包含：内联所有 CSS/JS，**不引任何外部资源**（无 CDN、无外链字体）。中文字体兜底 `"Noto Sans SC","PingFang SC",sans-serif`。
5. 不溢出：每页内容必须一屏放下（1280×720 基准），宁可精炼。"""

USER_TMPL = """把下面这套 deck 做成一个**单文件 index.html**，达到专业设计水准。

{contract}

# 设计要求（重点——发挥设计能力，不要千篇一律）
- 每页**按其内容与角色自己决定最合适的版面**：封面有气场、对比页用左右/卡片、列点用网格或时间线、金句大留白、收尾有行动感。
- 强排版层级、充足留白、克制强调色、卡片/分隔线/几何点缀、kicker 小标、页码。
- 用下面的设计 token 当基调（配色/字体/字号），但**版式由你创造**；可用 CSS grid/flex、渐变、阴影、圆角、内联 SVG 图标、CSS 简单示意图。
- 参考每页的 `visual_direction` 提示去构图。遵守 `forbidden` 约束。

# 设计 token（style_lock）
```json
{tokens}
```

# 逐页内容（slide_plan）
```json
{pages}
```

# 输出
直接输出完整 `<!doctype html>...</html>`，不要解释、不要 markdown 包裹。"""


def _slim_pages(plan: dict) -> list[dict]:
    out = []
    for p in plan.get("pages", []):
        out.append({
            "page_title": p.get("page_title"),
            "role": p.get("page_role_in_story"),
            "key_message": p.get("key_message"),
            "on_slide_text": p.get("on_slide_text"),
            "visual_direction": p.get("visual_direction"),
            "layout_hint": p.get("layout_type"),
        })
    return out


def _extract_html(text: str) -> str:
    if "```" in text:
        m = re.search(r"```(?:html)?\s*(.*?)```", text, re.S)
        if m:
            text = m.group(1)
    text = text.strip()
    i = text.lower().find("<!doctype")
    if i > 0:
        text = text[i:]
    return text


def _slide_count(html: str) -> int:
    return len(re.findall(r'<section[^>]*class="[^"]*\bslide\b', html))


def _client():
    from openai import OpenAI
    return OpenAI(base_url=os.environ["ARK_BASE_URL"], api_key=os.environ["ARK_API_KEY"])


def render_deck_html(project_dir: Path) -> tuple[str | None, str]:
    """返回 (html, note)。html 为 None 表示失败（调用方回退模板）。"""
    src = project_dir / "source"
    try:
        plan = json.loads((src / "slide_plan.json").read_text(encoding="utf-8"))
        lock = json.loads((src / "style_lock.json").read_text(encoding="utf-8"))
    except Exception as e:  # noqa: BLE001
        return None, f"读取 slide_plan/style_lock 失败：{e}"

    pages = _slim_pages(plan)
    n = len(pages)
    if n == 0:
        return None, "slide_plan 无页面"

    contract = CONTRACT.format(deckvw=n * 100)
    user = USER_TMPL.format(
        contract=contract,
        tokens=json.dumps(lock, ensure_ascii=False, indent=2),
        pages=json.dumps(pages, ensure_ascii=False, indent=2),
    )
    model = os.environ.get("ARK_MODEL", "ark-code-latest")
    client = _client()

    def call(messages):
        r = client.chat.completions.create(model=model, max_tokens=16000, temperature=0.6, messages=messages)
        return _extract_html(r.choices[0].message.content or "")

    msgs = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": user}]
    try:
        html = call(msgs)
    except Exception as e:  # noqa: BLE001
        return None, f"AI 渲染调用失败：{e}"

    # 结构校验：必须有 #deck + slide 数匹配
    cnt = _slide_count(html)
    if 'id="deck"' not in html or cnt != n:
        # 1 次修复
        fix = (f"上面的 HTML 不符合硬契约：需要 `<main id=\"deck\">` 且恰好 {n} 个 "
               f"`<section class=\"slide\">`（当前检测到 {cnt} 个，deck={'有' if 'id=\"deck\"' in html else '无'}）。"
               f"请修正结构后重新输出完整 HTML，保持设计不变。")
        try:
            html2 = call(msgs + [{"role": "assistant", "content": html[:2000]}, {"role": "user", "content": fix}])
            if 'id="deck"' in html2 and _slide_count(html2) == n:
                html = html2
            elif _slide_count(html) != n:
                return None, f"结构校验未过（slide 数 {cnt}≠{n}），回退模板"
        except Exception:  # noqa: BLE001
            if cnt != n:
                return None, f"结构校验未过（slide 数 {cnt}≠{n}），回退模板"

    return html, f"AI 渲染成功（{n} 页，{len(html)} 字节）"
