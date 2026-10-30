# 营火遗迹：石圈、焦木与遗落头盔

2026-10-29。按已确认 `artifacts/concepts/boss-courtyard/campfire-remains-design-sheet-v1.png` 制作并接入庭院。

## 本地资产与预览

- `campfire-remains.glb`：自包含静态 GLB，1,026,592 字节，导出后重新加载核对几何、边界、配色和内嵌贴图。
- `three-quarter.png`、`top.png`、`side.png`、`back.png`：整体单体视角。
- `helmet-front.png`、`helmet-underside.png`：面罩孔、叶纹、真实开放颈口和内衬。
- `scene-closeup.png`、`camp-closeup-390.png`、`camp-closeup-844.png`：游戏内桌面和手机尺寸展示镜头，未修改游戏相机。
- `metrics.json`：几何、GLB、场景接入、实际跨越和重置数据。

## 实现

`src/campfire-remains.ts` 为缓存工厂。八块低矮浅色旧石围成真实空心石圈，向火心的表面熏黑，棱角、裂缝及少量外缘苔藓保留。三根交错焦木有不规则炭化表皮、露出木芯的断口和灰片；冷灰床与炭屑略高于地面，避免地面闪烁。

一顶灰钢头盔斜靠外缘，旧铜包边、铆钉与青绿三叶饰形成颜色层次。四个面罩孔由挤出轮廓真正开洞；内外后壳、内外盔顶及环形下缘形成实体厚壳。颈口开放，没有封底盘或黑色实心球。皮内衬避开低位孔。盔顶、面罩与后壳采用一致角采样衔接，叶脉沿实际叶面贴合，避免接缝漏白或叶脉埋入／悬空。

`src/boss-courtyard-blockout.ts` 替换 `boss-blockout-campfire` 占位，世界位置仍为 (172.5,0,-42.5)。保留原来无新增碰撞代理、可以跨过的低矮陈设行为。模型不燃烧，无火焰、余烬光、烟雾或动画。中央地面、Boss、剑、树根、兵器架及其他道具保持。

整体 18 meshes / 8,856 triangles / 9 materials / 1 本地 128×128 炭化纹理，约 2.800×0.945×2.323，最低 Y≈0。三根焦木和头盔保留独立具名组，组内按材质合批，缓存克隆共享资源。没有新灯光、渲染通道、依赖或第三方模型下载。

## 验证与成本

- `npm run build` 通过，保留既有大包体警告。
- `tests/campfire-remains.mjs` 检查有限几何／法线、共享、八个石顶、石圈真实空心、内向熏黑、三根焦木、4 孔×2 高度射线首命中、开放颈口和约 0.035 的实体盔壳厚度。不同孔的射线穿过前壳后命中后壁，不能错误地把后壁命中当作没有开孔。
- 实际游戏位置、双向跨过中心、地面射线高度 0、近距离完整可见 opacity=1、遮挡注册与重置通过。重置前后均为 192 bodies / 265 colliders。GLB 重载、非空画布和桌面／手机尺寸图通过，无捕获的 page、console 或 HTTP 错误。
- 生产 `tests/boss-courtyard-blockout.mjs` 通过：新模型接入、116 点中央地面、六段外围通行、八向闪避、其他道具碰撞、Boss 预警、遮挡及手机画面。未重复完整 Boss／渡船流程。
- 生产中央镜头：230 calls / 281,654 triangles / 78 points，722 geometries / 33 textures。相比上一项同镜头增加 11 calls / 8,364 triangles / 17 geometries / 1 texture；替换的占位为 7 meshes / 492 triangles。
- 专用营火镜头隐藏为 180 calls / 225,082 triangles，显示为 198 / 233,938。不同镜头不作前后对比。
- 单体目标 ≤22 meshes、<16,000 triangles、≤9 materials、1 texture，实际在预算内。庭院组合由 118,660 增至 127,024 三角形，测试总预算随实测模型增量从 120,000 调为 130,000，原有布局、通行断言保留。

## 工作记录与限制

沿用已读取的 Director、Graphics Builder 和 QA Release 技能，以及 phase-playbook、model-recipes、render-recipes、implementation-blueprint、technical-art、visual-scorecard、procedural-model-quality、material-lighting-quality、performance-safe-visual-detail、qa-release-checklists、visual-verification、playtest-qa 参考。范围为单个静态道具，不作全游戏 premium／AAA 质量声明；无新 UI、战斗机制、音效或自定义着色器。

资产来源为内置 imagegen 已确认设定图 → 本地可编辑几何和小贴图 → GLB。没有在本步骤调用外部 3D 服务。独立只读检查覆盖全部九张单体／头盔／实景图和测试产物，修正了内衬遮孔、盔顶接缝与叶脉贴合问题。验证沿用固定镜头、结构射线、GLB 重载和像素非空检查，本次不冻结像素比较基线。

未增加拾取／交互、音效或环境动画，未部署、打包或做手机真机性能测试。手机尺寸截图不代表真机帧率结论。
