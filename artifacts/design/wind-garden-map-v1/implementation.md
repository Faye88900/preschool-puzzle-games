# 风语花园局部地图 · 实现与验证

此页记录第一版。后续地图扩建、路线长度和花坛位置调整见同目录 `expansion.md`，当前截图与检查结果位于 `test-results/wind-garden-expanded/`。

用户已明确要求按参考图直接修改游戏地图。本目录的 `plan.md` / `map.svg` 是前一轮方案资料，本文件描述后续实际实现。

## 实现范围

- `src/maze-map.ts`：将第二只盾兵周边的窄走廊改为左侧花坛入口、3×3 格庭院、右侧凉亭支路及可走码头，保留通往 checkpoint 和后续钥匙守卫的连接。
- `src/wind-garden.ts`：石板庭院、藤蔓拱门、残柱、路边睡脸花坛、开敞圆顶凉亭、池塘、护栏木码头及停泊帆船。沿用项目材质、花朵、圆角形体与静态几何合批；没有新增依赖或网络资产。
- `src/maze.ts`：整合实体碰撞与骑士避障、局部低绿篱、建筑遮挡淡出；拱门和凉亭按真实网格命中判断遮挡，避免把空心开口误认为遮挡。藤蔓与其石柱一起淡出。
- `tests/wind-garden-map.mjs`：连接和锁、实际输入状态驱动的物理通行、花坛碰撞、码头行走/跳跃边界、盾兵挡风/受击、宝箱、暂停、重置与响应式截图。

参考图中的花儿唤醒/合唱、问答、风帆晶石与乘船没有加入。当前宝箱仍沿用已有开启和恢复活力逻辑，帆船是场景物件。

## 玩家体验与关卡约定

玩家沿石块指引进入花坛缓冲区，选择进入开阔庭院应对盾兵或走右侧回环探索；庭院后以凉亭和宝箱提供休息点，再接回后续路线。盾兵的举盾、出击、喘息时机与生命值不变。熟练玩家可利用空地侧移，等待破绽施放风魔法。失败沿用现有恢复与检查点逻辑。

入口缓冲 → 盾兵压力 → 凉亭休息 → 后续守卫。主路约 5 单位宽，庭院约 15×15 单位；花坛偏离中央走位线，绿篱在局部降为 1.55 单位并匹配碰撞高度。建筑与花坛碰撞另用简单代理体。

## 已通过的局部检查

- TypeScript 编译与 Vite 构建通过；保留原有大包提示。
- `tests/wind-garden-map.mjs` 通过；详细证据位于 `test-results/wind-garden-map/report.json`。
- `tests/maze-browser.mjs` 整体流程回归通过：移动、花匠任务、放桥、首只骑士开门、宝箱、后续守卫、钥匙、伤害恢复、出口通关、重置、手机对话和暂停；含真实键盘与触控操作、状态加速辅助，浏览器错误为零。
- 14 段通路使用实际运动输入状态与 Rapier step 行走，覆盖入口、花坛、拱门、庭院、凉亭、码头、checkpoint 和后续守卫入口。
- 关闭桥时无法到达后续区域；有钥匙并开启出口后可达终点。
- 第二只盾兵举盾时挡风，喘息时可受两次攻击；宝箱与重置正常。
- 玩家走动和跳跃不能穿出码头护栏；花坛同时阻挡玩家与骑士。
- 桌面 1280×800、手机竖屏 390×844、横屏 844×390 截图及非空画布像素检查通过；浏览器 page/console/HTTP 错误为零。
- Rapier 沿用 1/120 固定步长；176 bodies / 245 colliders，重置前后数量一致。玩家保留 CCD。
- 新场景静态合批为 46 meshes / 75,030 triangles。庭院桌面视角为 219 calls / 188,576 triangles；改版前同固定世界视角为 203 calls / 122,110 triangles。俯瞰图包含大部分第三关，不能代表手机日常视角的渲染负载。

## 验证边界

这次是局部地图与场景实现。自动检查包含状态加速和输入状态驱动的物理通行，不等同于人工从头游玩或真实手机性能测量。没有发布、部署或更新 ZIP。没有新增音频。截图检查是确定状态下的视觉与像素冒烟检查，没有建立长期跨设备像素差分基线；本轮布局仍处于用户视觉验收阶段。没有添加自动游玩代理或难度评估系统。

## 技能参考记录

已读取并应用（无读取失败）：

- `level-design/SKILL.md`：动线、缓冲区、遭遇空间及尺度。
- `ponytail/SKILL.md`：复用现有材质、几何与碰撞流程，不新增依赖。
- `threejs-gameplay-systems/references/gameplay-workflows.md`。
- `threejs-gameplay-systems/references/game-design-level-design.md`。
- `threejs-gameplay-systems/references/physics-engine-selection.md`。
- `threejs-gameplay-systems/references/checklists/game-design-level-design.md`。
- `threejs-qa-release/references/qa-release-checklists.md`。
- `threejs-qa-release/references/checklists/visual-verification.md`。
- `threejs-qa-release/references/checklists/playtest-qa.md`。
- `threejs-aaa-graphics-builder/references/checklists/procedural-model-quality.md`。
- `threejs-aaa-graphics-builder/references/checklists/material-lighting-quality.md`。
- `threejs-aaa-graphics-builder/references/checklists/performance-safe-visual-detail.md`。
