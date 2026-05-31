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


routes = [
    Route("/recipes", list_recipes, methods=["GET"]),
    Route("/recipes/active", set_active, methods=["POST"]),
    Route("/recipes/revalidate", revalidate, methods=["POST"]),
    Route("/recipes/import", import_recipe, methods=["POST"]),
    Route("/recipes/{id}", get_recipe, methods=["GET"]),
    Route("/recipes/{id}", save_recipe, methods=["PUT"]),
    Route("/recipes/{id}/fork", fork_recipe, methods=["POST"]),
    Route("/recipes/{id}/export", export_recipe, methods=["GET"]),
]

app = Starlette(routes=routes)
