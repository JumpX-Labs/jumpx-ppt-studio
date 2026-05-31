"""配方 HTTP API（Phase 3a）。

给前端「配方页 + 编辑器」用:列出/读/写(只写可改层)/fork/选用/导入(zip)/导出(zip)/批量复验。
用 Starlette(已随 langgraph 安装,无新依赖)。单机本地,无账号。

起服务:`uvicorn recipe_api:app --port 2025`（与 langgraph dev :2024 并行）。
生成 agent 走 LangGraph server;配方管理走本 API。
"""

from __future__ import annotations

import os
import tempfile

from starlette.applications import Starlette
from starlette.responses import FileResponse, JSONResponse
from starlette.routing import Route

import recipes as R
import runs as RUN
import export_deck as EXPORT
import style_import as STYLE

R.ensure_recipes()


async def list_recipes(request):
    return JSONResponse({"recipes": R.list_recipes(), "active": R.get_active(),
                         "contract_version": R.CONTRACT_VERSION, "editable": R.EDITABLE})


async def get_recipe(request):
    rid = request.path_params["id"]
    if not (R.recipe_dir(rid) / "SKILL.md").exists():
        return JSONResponse({"error": "not found"}, status_code=404)
    return JSONResponse({"manifest": R.read_manifest(rid), "editable": R.get_editable(rid),
                         "validate": R.validate_recipe(rid)})


async def save_recipe(request):
    """保存编辑:只写可改层;锁定层一律拒绝并回告。完后跑契约校验。"""
    rid = request.path_params["id"]
    body = await request.json()
    rejected = []
    for rel, content in (body.get("files") or {}).items():
        try:
            R.save_editable(rid, rel, content)
        except ValueError:
            rejected.append(rel)
    meta = {k: body[k] for k in R.META_FIELDS if k in body}
    if meta:
        R.update_manifest(rid, meta)
    return JSONResponse({"validate": R.validate_recipe(rid), "rejected_locked": rejected,
                         "manifest": R.read_manifest(rid)})


async def fork_recipe(request):
    rid = request.path_params["id"]
    try:
        body = await request.json()
    except Exception:
        body = {}
    new_id = R.fork(rid, (body or {}).get("name"))
    return JSONResponse({"id": new_id, "manifest": R.read_manifest(new_id)})


async def set_active(request):
    body = await request.json()
    try:
        R.set_active(body["id"])
    except ValueError as e:
        return JSONResponse({"error": str(e)}, status_code=400)
    return JSONResponse({"active": R.get_active()})


async def import_recipe(request):
    """上传配方:请求体直接是 zip 原始字节(content-type: application/zip)。
    `?name=` 可选。免 multipart 依赖,单机前端直接 POST 文件字节即可。
    """
    data = await request.body()
    if not data:
        return JSONResponse({"error": "empty body (POST zip bytes)"}, status_code=400)
    name = request.query_params.get("name")
    tmp = tempfile.NamedTemporaryFile(suffix=".zip", delete=False)
    tmp.write(data)
    tmp.close()
    try:
        nid, ignored = R.import_zip(tmp.name, name=name)
        return JSONResponse({"id": nid, "manifest": R.read_manifest(nid),
                             "ignored_locked": ignored, "validate": R.validate_recipe(nid)})
    finally:
        os.unlink(tmp.name)


async def export_recipe(request):
    rid = request.path_params["id"]
    out = os.path.join(tempfile.gettempdir(), f"recipe-{rid}")
    zp = R.export_zip(rid, out)
    return FileResponse(zp, filename=f"{rid}.zip", media_type="application/zip")


async def revalidate(request):
    return JSONResponse(R.revalidate_all())


# —— 风格导入（视觉模型 skill）：上传图片 → 识别风格 → 产出新 preset 进当前配方 ——

async def list_styles(request):
    return JSONResponse({"styles": STYLE.list_styles(R.get_active())})


async def import_style(request):
    data = await request.body()
    if not data:
        return JSONResponse({"error": "empty body（POST 图片字节）"}, status_code=400)
    label = request.query_params.get("name", "参考风格")
    mime = request.headers.get("content-type", "image/png")
    try:
        res = STYLE.import_from_image(R.get_active(), data, label, mime=mime)
        return JSONResponse(res)
    except Exception as e:  # noqa: BLE001
        return JSONResponse({"error": f"风格识别失败：{e}"}, status_code=400)


# —— 资料抽取：上传 PDF/Word/PPTX/Excel/HTML/文本 → Markdown，供 Context Pack 吸收 ——
# 统一用 markitdown（离线、多格式）；pdf 失败回退 pypdf；纯文本直接解码。
MAX_MATERIAL = 20000  # 截断上限，避免塞爆上下文


def _markitdown_text(data: bytes, name: str) -> str:
    suffix = os.path.splitext(name)[1] or (".pdf" if data[:5] == b"%PDF-" else ".txt")
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    tmp.write(data)
    tmp.close()
    try:
        from markitdown import MarkItDown
        return (MarkItDown().convert(tmp.name).text_content or "").strip()
    finally:
        os.unlink(tmp.name)


def _pypdf_text(data: bytes) -> str:
    import io
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(data))
    return "\n".join((p.extract_text() or "") for p in reader.pages).strip()


async def extract_text(request):
    data = await request.body()
    if not data:
        return JSONResponse({"error": "empty body"}, status_code=400)
    name = request.query_params.get("name", "")
    is_pdf = name.lower().endswith(".pdf") or data[:5] == b"%PDF-"
    is_text = name.lower().endswith((".txt", ".md", ".markdown")) or (
        not name and b"\x00" not in data[:1024])
    text = ""
    try:
        text = _markitdown_text(data, name)
    except Exception:  # noqa: BLE001
        text = ""
    if not text:  # 回退
        try:
            text = _pypdf_text(data) if is_pdf else (data.decode("utf-8", "ignore").strip() if is_text else "")
        except Exception as e:  # noqa: BLE001
            return JSONResponse({"error": f"解析失败：{e}"}, status_code=400)
    if not text:
        return JSONResponse({"error": "未能从文件抽出文本（可能是扫描件/纯图片，暂不支持 OCR）", "chars": 0, "text": ""})
    truncated = len(text) > MAX_MATERIAL
    return JSONResponse({"chars": len(text), "truncated": truncated, "text": text[:MAX_MATERIAL]})


# —— Run 产物（Phase 4a）：完成态真缩略图 + 内嵌预览 ——

async def list_runs(request):
    return JSONResponse({"runs": RUN.list_runs()})


async def run_plan(request):
    plan = RUN.get_plan(request.path_params["id"])
    if plan is None:
        return JSONResponse({"error": "not found"}, status_code=404)
    return JSONResponse(plan)


async def run_view(request):
    p = RUN.index_html_path(request.path_params["id"])
    if p is None:
        return JSONResponse({"error": "not found"}, status_code=404)
    return FileResponse(p, media_type="text/html")


# —— 导出（Phase 4b-1）：PDF + 逐页 PNG（Playwright+Chromium 渲染真实 HTML）——

async def export_pdf(request):
    rid = request.path_params["id"]
    p = await EXPORT.export_pdf(rid)
    if p is None:
        return JSONResponse({"error": "not found"}, status_code=404)
    return FileResponse(p, filename=f"{rid}.pdf", media_type="application/pdf")


async def export_png(request):
    rid = request.path_params["id"]
    p = await EXPORT.export_png_zip(rid)
    if p is None:
        return JSONResponse({"error": "not found"}, status_code=404)
    return FileResponse(p, filename=f"{rid}-png.zip", media_type="application/zip")


async def export_pptx(request):
    rid = request.path_params["id"]
    p = await EXPORT.export_pptx(rid)
    if p is None:
        return JSONResponse({"error": "not found"}, status_code=404)
    return FileResponse(
        p, filename=f"{rid}.pptx",
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation")


routes = [
    Route("/recipes", list_recipes, methods=["GET"]),
    Route("/recipes/active", set_active, methods=["POST"]),
    Route("/recipes/revalidate", revalidate, methods=["POST"]),
    Route("/extract", extract_text, methods=["POST"]),
    Route("/styles", list_styles, methods=["GET"]),
    Route("/styles/import", import_style, methods=["POST"]),
    Route("/recipes/import", import_recipe, methods=["POST"]),
    Route("/recipes/{id}", get_recipe, methods=["GET"]),
    Route("/recipes/{id}", save_recipe, methods=["PUT"]),
    Route("/recipes/{id}/fork", fork_recipe, methods=["POST"]),
    Route("/recipes/{id}/export", export_recipe, methods=["GET"]),
    Route("/runs", list_runs, methods=["GET"]),
    Route("/runs/{id}/plan", run_plan, methods=["GET"]),
    Route("/runs/{id}/view", run_view, methods=["GET"]),
    Route("/runs/{id}/export/pdf", export_pdf, methods=["GET"]),
    Route("/runs/{id}/export/png", export_png, methods=["GET"]),
    Route("/runs/{id}/export/pptx", export_pptx, methods=["GET"]),
]

app = Starlette(routes=routes)
