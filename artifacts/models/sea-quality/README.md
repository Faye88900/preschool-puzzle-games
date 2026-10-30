# 第三关局部海湾水面优化（2026-10-27）

## 第三轮：让海浪推进可以直接看见

用户反馈第二轮仍缺少海浪运动感：0.12 的几何起伏和约 9 秒的主浪周期，在正常镜头里主要表现为细纹与反光变化。当前版本为 `ferry-bay-v5`。

- 三组实际顶点波浪合计最大振幅从 0.12 提升到 0.47，主浪周期约 3.9 秒；岸边衰减保持登船区平缓。
- 浪脊的明暗、泡沫和法线随同一波形推进。采样点 `(120,-15)` 在 4 秒内峰谷差为 0.6501 个游戏单位。
- GPU 的两个着色阶段与小船 CPU 高度采样共用同一组波浪参数；小船停靠和航行时均随浪升降，乘客同步。海浪时钟在小船采样之前更新，避免船与海面错开一帧。
- 暂停、对话和减弱动态模式保留原来的停止规则；相同时间仍逐像素复现。船仅作单点升降，没有新增倾斜或物理浮力系统。
- 保留局部海湾、海平面、航线、岛屿、碰撞和渲染资源数量；海面仍为一次绘制。

修改前源码在 `motion-before/`，新截图、数据及动图在 `motion-after/`。`sea-motion.gif` 是 800×500 的固定机位连续游戏画面，40 帧、每帧 100 毫秒，共 4 秒游戏时间；采集时保持航程位置，仅推进海浪以便观察。它不代表真实设备帧率。

`npm run build`、`tests/ferry-coast.mjs`、`tests/wind-sail-boat-production.mjs` 均通过：波幅、海面动画、船高同步、乘客位置、暂停冻结、减弱动态、重置及桌面/手机视口往返正常，无捕获错误。单点船高误差小于 1e-6；渲染采样仍为 77 次绘制 / 128,616 三角面 / 32 张纹理。构建产物包含 `ferry-bay-v5`。未部署、更新 ZIP 或测试实体手机性能。

复现动图帧可在既有海面测试中设置 `COAST_CAPTURE_MOTION=1`，PNG 输出到 `COAST_OUTPUT/motion-frames/`。动图由这 40 帧原始截图编码，未生成或替换画面内容。

## 第二轮：参考 Water Pro 官方演示

已通过浏览器查看用户提供的 [官方产品页](https://threejsroadmap.com/assets/threejs-water-pro) 和 [公开演示](https://www.threejswaterpro.com/)，观察默认场景与明亮的 Sea of Thieves 演示预设；仅作视觉观察，没有获取或使用付费代码、贴图或预设参数。

本轮修改前源码与截图在 `water-pro-before/`，修改后在 `water-pro-after/`。当前实现为 `ferry-bay-v4`：

- 降低细碎法线强度，让连续长浪更清楚；最大起伏从 0.08 调为 0.12，保持海平面与小船位置。
- 基于已知岸线距离近似水深，采用按颜色通道的指数衰减，丰富浅绿到深蓝的过渡；这不是场景深度折射。
- 根据长浪高度生成低覆盖率的波峰泡沫，增加波峰透光色。
- 提高低视角反光，使用原有数据纹理近似柔和天空云光；这不是场景物体倒影。
- 海面仍为一次绘制，未增加网格、三角面、纹理或渲染通道；同机位仍为 77 次绘制 / 128,616 三角面 / 32 张纹理。

`npm run build` 与 `tests/ferry-coast.mjs` 通过，水面动画改变 23,961 个采样像素，回到同一时间逐像素复现；暂停、减弱动态、重置、往返航程与手机视口触控均通过，无捕获错误。构建包已确认包含 `ferry-bay-v4`；`tests/wind-sail-boat-production.mjs` 也已通过最终构建的实际时钟出航、暂停、触控返航、乘客位置及重置，无捕获错误。未迁移为 Water Pro 的完整 FFT/浮力/水下系统，未测实体手机帧率。

以下为第一轮记录；其中 `after/`、0.08 波幅和 `ferry-bay-v3` 指第一轮快照。

范围为 `src/ferry-coast.ts` 的海面材质；保留 90×70 海湾、岸线、空岛云层、海平面、码头碰撞、守卫岛位置和 9 秒渡船航程。修改前源码与同机位截图保存在 `before/`，修改后在 `after/`。

## 画面与实现

- 用一张本地生成的 128×128 周期波纹斜率数据贴图，按三种尺度和方向流动，替代原来成排短线状高光；开启 mipmap，远处细纹逐渐衰减。
- 三组低幅长波控制海面起伏，法线跟随长波变化，最大位移 0.08；包围球同步扩展。
- 深水蓝绿、浅水透绿，岸边增加打散的双层浪沫与轻微水光。
- 视角相关的 Fresnel 天空反光，继续使用标准材质的场景灯光、阳光高光、阴影和雾。
- 天空反光为解析近似，未增加场景镜面反射或水下折射通道。船、树、码头不会生成真实倒影。
- 数据贴图随材质 dispose 释放；未新增依赖或下载资源。

参考用户提供的 [three.kt](https://github.com/markaren/three.kt)：其 README 说明为桌面 JVM 的 Three.js 移植并支持水面 shader。仓库内部 Water 源文件未成功取得，具体多尺度法线与 Fresnel 设计参照项目已安装的 `three/examples/jsm/objects/Water.js`；本次未引入 Kotlin/JVM 或复制其代码。水面是数学数据与着色器，本次不需要生成插画或新建 3D 资产。

## 同机位成本

| 指标 | 修改前 | 修改后 |
| --- | ---: | ---: |
| 绘制次数 | 77 | 77 |
| 三角面 | 128,616 | 128,616 |
| 已分配几何体 | 637 | 637 |
| 已分配纹理 | 31 | 32 |
| 海面绘制次数 | — | 1 |
| 海岸组网格/三角面 | 9 / 16,760 | 9 / 16,760 |

采样为桌面海湾俯视机位、DPR 1；项目运行时 DPR 上限 1.5、单个 2048 阴影图，未新增后处理。637 个已分配几何体属于现有整关资源，超过技能的一般参考预算，本次没有增加。新增贴图含 mipmap 约 85 KiB。数据不代表真机帧率或整关最差机位。

## 验证

- `npm run build` 通过；保留现有大包提示。
- `node tests/ferry-coast.mjs` 通过：真实像素随时间变化（21,637 像素），回到同一时间完全复现；纹理通道范围 82–171、重复采样和 mipmap 正常，海面仅一次绘制。
- 同一测试覆盖物理海岸与海湾边界、登船口、露出木桩、原有空岛高度、键盘出航、触控返航、暂停、减弱动态效果与重置；桌面 1280×800、手机视口 390×844；无捕获到的页面、控制台或 HTTP 错误。
- `node tests/wind-sail-boat-production.mjs` 通过：构建产物真实时钟的水晶登船条件、键盘出航、暂停、触控返航、乘客位置与重置正常，无捕获错误；结果见 `../wind-sail-boat/production/`。构建包包含新的 `ferry-bay-v3` 着色器。
- 复用现有确定性像素与航程验收，新增纹理数值和绘制预算断言；未建立跨 GPU 截图差异阈值，也未新增整关机器人。

运行时设置 `PLAYWRIGHT_MODULE` 为已安装 Playwright 的模块 URL、`PLAYWRIGHT_BROWSERS_PATH` 为浏览器目录；`TEST_URL` 默认 `http://127.0.0.1:5212/`，`COAST_OUTPUT` 可指定截图和报告目录。

## 已读取的技能参考

全部位于 `C:/Users/yongting/.codex/skills/`：

- `threejs-aaa-graphics-builder/references/implementation-blueprint.md`
- `threejs-aaa-graphics-builder/references/render-recipes.md`
- `threejs-aaa-graphics-builder/references/technical-art.md`
- `threejs-aaa-graphics-builder/references/shader-cookbook.md`
- `threejs-aaa-graphics-builder/references/checklists/material-lighting-quality.md`
- `threejs-aaa-graphics-builder/references/checklists/performance-safe-visual-detail.md`
- `threejs-qa-release/references/qa-release-checklists.md`
- `threejs-qa-release/references/checklists/visual-verification.md`
- `threejs-qa-release/references/checklists/playtest-qa.md`
- `threejs-qa-release/references/checklists/release.md`

本次为限定海面材质优化，不作整关 AAA、整关通关或发布完成声明。未部署、更新 ZIP 或测试实体手机性能。
