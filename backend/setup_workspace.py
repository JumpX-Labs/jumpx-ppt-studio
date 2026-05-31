"""把只读的 ai-slide-producer skill 复制进 agent 的工作区（workspace）。

为什么复制而不是 symlink：FilesystemBackend(virtual_mode=True) 禁止解析到 root_dir
之外的路径，指向仓库别处的 symlink 会越界被拒。复制是只读引用——我们从不回写原 skill。

排除重资产（images/ 与 __pycache__），workspace 保持精简。幂等：已存在则跳过，
传 force=True 可强制刷新。
"""

from __future__ import annotations

import shutil
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
WORKSPACE = BACKEND_DIR / "workspace"
RUNS = WORKSPACE / "runs"

# 原 skill 源（只读）。相对本仓库定位，换机器只要仓库结构不变即可。
SKILL_SRC = (
    BACKEND_DIR.parent.parent  # Github/
    / "jumpx-ppt-slides-skill"
    / "skills"
    / "ai-slide-producer"
)
SKILL_DST = WORKSPACE / "skills" / "ai-slide-producer"

_IGNORE = shutil.ignore_patterns("__pycache__", "*.pyc", "images", ".DS_Store")


def ensure_workspace(force: bool = False) -> Path:
    """确保 workspace/skills/ai-slide-producer 就位，返回 workspace 路径。"""
    RUNS.mkdir(parents=True, exist_ok=True)
    if SKILL_DST.exists() and not force:
        return WORKSPACE
    if not SKILL_SRC.exists():
        raise FileNotFoundError(f"找不到 skill 源：{SKILL_SRC}")
    if SKILL_DST.exists():
        shutil.rmtree(SKILL_DST)
    SKILL_DST.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(SKILL_SRC, SKILL_DST, ignore=_IGNORE)
    return WORKSPACE


if __name__ == "__main__":
    import sys

    ws = ensure_workspace(force="--force" in sys.argv)
    print(f"workspace ready: {ws}")
    print(f"skill mounted at: {SKILL_DST}")
