"""配方系统（Phase 2）。

配方 = 一个 skill 目录 = 一个 zip（协议）。库 = workspace/recipes/ 下的目录集合。
- 只开放"可改层"（叙事/语气/素材吸收/背景知识/风格）；其余锁定。
- 上传 = 只吸收可改层并到我们的锁定基座；用户改锁定层 → 忽略并回告。
- 验证 = 结构 lint（+ 可选干跑 schema 校验）；不过则不允许使用。
- schema 升级 = 对全库批量复验，不过者失效。
单机本地,无账号。详见 PRD_v2 §12 / SKILL_CONTROLLER / TECH_SPIKES S3/S5。
"""

from __future__ import annotations

import json
import os
import shutil
import tempfile
import zipfile
from pathlib import Path

from setup_workspace import WORKSPACE, SKILL_DST as BASE_SKILL, ensure_workspace

RECIPES_DIR = WORKSPACE / "recipes"
ACTIVE_FILE = RECIPES_DIR / "_active.txt"

# 契约版本：升级 schema/layout 时 +1，旧配方需复验
CONTRACT_VERSION = "1"

# 可改层（②层）——上传时只吸收这些；其余一律锁定
EDITABLE = [
    "references/02-context-pack.md",   # 素材吸收
    "references/03-strategist.md",     # 叙事结构
    "references/05-writer.md",         # 每页内容/厚薄
    "references/background.md",        # 背景知识（配方的"脑子"，新增槽）
    "references/12-style-presets.md",  # 风格倾向
]
_BG_TEMPLATE = "# 这个配方懂什么\n（配方自带、可复用的领域知识；与用户每次输入的素材不同。）\n"

_IGNORE = shutil.ignore_patterns("__pycache__", "*.pyc", "images", ".DS_Store")


# ---------- 基础 ----------
def _manifest_path(rid: str) -> Path:
    return RECIPES_DIR / rid / "manifest.json"


def read_manifest(rid: str) -> dict:
    p = _manifest_path(rid)
    if p.exists():
        try:
            return json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"id": rid, "name": rid, "contract_version": "?"}


def write_manifest(rid: str, m: dict) -> None:
    _manifest_path(rid).write_text(json.dumps(m, ensure_ascii=False, indent=2), encoding="utf-8")


def recipe_dir(rid: str) -> Path:
    return RECIPES_DIR / rid


def _unique_id(base: str) -> str:
    base = "".join(c if c.isalnum() or c in "-_" else "-" for c in base).strip("-") or "recipe"
    rid, n = base, 1
    while (RECIPES_DIR / rid).exists():
        n += 1
        rid = f"{base}-{n}"
    return rid


def _ensure_background(rid: str) -> None:
    bg = recipe_dir(rid) / "references" / "background.md"
    if not bg.exists():
        bg.parent.mkdir(parents=True, exist_ok=True)
        bg.write_text(_BG_TEMPLATE, encoding="utf-8")


# ---------- 库管理 ----------
def ensure_recipes() -> None:
    """幂等:确保 recipes/ 存在、有内置 default、有 active 指针。"""
    ensure_workspace()
    RECIPES_DIR.mkdir(parents=True, exist_ok=True)
    if not (recipe_dir("default") / "SKILL.md").exists():
        _seed_from_base("default", "默认 · 通用")
    if not ACTIVE_FILE.exists():
        set_active("default")


def _seed_from_base(rid: str, name: str, *, author: str = "builtin") -> str:
    dest = recipe_dir(rid)
    if dest.exists():
        shutil.rmtree(dest)
    shutil.copytree(BASE_SKILL, dest, ignore=_IGNORE)
    _ensure_background(rid)
    write_manifest(rid, {
        "id": rid, "name": name, "version": "1", "author": author,
        "contract_version": CONTRACT_VERSION, "editable": EDITABLE, "density": 1,
    })
    return rid


def list_recipes() -> list[dict]:
    if not RECIPES_DIR.exists():
        return []
    return [read_manifest(d.name) for d in sorted(RECIPES_DIR.iterdir()) if d.is_dir()]


def get_active() -> str:
    return ACTIVE_FILE.read_text(encoding="utf-8").strip() if ACTIVE_FILE.exists() else "default"


def set_active(rid: str) -> None:
    if not (recipe_dir(rid) / "SKILL.md").exists():
        raise ValueError(f"配方不存在或无效: {rid}")
    ACTIVE_FILE.write_text(rid, encoding="utf-8")


def active_skill_path() -> str:
    """给 deepagents skills= 用的虚拟路径(相对 workspace 根)。回退到内置 skill。"""
    rid = get_active()
    if (recipe_dir(rid) / "SKILL.md").exists():
        return f"/recipes/{rid}"
    return "/skills/ai-slide-producer"


# ---------- fork / 导入 / 导出 ----------
def fork(rid: str, new_name: str | None = None) -> str:
    src = recipe_dir(rid)
    if not (src / "SKILL.md").exists():
        raise ValueError(f"源配方无效: {rid}")
    nm = (new_name or read_manifest(rid).get("name", rid))
    new_id = _unique_id(nm + "-fork")
    shutil.copytree(src, recipe_dir(new_id), ignore=_IGNORE)
    _ensure_background(new_id)
    m = read_manifest(rid)
    m.update({"id": new_id, "name": nm + " · 副本", "author": "user", "contract_version": CONTRACT_VERSION})
    write_manifest(new_id, m)
    return new_id


def export_zip(rid: str, out_path: str) -> str:
    src = recipe_dir(rid)
    if not (src / "SKILL.md").exists():
        raise ValueError(f"配方无效: {rid}")
    base = out_path[:-4] if out_path.endswith(".zip") else out_path
    return shutil.make_archive(base, "zip", root_dir=src)


def _is_editable(rel: str) -> bool:
    return rel.replace(os.sep, "/") in EDITABLE


def absorb(uploaded_dir: str, name: str | None = None) -> tuple[str, list[str]]:
    """上传的核心:新配方 = 我们的锁定基座 + 上传里的可改层。

    返回 (new_recipe_id, ignored)。ignored = 上传里被忽略的锁定区改动(回告用户)。
    """
    up = Path(uploaded_dir)
    new_id = _unique_id((name or "imported"))
    dest = recipe_dir(new_id)
    shutil.copytree(BASE_SKILL, dest, ignore=_IGNORE)   # 锁定层 = 我们的基座
    ignored: list[str] = []
    for p in up.rglob("*"):
        if not p.is_file():
            continue
        rel = str(p.relative_to(up)).replace(os.sep, "/")
        if rel == "manifest.json":
            continue
        if _is_editable(rel):
            d = dest / rel
            d.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(p, d)
        else:
            base_f = BASE_SKILL / rel
            try:
                if not base_f.exists():
                    ignored.append(f"{rel}（锁定区新增文件，已忽略）")
                elif base_f.read_bytes() != p.read_bytes():
                    ignored.append(f"{rel}（锁定区改动，已忽略）")
            except Exception:
                pass
    _ensure_background(new_id)
    um = {}
    if (up / "manifest.json").exists():
        try:
            um = json.loads((up / "manifest.json").read_text(encoding="utf-8"))
        except Exception:
            um = {}
    write_manifest(new_id, {
        "id": new_id, "name": um.get("name", name or "导入的配方"),
        "version": um.get("version", "1"), "author": um.get("author", "imported"),
        "contract_version": CONTRACT_VERSION, "editable": EDITABLE, "density": um.get("density", 1),
    })
    return new_id, ignored


def _find_recipe_root(d: Path) -> Path:
    if (d / "SKILL.md").exists() or (d / "references").exists():
        return d
    subs = [x for x in d.iterdir() if x.is_dir()]
    if len(subs) == 1:
        return _find_recipe_root(subs[0])
    return d


def import_zip(zip_path: str, name: str | None = None) -> tuple[str, list[str]]:
    with tempfile.TemporaryDirectory() as tmp:
        with zipfile.ZipFile(zip_path) as z:
            z.extractall(tmp)
        root = _find_recipe_root(Path(tmp))
        return absorb(str(root), name=name)


# ---------- 验证（校验门）----------
def validate_recipe(rid: str) -> dict:
    """结构 lint(契约符合性)。返回 {ok, errors}。
    完整校验门还应包含「廉价干跑 + validate_slide_plan」(见 TECH_SPIKES S3,需 LLM,此处不跑)。
    """
    d = recipe_dir(rid)
    errs: list[str] = []
    if not (d / "SKILL.md").exists():
        errs.append("缺 SKILL.md（管线/门禁，锁定层）")
    if not (d / "schemas" / "slide_plan.schema.json").exists():
        errs.append("缺 schemas/slide_plan.schema.json（产物契约，锁定层）")
    if not (d / "scripts" / "build_html.py").exists():
        errs.append("缺 scripts/build_html.py（渲染机制，锁定层）")
    for f in EDITABLE:
        if not (d / f).exists():
            errs.append(f"缺可改文件 {f}")
        elif (d / f).read_text(encoding="utf-8", errors="ignore").strip() == "":
            errs.append(f"可改文件为空: {f}")
    m = read_manifest(rid)
    if str(m.get("contract_version")) != CONTRACT_VERSION:
        errs.append(f"contract 版本不符（{m.get('contract_version')} ≠ {CONTRACT_VERSION}），需更新后复验")
    return {"ok": not errs, "errors": errs}


def revalidate_all() -> dict:
    """schema 升级后批量复验;不过者标 invalid(调用方据此禁用选用)。"""
    return {m["id"]: validate_recipe(m["id"]) for m in list_recipes()}


if __name__ == "__main__":
    ensure_recipes()
    print("recipes:", [m["id"] for m in list_recipes()], "| active:", get_active())
