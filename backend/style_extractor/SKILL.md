# style-extractor · 风格提取 skill（视觉模型）

把一张**参考图片**（截图 / 设计稿 / 别人的幻灯片图）变成一套**可用于生成的视觉风格**。

## 做什么
1. 用多模态视觉模型（火山方舟 `Doubao-Seed-2.0-lite`，见 `.env: ARK_VISION_MODEL`）看图，输出结构化风格 JSON（配色 / 字体气质 / 密度 / 版式 / 气质）。提示词在 [`PROMPT.md`](./PROMPT.md)，可改。
2. 把风格落成一套**新风格三元组**，写进**当前配方的拷贝**（不碰只读上游 skill）：
   - `assets/style-presets/imported-<slug>.json` —— preset 语义档（含 color_palette / 字体 / density / mood）。
   - `assets/styles/imported-<slug>.css` —— 复制气质最接近的内置骨架（sans→teaching-clean / serif→editorial-magazine / handwriting→sketch-notes），只替换 `:root` 的 7 个 `--asp-*`（配色+字体）。
   - 放开该配方 `schemas/style_lock.schema.json` 的 `style_name`（enum→pattern），让导入风格能过校验。
3. 之后生成时选 `style_name = imported-<slug>` 即用此风格。

## 诚实边界（v1）
- **能学到**：配色、字体气质、密度倾向、整体 mood。
- **学不到**：精确版式/间距/网格——CSS 是整文件、版式写死在内置骨架里，导入风格**继承最接近骨架的版式**，只换色与字。
- **只做图片**（先不做 PPTX 主题解析）。扫描件/低清图可能取色不准。

## 入口
- 逻辑：`backend/style_import.py`（`analyze_image` / `emit_style`）。
- HTTP：`POST /api/styles/import?name=<标签>`（图片字节）→ 返回新 `style_name`；`GET /api/styles` 列可用风格。
