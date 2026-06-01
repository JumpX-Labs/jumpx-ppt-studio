"""验证：发布版 Skill 的 08 指令"原文"是否足以让一个普通 agent 写出好版式。

模拟"别家 agent 装了这个 Skill"：把 Skill 的 references/08-web-renderer.md 原文当渲染
指令，配真实 slide_plan + style_lock，喂给模型，看它产出的 index.html 质量。
不走 webapp 的 ai_render（那是我们自己的 prompt）——这里只信 Skill 自带的指令。

用法：.venv/bin/python verify_skill_render.py <run_id>
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

from dotenv import load_dotenv

from setup_workspace import RUNS, SKILL_DST

load_dotenv()


def main(run_id: str) -> None:
    run = RUNS / run_id
    instr = (SKILL_DST / "references" / "08-web-renderer.md").read_text(encoding="utf-8")
    plan = (run / "source" / "slide_plan.json").read_text(encoding="utf-8")
    lock = (run / "source" / "style_lock.json").read_text(encoding="utf-8")

    system = (
        "你是一个安装了 ai-slide-producer skill 的 agent，正在执行 Step 7B（Web Render）。"
        "严格按下面这份 skill 渲染指令（08-web-renderer.md）行事。")
    user = (
        f"# 渲染指令（skill 的 references/08-web-renderer.md，原文）\n\n{instr}\n\n"
        f"# source/slide_plan.json\n```json\n{plan}\n```\n\n"
        f"# source/style_lock.json\n```json\n{lock}\n```\n\n"
        f"# 现在：按指令的「主路径（模型直接写 HTML）」产出完整 index.html。"
        f"直接输出 `<!doctype html>...`，不要解释、不要 markdown 包裹。")

    from openai import OpenAI
    client = OpenAI(base_url=os.environ["ARK_BASE_URL"], api_key=os.environ["ARK_API_KEY"])
    model = os.environ.get("ARK_MODEL", "ark-code-latest")
    print(f"模拟别家 agent（{model}）照 Skill 08 原文渲染 {run_id} …")
    r = client.chat.completions.create(
        model=model, max_tokens=16000, temperature=0.6,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}])
    html = r.choices[0].message.content or ""
    if "```" in html:
        m = re.search(r"```(?:html)?\s*(.*?)```", html, re.S)
        if m:
            html = m.group(1)
    html = html.strip()
    i = html.lower().find("<!doctype")
    if i > 0:
        html = html[i:]

    out_dir = run / "skillverify"
    out_dir.mkdir(exist_ok=True)
    (out_dir / "index.html").write_text(html, encoding="utf-8")
    n_slides = len(re.findall(r'<section[^>]*class="[^"]*\bslide\b', html))
    has_deck = 'id="deck"' in html
    print(f"✅ 写出 {out_dir/'index.html'}（{len(html)} 字节）")
    print(f"   契约自检：#deck={has_deck} | slide 数={n_slides}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "sleep-redesign")
