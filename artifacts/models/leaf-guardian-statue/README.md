# 叶冠守卫石像（第 6 项）

2026-10-29，已按用户截图只保留入口处的一座完整彩绘石像；另一座破损石像及其碰撞已移除。破损版工厂与 GLB 作为已有制作稿保留，不在游戏场景使用。

## 文件

| 文件 | 内容 |
|---|---|
| leaf-guardian-statue-intact.glb | 完整石像，2,213,644 字节 |
| leaf-guardian-statue-damaged.glb | 破损石像，2,291,408 字节 |
| intact / damaged-three-quarter.png | 两版实际模型斜视 |
| intact / damaged-front.png、side.png、back.png | 两版实际正面、侧面、背面 |
| scene-closeup.png | 游戏入口两侧组合近景，测试相机 |
| gameplay-entry.png、gameplay-390.png、gameplay-844.png | 游戏跟随镜头，桌面和手机横竖屏模拟 |
| metrics.json | 最终模型、GLB、碰撞、遮挡、通行及资源指标 |

## 模型与集成

设计依据为项目内置图像生成工具产出的 `artifacts/concepts/boss-courtyard/leaf-crown-guardian-statues-design-sheet-v1.png`，三叶冠、双手扶剑、胸背叶纹、石台、少量苔藓和垂藤延续庭院浅色石材。原始提示词与设定图同目录保存。此处使用图像设定 → 本地可编辑 Three.js 几何的流程，没有调用外部 3D 服务、下载第三方网格／贴图或新增依赖。

`src/leaf-guardian-statue.ts` 导出 `createLeafGuardianStatue(damaged=false)`。完整三叶冠与破损断冠、缺口肩甲采用不同的实体轮廓；头盔面罩是弯曲的带孔石壳，内衬后退约 0.25，顶盖朝外封闭。石剑有厚度并插入底座，背部也有护甲和叶纹。微小绿叶使用低面数实体，避免将叶冠雕刻的复杂几何用于细小装饰。

根据用户“缺少颜色，太单调”的反馈增加彩绘分区：浅米白石身，青绿矿物色叶冠／胸背叶纹／肩甲／中央裙片／膝甲，旧金色叶脉／盔边／剑饰／腕圈，深灰绿孔缝和灰褐断面。全部为哑光材质，没有新增纹理、几何或灯光。改色前截图及指标保存在 `before-color/`；原始设定图保留作为造型参考，当前配色以实际模型截图为准。

| 指标 | 完整 | 破损 |
|---|---:|---:|
| 宽 × 高 × 深 | 2.433 × 3.889 × 1.972 | 2.385 × 3.596 × 1.972 |
| 网格 | 12 | 12 |
| 三角形 | 20,376 | 21,096 |
| 材质种类 | 7 | 7 |
| 纹理 | 0 | 0 |

原点位于地面 y=0，正面朝 +Z。克隆共享源几何和材质；`statue-body`、`statue-helmet`、`statue-crown` 保留独立具名组用于检查。源文件只生成一次；现有相机遮挡系统在场内按容器私有化材质，避免石像间互相淡出。

`src/boss-courtyard-blockout.ts` 目前仅保留 `boss-blockout-statue-0`，完整石像位于世界 (169.5,0,-19)，沿用原 2.2 × 3.2 × 2.2 简单碰撞代理；上方肩甲和叶冠为视觉外形。原 (169.5,0,-11) 的破损石像容器和代理均已移除。码头、叶纹地面、Boss、巨剑和树根布局沿用既有位置。

## 验证与预算

- `npm run build` 通过，仍有既有大包体警告。
- `tests/leaf-guardian-statue.mjs` 检查两版有限几何／法线、实体身体、贴地、共享资源、真实孔洞深度、朝外封闭顶盖、断冠实际轮廓、两份 GLB 导出重载、非空像素、入口往返、两个底座碰撞、遮挡淡出、重置和桌面／手机尺寸截图。
- 生产 `tests/boss-courtyard-blockout.mjs` 检查只存在选中的完整石像，以及 116 个中央地面采样、6 段往返、8 向闪避、预警与遮挡。单体测试继续验证两份已有模型文件；运行时检查仅保留一座、原破损位置可通行且无隐形碰撞。
- 改色前生产 `tests/boss-arena.mjs` 已通过边界、9 段通行、Boss／钥匙、渡船往返及恢复／重置。本次仅改材质，不重复完整战斗回归；模型和生产庭院布局回归已重新通过。
- 单座入口镜头为 217 calls / 283,172 triangles；隐藏石像为 205 / 262,796。当前物理计数为 192 bodies / 265 colliders，重置后相同；本模型不包含纹理。
- 保留底座阻挡位置 x≈170.9998，遮挡时不透明度 0.16。原破损位置实际步行到 x≈167.8998、地面射线高度为 0，无残留碰撞。模型及生产布局回归通过，无捕获的 page / console / HTTP 错误。

本次按单体 12 网格、30,000 三角形以内控制，未新增灯光、着色器或后处理。入口总渲染量仍高于技能的手机起始建议预算，截图通过只证明布局可见；尚未进行手机真机性能测试。场景仍逐项替换，沿用固定镜头截图、像素烟测和玩法回归，暂不冻结像素比较基线。

## 工作流记录

- 已读取 Director、Graphics Builder、QA Release 与 Ponytail 技能；阶段参考包括 phase-playbook、model-recipes、render-recipes、technical-art、implementation-blueprint、visual-scorecard，及 procedural-model-quality、material-lighting-quality、performance-safe-visual-detail、qa-release-checklists、visual-verification、playtest-qa、release 检查表。
- 图像设定已有本地输出；本次完成模型、场景替换、GLB 导出和局部回归。UI、全局照明、音频、动画和其他清单道具不在本项范围。
- 没有发布、部署、生成交付 ZIP，也没有全关卡通关或手机真机性能结论。
