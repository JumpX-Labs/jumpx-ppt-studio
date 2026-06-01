# recipe_seed · 内置配方的展示元数据种子（入库）

> 重要：**Skill 本体（`ai-slide-producer`）已经是"修好的新版"**——厚内容（05-writer/
> 03-strategist 深度教学版）+ 模型直接写 HTML（08-web-renderer）都已烤进上游 Skill。
> 所以**内容/版式的唯一来源 = 基座 Skill**，这里不再覆盖任何 reference。

`recipes.py::_seed_from_base` 从 base skill 拷出内置配方后，叠加 `recipe_seed/<rid>/`：

- `manifest_overrides.json` —— 合并进 manifest 的展示/密度字段（白名单见 `recipes.META_FIELDS`）。
- （可选）`references/*.md` —— 若需让某内置配方偏离基座，可在此放覆盖；当前 default 不放，
  因为基座本身就是想要的默认效果。

## default
仅覆盖展示元数据（`density=2`、persona 文案），内容/版式完全继承基座 Skill。
基座 = 单一来源，保证「站点展示 / 客户下载 / Web App 运行」三者一致。

> 运行时用户在配方页对 default 的编辑写入 `workspace/recipes/default/`（运行态），不回写这里。
