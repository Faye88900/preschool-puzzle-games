# 古树广场：现有模型接入

后续更新（2026-10-19）：已按环树座椅设计图新增 `src/tree-bench.ts`，替换此页原先记录的两张广场直长椅。新模型、四视图和详细检查见 `artifacts/models/tree-bench/README.md`；本页下方指标保留为接入现有模型阶段的基线。未制作其余缺少的新模型，也未打包 ZIP。

2026-10-19。按用户要求参考美化设计图，先接入当前项目已有模型；缺少的新模型留待后续制作。用户明确要求不打包 ZIP，因此没有创建或更新压缩包。

## 对应设计图的改动

- 古树移动到广场内部；使用项目已有 `createGardenShadeTree()` 处理橡树外观，原树干碰撞尺寸不变。树冠保留独立遮挡淡出与恢复，计算遮挡范围前先更新世界变换。
- 树下设置两张现有木长椅，左侧搭配已有藤格架，左右配置现有花盆；枝下放置现有木风铃。
- 利用现有石砖路模型形成环形铺地。只对本广场私有几何副本调整暖色顶点色；原 GLB 和其他区域的铺地不改。
- 外围补充已有橡树、灌木、木框花坛、矮花与叶丛，并加入项目已有路灯。低矮植物及铺地按材质合并成 12 个绘制批次。
- 古树后偏左的出口位置不变；出口后增加短通路、移除前方封墙，通关触发点移到草地内。弯曲远景道路继续延伸，门后不再是终点死角。三种语言的开门提示同步改为沿路走出。
- 园丁区现有花车、鸟浴盆、小鸟、种花任务及主线桥／钥匙顺序保留。

未制作环树弧形座椅、带顶藤架、风叶路标、弧形花坛模块；没有新增下载模型、生成模型、纹理或依赖。

## 本次修改范围

- `src/maze.ts`：广场摆放、现有路灯加载、合并绘制、碰撞及树冠遮挡。
- `src/maze-map.ts`：古树位置、门后通路及通关点。
- `src/maze-ground.ts`：出口后的平滑弯曲景观道路与连续地面接缝。
- `src/maze-text.ts`：开门后的三语提示。
- `public/models/SOURCES.md`：记录原有模型复用和未制作内容。
- `tests/plaza-dressing.mjs`：新增广场定向检查。
- `tests/maze-ground.mjs`：地面表面数包含延伸道路。
- `tests/garden-building-visibility.mjs`：从按数组序号定位遮挡物改为定位具体棚屋，继续检查淡出过渡。

## 检查记录

- `npm run build` 通过。仍有项目既有的大体积 bundle 提示；本次未调整打包结构。
- `tests/plaza-dressing.mjs` 通过：几何有限性、12 个合并批次、连续道路朝上法线、钥匙／桥锁门顺序、两张长椅实际碰撞、从广场走到关闭大门、开门后步行出围合区域通关、树冠淡出恢复、暂停恢复与重置资源数。
- `tests/maze-ground.mjs` 通过：纹理、世界 UV、草边朝向、浮岛几何、重置及桌面／手机视口。
- `tests/garden-building-visibility.mjs` 通过：独立材料、棚屋／小屋遮挡、平滑恢复及手机视口。
- `tests/maze-browser.mjs` 通过：移动、园丁找铲子／种花任务、魔杖、桥、宝箱、守卫、钥匙、恢复、通关、重置、手机对话及暂停。该脚本包含定点移动，不等同于全程连续手动游玩。
- `artifacts/plaza-production-smoke.mjs` 通过：最终构建预览的桌面 1280×800、竖屏 390×844、横屏 844×390、暂停恢复、资源加载和测试对象未暴露检查；未捕获页面、控制台或 HTTP 错误。结果保存在 `test-results/plaza-production/report.json`。

固定广场总览机位（1440×900）改动前后：

| 项目 | 改动前 | 改动后 |
|---|---:|---:|
| 绘制调用 | 922 | 969 |
| 三角形 | 628364 | 752008 |
| GPU 几何数 | 364 | 383 |
| 纹理数 | 24 | 24 |
| 物理刚体／碰撞体 | 125 / 126 | 132 / 133 |

最终定向测试采样到 147 种 canvas 像素值，画面非空；测试中没有捕获控制台、页面或 HTTP 错误。以上是本地浏览器记录，不是实际手机 FPS 或显存测试。

## 截图与预览

- `test-results/plaza-before/desktop.png`、`overview.png`：改动前。
- `test-results/plaza-after/desktop.png`、`overview.png`：游戏镜头及总览。
- `test-results/plaza-after/mobile.png`、`landscape.png`：390×844 与 844×390。
- `test-results/plaza-after/exit-open.png`、`finish.png`：开门后的道路与走出后通关。
- `test-results/plaza-production/`：构建预览截图及报告。
- 开发版：`http://127.0.0.1:5218/?level=3&lang=zh`。
- 构建预览：`http://127.0.0.1:5219/?level=3&lang=zh`。

复跑时设置 `TEST_URL`、`PLAYWRIGHT_MODULE` 与 `PLAYWRIGHT_BROWSERS_PATH`，顺序运行上述脚本，避免多个 WebGL 浏览器争用资源。

## 验证范围与参考

- 已读：threejs-qa-release 的 `qa-release-checklists.md`、`checklists/visual-verification.md`、`checklists/playtest-qa.md`、`checklists/release.md`、`visual-test-harness.md` 和 `checklists/visual-test-harness.md`。
- 视觉检查沿用项目现有冻结动画、实际截图和像素抽样方式；本轮仍在分阶段接入美术，未建立永久逐像素金图比较。
- 没有新建通用自动通关系统；沿用现有任务链脚本，并为新增广场执行真实步进碰撞／出口通关检查。
- 未部署、未测试实体手机、未打包 ZIP。`public/images/cover.png` 和原 `bean-rush.zip` 未改动。
