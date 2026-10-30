# 庭院叶纹徽碑与断石

2026-10-29。按已确认 `artifacts/concepts/boss-courtyard/leaf-emblem-stele-design-sheet-v1.png` 完成独立模型并接入庭院。

## 本地资产与预览

- `leaf-emblem-stele.glb`：自包含静态 GLB，1,069,072 字节，导出后重新加载核对几何、边界、材质配色和内嵌贴图。
- `three-quarter.png`、`front.png`、`side.png`、`back.png`：完整单体；`leaf-carving.png`、`broken-crown.png`：凹雕和断口细节。
- `scene-closeup.png`、`stele-closeup-390.png`、`stele-closeup-844.png`：游戏内桌面和手机尺寸展示镜头，未改游戏相机。
- `metrics.json`：结构射线、GLB、场景接入、碰撞、绕行、遮挡及重置数据。

## 实现

`src/leaf-emblem-stele.ts` 为独立缓存工厂。主碑为厚浅色旧石，右上肩是真实贯穿厚度的缺角，不用灰色贴片伪装缺损；断边独立灰褐断面。正面三片青绿叶纹位于实际凹腔中：厚石背板上安装带叶孔及卷风孔的浅石面层，嵌片表面比石面低约 0.034。三叶之间保留实体石缝，旧金细叶脉、下部卷风槽和少量裂纹、苔藓形成庭院纹样。

碑脚配置一大一小两块有厚度、贴地的断石，大块保留青绿与旧金纹样，嵌片没有伸出断石轮廓。主碑及两块断石各保留具名组，组内按材质合批。组合 12 meshes / 8,740 triangles / 6 materials / 1 本地 128×128 石材纹理，约 2.376×2.351×0.889，最低 Y=0。克隆共享几何、材质及贴图，无每帧模型更新、新灯光、依赖或外部模型下载。

`src/boss-courtyard-blockout.ts` 替换 `boss-blockout-marker` 占位，世界位置仍为 (172.5,0,-8)、正面 +Z。保留单个主碑箱体代理，尺寸从 1.6×1.8×0.6 调为 1.7×2.3×0.85 覆盖主碑与基座；外围断石为装饰，没有单独物理代理。附近陶盆、中央地面及已确认道具保持。

包含离散断石的合并外包框会在碑旁空白处误淡出。`src/maze.ts` 只为此 marker 启用既有实体射线二次判断，沿用水槽的缓存实体网格方式；真正挡住玩家才 0.16，其他位置保持 1。没有改全局透明阈值或相机。

## 验证与成本

- `npm run build` 通过，保留既有大包体警告。
- `tests/leaf-emblem-stele.mjs` 通过：有限几何／法线、贴地、资源共享、三叶均实际凹入、两侧石缝、右上真实缺口、约 0.356 主碑厚度、两块厚断石及残余叶纹、GLB 重载和非空画布。
- 实际游戏位置、主碑代理阻挡、陶盆附近三段绕行和重置通过。靠近主碑停在 Z≈-8.825、保持站立；三段路线目标误差均小于 0.18。重置前后仍为 192 bodies / 265 colliders。
- 13 个遮挡位置中，8 处没有实体遮挡，完整不透明；5 处真实遮挡，淡出为 0.16。复现并修复了仅凭外包框导致的三处误判。离开后恢复，近距离 opacity=1。生产水槽可见性回归通过，原分槽修复保持。
- 生产 `tests/boss-courtyard-blockout.mjs` 通过：新徽碑接入、116 点中央地面、六段外围通行、八向闪避、道具碰撞、Boss 预警、遮挡及手机画面。未重复完整 Boss／渡船流程。
- 生产中央战斗镜头仍为 230 calls / 281,654 triangles / 78 points：徽碑在该镜头外，因此不能把未增加可见绘制误报为模型没有成本。场景资源为 734 geometries / 34 textures，相比上一项增加 12 geometries / 1 texture。
- 专用徽碑镜头隐藏为 272 calls / 334,728 triangles，显示为 284 / 343,468。该近景展示了更多背景，与中央战斗镜头不作前后对比。
- 单体目标 ≤16 meshes、<16,000 triangles、≤6 materials、1 texture，实际在预算内。庭院组合 135,752 三角形，较前项增加 8,728（新模型 8,740 替换 12 三角占位），总组合测试预算从 130,000 调为 140,000，原通行／布局断言保留。
- 全部九张单体／细节／实景图已检查，无捕获的 page、console 或 HTTP 错误。

## 工作记录与限制

沿用已读取 Director、Graphics Builder、QA Release 技能及 phase-playbook、model-recipes、render-recipes、implementation-blueprint、technical-art、visual-scorecard、procedural-model-quality、material-lighting-quality、performance-safe-visual-detail、qa-release-checklists、visual-verification、playtest-qa 参考。范围为单个静态道具，不作全游戏 premium／AAA 质量声明；无新 UI、战斗机制、音效或自定义着色器。

资产来源：内置 imagegen 已确认设计图 → 本地可编辑几何与小石纹贴图 → GLB。没有在本步骤调用外部 3D 服务。独立只读检查覆盖源码、九张截图及最新指标；修正了初版三孔交叠、大断石嵌片越界和合并边界误淡出。验证沿用固定展示镜头、实体射线、像素非空和 GLB 重载，本次不冻结截图像素基线。

未增加文字、交互／拾取、音效或动画，未部署、打包或进行手机真机性能测试。手机尺寸图不能代表真机帧率结论。
