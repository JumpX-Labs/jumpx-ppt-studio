# Jumpx Slides · 单机应用镜像（Phase 5）
# 一镜像跑齐三进程：langgraph dev(:2024) + recipe_api(:2025) + vite(:5180)。
# 基于 Playwright 官方 Python 镜像（自带 chromium 运行时依赖），补 CJK 字体 + Node。
# noble = Ubuntu 24.04，自带 Python 3.12（deepagents 需 ≥3.11）。

FROM mcr.microsoft.com/playwright/python:v1.49.0-noble

# CJK 字体（中文 deck 渲染必需）+ Node 20（跑 vite）+ git（构建时拉 skill）
RUN apt-get update && apt-get install -y --no-install-recommends \
      fonts-noto-cjk fonts-noto-color-emoji curl ca-certificates git && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# —— 构建时拉 ai-slide-producer skill 的固定版本，烤进镜像（镜像自包含，部署不再依赖宿主 repo）——
# 默认指向公开发布仓库 JumpX-Labs/jumpx-ppt-forge；SKILL_REF 钉版本（分支/tag/commit）。
# 复现性：建议在 skill 仓库打 tag（如 v0.2.0），构建时 --build-arg SKILL_REF=v0.2.0。
ARG SKILL_GIT_URL=https://github.com/JumpX-Labs/jumpx-ppt-forge.git
ARG SKILL_REF=main
RUN echo "拉取 skill: $SKILL_GIT_URL @ $SKILL_REF" && \
    git clone --depth 1 --branch "$SKILL_REF" "$SKILL_GIT_URL" /skill-src && \
    rm -rf /skill-src/.git && \
    test -f /skill-src/SKILL.md || (echo "❌ 未找到 /skill-src/SKILL.md（repo 根应为 skill 本体）"; exit 1)
# skill 源固定指向镜像内路径（覆盖 setup_workspace 的默认同级定位）；repo 根即 skill
ENV JX_SKILL_SRC=/skill-src

# —— Python 依赖（先单独 COPY 以利缓存）——
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt && \
    pip install --no-cache-dir uvicorn && \
    python -m playwright install --with-deps chromium

# —— 前端依赖 ——
COPY frontend/app/package.json frontend/app/package-lock.json frontend/app/
RUN cd frontend/app && npm install --no-audit --no-fund

# —— 源码 ——
COPY backend backend
COPY frontend frontend
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 5180
ENTRYPOINT ["/entrypoint.sh"]
