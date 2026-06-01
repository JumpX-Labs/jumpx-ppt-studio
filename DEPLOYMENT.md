# Jumpx Slides · 部署指南（交付给运维/部署人员）

> 单机 / 内网 Docker 应用。一个容器内跑三进程（前端 + 生成 agent + API），对外只开一个端口。
> 无账号、无登录。**不能部署到 Vercel/Cloudflare Pages 等纯静态/serverless 平台**——它需要常驻进程、持久磁盘、无头 chromium。

---

## 0. 你会拿到什么（源码位置）

构建机（开发者本机）上的两个仓库，**必须同级摆放**：

```
<某个父目录>/
├── ai-ppt-webapp/            # 主应用（本指南所在仓库）
│   开发者机器上的绝对路径： /Users/peng/Jumpxai/Github/ai-ppt-webapp
└── jumpx-ppt-slides-skill/   # ai-slide-producer skill（被只读挂载进容器）
    开发者机器上的绝对路径： /Users/peng/Jumpxai/Github/jumpx-ppt-slides-skill
```

部署到别的机器时，请把**这两个目录一起**拷过去并保持同级（`docker-compose.yml` 里用相对路径 `../jumpx-ppt-slides-skill` 挂载 skill）。
> 注意：`backend/.env`（含密钥）和 `backend/workspace/`（运行产物）被 `.gitignore` 拦截，**不在 git 里**。`.env` 需单独索取（见 §2）；`workspace/` 不用拷（容器会自建持久卷）。

---

## 1. 目标机器前置条件

- **Docker** + **Docker Compose v2**（`docker compose version` 能跑）。
- 资源建议：**≥2 vCPU、≥4GB 内存、≥5GB 磁盘**（首次构建拉基础镜像≈2GB + 装 chromium）。
- 能访问外网：构建时拉镜像/依赖；运行时调用火山方舟 LLM 接口。
- 端口 **5180** 可用（对外访问就走这个；如要 80/443 见 §6 反向代理）。

---

## 2. 关键配置：`backend/.env`（真实 LLM 变量在这里）

**真实的模型变量在构建机的 `backend/.env` 文件里**（路径：`/Users/peng/Jumpxai/Github/ai-ppt-webapp/backend/.env`）。
部署时请**从那份 `.env` 取真实值**，或向开发者（Peng）索取。**不要用示例里的占位值。**

`backend/.env` 需包含以下变量（变量名 + 含义；模板见 `backend/.env.example`）：

| 变量 | 必填 | 含义 |
|------|------|------|
| `ARK_BASE_URL` | ✅ | 火山方舟（OpenAI 兼容）端点，如 `https://ark.cn-beijing.volces.com/api/coding/v3` |
| `ARK_API_KEY`  | ✅ | 火山方舟密钥（**机密**：`ark-...`，勿提交 git、勿外泄、勿贴聊天/截图）|
| `ARK_MODEL`    | 建议 | 生成 + 写 HTML 用的模型，当前 `ark-code-latest` |
| `ARK_VISION_MODEL` | 建议 | 视觉模型（样式识别用），当前 `Doubao-Seed-2.0-lite` |
| `OPENAI_API_KEY` / `GEMINI_API_KEY` / `NANOBANANA_API_KEY` | 选填 | AI 出图用；HTML 路径不需要，可留空 |

操作：
```bash
cd ai-ppt-webapp/backend
cp .env.example .env        # 若机器上还没有 .env
#（编辑 .env，把 ARK_BASE_URL / ARK_API_KEY 等填成从开发者 .env 拿到的真实值）
```

---

## 3. 启动

```bash
cd ai-ppt-webapp
docker compose up --build -d     # 首次构建+后台启动（首次数分钟）
docker compose logs -f           # 看启动日志（含首启动自检结果）
```

容器启动时会先跑自检 `selfcheck.py`：检查 `.env` 模型配置 / chromium / skill 挂载 / 依赖 / 配方。**任一必需项缺失会在日志里明确报错并退出**——按提示补齐即可。

访问：`http://<服务器IP>:5180`

---

## 4. 验证部署成功

```bash
# 三条都应返回 200 / 正常 JSON：
curl -s -o /dev/null -w "Ut %{http_code}\n"  http://localhost:5180/                       # 前端
curl -s http://localhost:5180/api/skill | head -c 80; echo                                  # API（Skill 信息）
curl -s -o /dev/null -w "LG %{http_code}\n"  http://localhost:5180/lg/ok                     # 生成 agent
```
然后浏览器打开 `:5180`，输入一个主题点「开始生成」，能走到「确认大纲」即说明 LLM 接通、链路正常。

---

## 5. 数据 / 停止 / 更新

- **持久化**：产物 `runs/` 与配方 `recipes/` 存在 Docker 命名卷 `jumpx-workspace`，跨重启保留。
- 停止：`docker compose down`（**加 `-v` 会连产物卷一起删**，谨慎）。
- 更新代码后重建：`docker compose up --build -d`。
- 备份：`docker run --rm -v ai-ppt-webapp_jumpx-workspace:/w -v "$PWD":/b alpine tar czf /b/workspace-backup.tgz -C /w .`

---

## 6. 对外/HTTPS（生产可选）

容器只暴露 `:5180`（HTTP）。要域名 + HTTPS：在前面挂一个反向代理（Nginx / Caddy / Traefik）把 443 转发到 `127.0.0.1:5180` 即可。
> 注意：**无内置鉴权**。若部署到公网，请自行在反向代理层加访问控制（Basic Auth / IP 白名单 / SSO），或只在内网/VPN 内访问。

容器 PaaS（Render / Fly.io / Railway / 云 VM）都能直接吃这个 `Dockerfile`，自带域名+HTTPS，比裸机省事——只是 skill 挂载方式要相应改成"打进镜像"（需要时找开发者改一版 Dockerfile）。

---

## 7. 已知特性 / 注意点（不是 bug）

- **首次构建慢**：基础镜像（含 chromium）≈2GB + 装依赖，首次数分钟，之后有缓存。
- **生成耗时**：一份 deck 端到端约数分钟（多次 LLM 调用 + 写 HTML + 渲染）。属正常。
- **单容器 / 内存型**：生成 agent 是开发型常驻 runtime，**容器重启会丢失进行中的生成**（已完成的产物在卷里保留）。
- **中文字体**：镜像已装 `fonts-noto-cjk`，中文 deck 渲染正常。
- **架构细节 / 本地非 Docker 跑法**：见 `RUN.md`。

---

## 8. 出问题先看

```bash
docker compose logs --tail=80           # 总日志
docker compose exec jumpx-slides cat /tmp/langgraph.log     # 生成 agent 日志
docker compose exec jumpx-slides cat /tmp/recipe_api.log    # API 日志
docker compose exec jumpx-slides python backend/selfcheck.py  # 重跑自检
```

| 现象 | 多半原因 |
|------|----------|
| 自检报 `.env` 缺失/模型配置 | `backend/.env` 没填或值不对（§2）|
| 自检报 skill 缺失 | `jumpx-ppt-slides-skill` 没和本仓库同级 |
| 生成卡住 / `/lg/ok` 非 200 | 方舟 key/额度/网络问题，看 langgraph.log |
| 导出 PDF/PNG 失败 | chromium 异常，看 recipe_api.log（一般镜像已自带）|
