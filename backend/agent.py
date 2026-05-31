"""阶段 3 · AI Slides WebApp 的 deep agent。

架构（按"把 skill 的代码依赖解耦到 web 层"的方向）：
- ai-slide-producer skill 挂进 FilesystemBackend，作为**纯知识/资产**（工作流、schema、
  模板、CSS）。agent 读它来知道"怎么做"。
- skill 原本靠 shell 脚本承担的"执行/调 API"职责（build_html.py / generate_images.py /
  probe_image_backend.py）上移为 web 层工具（见 slide_tools.py），进程内运行，
  不让 agent shell out，密钥只留后端。
- 两个交互点（选模板 / 出图vsHTML）用 deepagents 的 interrupt_on 实现。

model：火山引擎方舟（Ark，OpenAI 兼容）。
"""

import os

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from deepagents import create_deep_agent
from deepagents.backends import FilesystemBackend

from setup_workspace import ensure_workspace
from slide_tools import SLIDE_TOOLS

load_dotenv()

# 确保 workspace/skills/ai-slide-producer 就位（幂等）。
WORKSPACE = ensure_workspace()

model = ChatOpenAI(
    model=os.environ.get("ARK_MODEL", "ark-code-latest"),
    base_url=os.environ["ARK_BASE_URL"],
    api_key=os.environ["ARK_API_KEY"],
    temperature=0,
)

# 真实磁盘后端：virtual_mode 给 agent 一个干净的、限定在 workspace 内的虚拟根。
# agent 的 read_file/write_file 直接落到 workspace 真实磁盘，build 工具据此读写。
backend = FilesystemBackend(root_dir=str(WORKSPACE), virtual_mode=True)

SYSTEM_PROMPT = """\
你是 Jumpxai 的 AI Slides 生产 agent，运行在一个 WebApp 里。你的工作流知识来自挂载的
**ai-slide-producer** skill（在 /skills/ai-slide-producer/）。开始任务时，先 read_file
读 /skills/ai-slide-producer/SKILL.md 了解九步管线与门禁，需要时再读 references/ 与
schemas/ 下的细则与 JSON Schema。

【本 WebApp 的执行方式（覆盖 skill 里的 shell 脚本指令）】
本环境**没有 shell**，禁止尝试 `execute` / 运行 python 脚本。skill 文档里凡是让你
`python3 scripts/xxx.py` 的地方，一律改用下列已为你准备好的工具：
- 生成 HTML 幻灯片 → 调用工具 `build_slides_html`（替代 build_html.py）。
- 出图 → 调用工具 `generate_image`（替代 generate_images.py；图片 API 在 web 后端）。
- 不需要探测图片 backend（probe_image_backend.py）；`generate_image` 会直接告诉你是否可用。

【两个必经的交互点（停下来问用户）】
1. 选模板：在确定视觉风格 / 写 style_lock 之前，必须调用工具 `choose_template`，
   传 2-3 个你推荐的 preset id，由用户拍板。
2. 出图还是 HTML：在渲染之前，必须调用工具 `choose_render_mode`，由用户拍板。
这两步会暂停等用户响应，拿到结果后再继续。用户不选时：模板默认 teaching-clean，
形态默认 html。

【工作目录约定】
- 每个任务用一个 slug 作为工程名，所有中间产物写到 /runs/<slug>/source/ 下：
  project_brief.md、outline.md、slide_plan.json、style_lock.json 等（用 write_file）。
- slide_plan.json / style_lock.json 的结构**严格遵循** /skills/ai-slide-producer/schemas/
  下的 schema；可参考 /skills/ai-slide-producer/assets/examples/teaching-clean-demo/source/
  里的真实样例来对齐字段（尤其 deck_meta、pages[].layout_type、on_slide_text、image_requirement）。
- layout_type 必须取自 skill 的 layout 片段名（cover/big-idea/two-column/comparison/
  framework/timeline/quote/image-text/section-divider/closing）。
- 最终调用 `build_slides_html("<slug>")` 生成 /runs/<slug>/index.html，并把该路径作为
  可见产物交给用户。

【本轮范围（脚手架，别过度）】
- 用 write_todos 先列计划再推进。
- deck 控制在 4-6 页即可，跑通端到端比页数多更重要。
- 默认走 teaching-clean + HTML 路径，确保无需图片 key 也能产出可见 slides。
- 响应语言匹配用户输入。
"""

agent = create_deep_agent(
    model=model,
    tools=SLIDE_TOOLS,
    system_prompt=SYSTEM_PROMPT,
    backend=backend,
    skills=["/skills/ai-slide-producer"],
    interrupt_on={
        "choose_template": {"allowed_decisions": ["approve", "respond"]},
        "choose_render_mode": {"allowed_decisions": ["approve", "respond"]},
    },
)
# 注意：langgraph dev 托管下不传 checkpointer，持久化（interrupt 所需）由平台自动提供。
