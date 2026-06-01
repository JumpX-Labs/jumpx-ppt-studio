"""Skill 展示/下载（站点独立页用）。

唯一真相 = 默认配方目录（= 我们运行态跑的那份）。展示读它、下载导它，
天然保证「站点展示 / 客户下载 / Web App 运行」三者同一份。
"""

from __future__ import annotations

import re
from pathlib import Path

import recipes as R

# 展示页要重点呈现的 references（角色文档），按管线顺序
REF_ORDER = [
    ("01-intake-brief.md", "意图澄清"),
    ("02-context-pack.md", "资料吸收"),
    ("03-strategist.md", "叙事策略"),
    ("04-researcher.md", "事实补充"),
    ("05-writer.md", "逐页写作"),
    ("06-reviewer.md", "叙事审核"),
    ("07-designer.md", "视觉设计"),
    ("08-web-renderer.md", "HTML 渲染（模型直接写）"),
    ("09-image-renderer.md", "图片渲染"),
    ("10-style-guard.md", "风格守卫"),
    ("11-producer.md", "交付制片"),
    ("12-style-presets.md", "风格预设"),
    ("14-quality-checklist.md", "质量清单"),
    ("15-export-contract.md", "导出契约"),
]

SKILL_RECIPE = "default"   # 站点展示/下载的"那个 Skill" = 默认配方（= 运行态）


def _frontmatter_desc(skill_md: str) -> str:
    m = re.search(r"^---\s*\n(.*?)\n---", skill_md, re.S)
    if not m:
        return ""
    block = m.group(1)
    dm = re.search(r"description:\s*>?\s*\n?(.*?)(?:\n\w+:|\Z)", block, re.S)
    if dm:
        return re.sub(r"\s+", " ", dm.group(1)).strip()
    return ""


def skill_overview() -> dict:
    rdir = R.recipe_dir(SKILL_RECIPE)
    skill_md = (rdir / "SKILL.md").read_text(encoding="utf-8") if (rdir / "SKILL.md").exists() else ""
    manifest = R.read_manifest(SKILL_RECIPE)
    refs = []
    for fname, label in REF_ORDER:
        p = rdir / "references" / fname
        if p.exists():
            first_h = ""
            for line in p.read_text(encoding="utf-8").splitlines():
                if line.startswith("# "):
                    first_h = line[2:].strip()
                    break
            refs.append({"file": fname, "label": label, "title": first_h,
                         "bytes": p.stat().st_size})
    # 资产概览
    styles = sorted([f.stem for f in (rdir / "assets" / "style-presets").glob("*.json")]) \
        if (rdir / "assets" / "style-presets").is_dir() else []
    layouts = sorted([f.name.replace(".html.snippet", "") for f in (rdir / "assets" / "templates" / "layouts").glob("*.snippet")]) \
        if (rdir / "assets" / "templates" / "layouts").is_dir() else []
    scripts = sorted([f.name for f in (rdir / "scripts").glob("*.py")]) if (rdir / "scripts").is_dir() else []
    return {
        "name": "ai-slide-producer",
        "version": manifest.get("version", "1"),
        "description": _frontmatter_desc(skill_md),
        "pipeline": "Intake → Context Pack → Outline → Slide Plan → Narrative Review → Design Spec → Render → Quality Check → Delivery",
        "skill_md": skill_md,
        "references": refs,
        "style_presets": styles,
        "layouts": layouts,
        "scripts": scripts,
        "download_url": f"/api/recipes/{SKILL_RECIPE}/export",
        "source_recipe": SKILL_RECIPE,
    }


def skill_file(name: str) -> str | None:
    """读 references/<name> 的原文（仅限 references 下、防穿越）。"""
    if not re.match(r"^[A-Za-z0-9_-]+\.md$", name or ""):
        return None
    p = (R.recipe_dir(SKILL_RECIPE) / "references" / name).resolve()
    base = (R.recipe_dir(SKILL_RECIPE) / "references").resolve()
    try:
        p.relative_to(base)
    except ValueError:
        return None
    return p.read_text(encoding="utf-8") if p.exists() else None
