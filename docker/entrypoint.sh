#!/usr/bin/env bash
# Jumpx Slides 容器入口：自检 → 起三进程（vite 在前台，挂掉即容器退出）。
set -euo pipefail

cd /app/backend

# langgraph.json 用 `env: .env`，而镜像内无 .env（密钥走 compose env_file 注入环境变量）。
# 从环境变量合成 .env，让 langgraph dev 与 agent.py 的 load_dotenv 都能读到。
if [ ! -f /app/backend/.env ]; then
  : > /app/backend/.env
  for k in ARK_BASE_URL ARK_API_KEY ARK_MODEL OPENAI_API_KEY GEMINI_API_KEY NANOBANANA_API_KEY; do
    v="${!k:-}"; [ -n "$v" ] && echo "$k=$v" >> /app/backend/.env
  done
fi

# 首启动自检（缺 .env/chromium/skill 会清晰报错并退出）
python selfcheck.py

echo "[entrypoint] 启动 langgraph dev :2024 ..."
langgraph dev --host 127.0.0.1 --port 2024 --no-browser --allow-blocking >/tmp/langgraph.log 2>&1 &

echo "[entrypoint] 启动 recipe_api :2025 ..."
uvicorn recipe_api:app --host 127.0.0.1 --port 2025 --log-level warning >/tmp/recipe_api.log 2>&1 &

# 等两个后端就绪（vite 代理会打到它们）
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:2025/runs >/dev/null 2>&1; then echo "[entrypoint] recipe_api 就绪"; break; fi
  sleep 1
done

echo "[entrypoint] 启动 vite :5180（对外）..."
cd /app/frontend/app
exec npm run dev -- --host 0.0.0.0 --port 5180
