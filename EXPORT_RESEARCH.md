# 导出方案调研（Phase 4b 选型）

> 调研 9 个开源 AI PPT 项目「结果如何呈现、如何导出」，为我们「HTML 精排版 deck + slide_plan.json」选导出路线。
> 克隆在 `.export-research/`（gitignore，不入库）。每条结论附代码出处。

## 一句话结论

**导出的两件事强弱分明：**
- **PDF / PNG 是已解决的问题**——所有正经项目都用「无头 Chromium 渲染 HTML → `page.pdf()` / `page.screenshot()`」，保真度 100%、代码极少。我们已有自包含 `index.html`，几乎零成本。
- **PPTX 是真难点，且「忠实 vs 可编辑」不是二选一，而是同一条管线的两档**——能映射成原生对象的（文字/形状/表）走可编辑，表达不了的（渐变/阴影/SVG/图表）一律栅格化成图。纯可编辑不可能 100% 还原网页主题。

## 三大流派（按对我们的参考价值排序）

### 1. 无头浏览器渲染 HTML（PDF/PNG 的唯一正解）
- **presenton**：Next 页面把每页强制 `1280×720` + `@page size + break-after:page`，Puppeteer `page.pdf()` 出 PDF。PNG 它没给 deck 导出。
- **PPTAgent / deeppresenter**：`webview.py` 逐页 `page.pdf(margin=0,scale=1)` → pypdf 合并 → `pdf2image(dpi=100)` 出 JPG。PDF/图**总会跑**（兜底）。
- **slideitin**：源是 Marp markdown，`marp-cli --pdf/--html`（底层还是 Chromium）。提醒：**一个 headless 渲染器能一锅端 pdf/pptx/png**。
- 对我们：**直接 `goto(file://index.html)` + 给打印态加 `@page size:1280×720; margin:0` + 每页 `break-after:page`，`page.pdf()` 出 PDF；逐页 `.slide` `screenshot()` 出 PNG。CSS 主题完美保真，无需起服务。**

### 2. 程序化重建「可编辑」PPTX（pptxgenjs / python-pptx + DOM 几何）
- **presenton**：给每个可导出元素埋 `data-element-type`/`data-text-content`，导出时浏览器里 `getBoundingClientRect`+`getComputedStyle` 抽几何样式 → python-pptx 建原生形状。README 明写 "Fully editable PPTX"。图表被当图片。**不用 LibreOffice**（它的 LibreOffice 仅服务「上传 PPTX 建模板」）。
- **PPTAgent `html2pptx.js`（~3000 行，基于 Anthropic Skills）**：`require('playwright')+pptxgenjs`。chromium 打开自包含 HTML → `extractSlideData` 遍历 DOM → 文字/形状/表走 pptxgenjs **原生可编辑对象**，渐变/阴影/SVG/圆角图 `page.screenshot` **局部栅格化成 PNG** 混入。处理了字体 fallback(CDP)、内联 runs、边框拆线、版式自适应。**这是「自包含 HTML → 可编辑 PPTX」的现成成熟解。**
- **ALLWEONE presentation-ai**（~4500 行导出子系统，pptxgenjs）：JSON 给语义 + DOM 给坐标。同样混合：文字/形状/表可编辑，图表/图标/带裁剪图截 PNG。**明确暴露丢失**：渐变→单色、精确字号丢失靠 `fit:shrink`、阴影/圆角/遮罩丢、自定义字体不嵌。
- 对我们：可编辑 PPTX **能做但贵**（数千行）且**保真有损**（我们 teaching-clean 等主题的渐变/阴影会丢或被栅格化）。优势是我们有 `slide_plan.json`，可按有限的 `layout_type` 用**预定义占位坐标**映射，比它们反解 DOM 省一个数量级。

### 3. 纯数据 → python-pptx（最省，但观感裸）
- **ai-ppt-slide-generator / pdf-to-slides-tutorial / svendotdev**：空白 `Presentation()` + 内置 `slide_layouts` 的 placeholder，按 type 填字。100–300 行、**完全可编辑**，但**白底系统字、无主题配色**——无法还原我们的 HTML 主题。三者都**没有 PDF/图片导出**。
- **ai-forever/slides_generator**：天花板最高——空白页 + 整页 AI 背景图垫底 + 半透明文字框 + `fit_text` 自动字号，「海报感」。但本质是「把视觉烤进图片」，与可编辑矛盾。

## 关键判断

| | 实现成本 | 保真度 | 可编辑 | 依赖 |
|---|---|---|---|---|
| PDF（Chromium `page.pdf`） | 极低 | 100% | — | Playwright+Chromium |
| PNG（Chromium `screenshot`） | 极低 | 100% | — | 同上（零增量） |
| **PPTX 图片忠实版**（每页 PNG 铺满 → python-pptx `add_picture`） | **低（~30 行，搭在 PNG 上）** | **100%** | 否（可移动/批注/放映） | 同上 + python-pptx(轻) |
| PPTX 可编辑版（html2pptx.js 路线） | 高（数千行/或移植 PPTAgent） | 有损（渐变/阴影/图表退化） | 是（可改字） | 同上 + Node + pptxgenjs |
| PPTX 纯数据版（python-pptx from plan） | 中（策略模式 ~200 行） | 极低（丢主题） | 是 | python-pptx |

- **LibreOffice：不需要**（体积大、`soffice --convert` 要全局文件锁、串行慢；presenton 也只在模板导入用它）。
- **没有「既保真又可编辑」的免费午餐**——这是全行业共识。

## 推荐给我们的路线

**统一用 Playwright+Chromium 作唯一渲染原语**（单机装一次，预览/截图也能复用）：
- **4b-1（现在）**：PDF + PNG + **PPTX 图片忠实版**。三种格式一个引擎产出，保真 100%、代码少。PPTX 用 python-pptx 把每页截图铺满 16:9。**保住我们的设计是核心卖点。**
- **4b-2（可选，看 4b-1 后再定）**：「可编辑版 PPTX」作为第二个按钮，移植 PPTAgent 的 `html2pptx.js`（Node+pptxgenjs）。接受其保真退化。

> 理由：我们的差异化正是「精心设计的 HTML 主题 deck」，保真优先于可编辑；且单机 MVP 要低复杂度。忠实版用一个引擎一锅端三格式；可编辑版作为后续增量，且行业证明它在富 CSS 主题上必然有损。
