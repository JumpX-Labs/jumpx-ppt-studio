# 文件解析 + 风格导入 调研纪要

> 针对：① 多格式资料解析(PDF/Word/PPTX/Excel…)② 从 PPTX/图片导入视觉风格。
> 约束：单机 / Docker(playwright/python:noble, 3.12) / 离线优先 / 已装 pypdf·python-pptx·playwright·Pillow。

## ① 内容解析 → markitdown（主选）

- 安装：`pip install "markitdown[pdf,docx,pptx,xlsx]"`（不要 `[all]`，避免 azure/audio）。
- MIT、~135k★、活跃(0.1.6, 2026-05)。**核心零 ML 依赖**；Docker **零额外系统库**；文档类**全离线**。
- 覆盖：PDF(pdfminer.six+pdfplumber) / docx(mammoth) / **pptx(python-pptx，逐页抽文本+标题+表+备注)** / xlsx(pandas+openpyxl) / html / csv/json/xml / txt/md。统一 `MarkItDown().convert(path)` → Markdown。
- 图片：**只 EXIF + LLM caption，无离线 OCR** → 扫描件/图片文字留 v2（离线 OCR 首选 tesseract，体积大）。
- 与现有：pptx 复用 python-pptx；pdf 用 pdfminer 而非 pypdf（pypdf 留作切页/页数回退）。markitdown 做**统一入口**，取代当前窄 `/extract`。
- 替代品：docling(IBM，表格最佳但依赖 torch+模型 ~2GB)、unstructured(系统库多/慢)、llama-parse(云，违反离线)。均不如 markitdown 适配我们约束。

## ② 风格导入 → PPTX(python-pptx) + 图片(Pillow)

### 我们的"风格" = 三元组（同一 style_name 绑定）
- `assets/style-presets/<name>.json`：语义档（mood/texture/typography/density/color_palette 对象/layout_bias/image_style_description/negative_constraints）。
- `assets/styles/<name>.css`：真落地，`:root` 声明 `--asp-bg/-surface/-ink/-muted/-accent/-accent-soft/-line/-font-heading/-font-body/-radius/-shadow`，版式/字号写死在 selector。
- `style_lock.json`：单次锁，Designer 从 preset 拍平生成；`build_html.css_vars()` 只注入覆盖 **7 个** `--asp-*`(bg/ink/accent/muted/line/font-heading/font-body)，其余版式继承 CSS。

### PPTX 能抽（python-pptx + lxml，实测通）
- 配色：解 master 的 theme part XML → `a:clrScheme`(dk1/lt1/accent1-6；sysClr 读 lastClr)。映射 bg←lt1 / ink←dk1 / accent←accent1 / palette←accent1-6。
- 字体：theme `a:fontScheme` major/minor(latin/ea) → font_heading/font_body（补我们兜底栈）。
- 尺寸：`slide_width/height`(EMU)→ 宽高比/px。
- 密度：master `p:txStyles` 字号估算（正文≥28pt→low，<20pt→high）。

### 图片能抽
- 配色：Pillow `quantize(8, FASTOCTREE)` + getcolors 取主色板，按占比分配 bg/ink/accent + WCAG 对比校验回退。**零新依赖**。
- 字体：**反推具体字体不可行** → 让用户选 serif/sans/handwriting。
- 气质/密度：需多模态 LLM 看图（ark-code-latest 大概率不支持）→ v1 跳过，用默认 medium。

### 映射 & 数据流
上传 → analyze(PPTX 解 XML / 图片取色) → normalize(角色分配+对比校验+字体兜底+枚举对齐) → emit 到**当前 recipe 拷贝**的 `assets/style-presets/imported-<slug>.json` + `assets/styles/imported-<slug>.css`(复制最近内置 CSS 骨架，只换 7 个 `--asp-*`) + 注册 style_name → Designer 选用 → build_html 加载。沿用 recipe「锁定基座 + 可改层覆盖」，不碰上游 skill。

### 两个硬约束
1. **风格 = 配色+字体可学，版式气质学不到**：v1 导入风格 = 把抽到的配色/字体套到最接近的内置版式骨架（无衬线→teaching-clean / 衬线→editorial-magazine / 手写→sketch-notes）。
2. `style_lock.schema.json` 的 `style_name` 是封闭枚举(7) → 导入会校验失败。需放开为 pattern；只改**配方自己的 schema 拷贝**，上游只读不动。

### 工程量
- PPTX 抽配色+字体+尺寸+密度：~150 行解析脚本，无新依赖（lxml 随 python-pptx）。
- 图片取色：~50 行 Pillow，无新依赖。
- + schema 枚举放开（recipe 拷贝）+ CSS 骨架复制逻辑 + 前端「样式导入」按钮。

## 待确认决策点
1. 内容解析采用 markitdown？（推荐 yes）
2. 风格导入 v1 范围 + 接受"配色/字体套内置骨架"的局限？
3. 图片气质判定需要多模态——ark-code-latest 不支持；是否提供视觉 model id，否则图片只做配色。
