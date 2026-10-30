# 遗迹与绿篱穿插修复

依据用户宽屏截图修复花瓶、石墙嵌入绿篱的问题。

## 根因
上一版仅把整块绿篱压低并略微前移石墙，绿篱体积仍覆盖花瓶与石墙的下半部；几处花盆也与相邻残墙挤在一起。地面石板没有埋入绿篱。

## 修改
- first-encounter-ruins.ts 在合批前根据各段石墙、花瓶、拱门的实际包围范围，记录带0.22m间距的绿篱避让区域。数据随现有Group克隆保存，不改变工厂调用接口。
- maze.ts 仅对初遇怪场地的绿篱显示几何扣除这些区域，剩余部分仍按原材质合并，一个原有墙段仍对应一个网格。固定物理边界与145个刚体数量保留。
- 调整两只花瓶和三个花盆的位置，让它们避开邻近石墙；中央区域、桥入口和拱门通道保持开放。
- 不改灯光、UI、怪物行为、地图、地面或其他场景。

## 验证
修复前自动检查复现埋入：拱门376、石墙1224、花瓶2838个顶点；地面0。
修复后用真实绿篱三角面从上方射线检测，各组埋入顶点均为0。
本次运行 tests/first-encounter-ruins.mjs 通过，包含：
- 1906x921用户截图相近视角、桌面、手机竖屏、短横屏、桥入口实景截图。
- 过桥、穿拱门、跳跃边界、首次吹风击败怪物和死亡动画。
- 手机吹风、摇杆释放、暂停恢复、重开，刚体数量不增加。
- 浏览器页面、console error、HTTP error 均为空。
- 模型仍为22个网格、47848三角形，无新增纹理；分割后局部视角桌面310calls、手机240calls，新增绿篱三角形但未增加绘制次数。
npm run build、node --check、git diff --check通过。

截图：test-results/first-encounter-ruins/user-view-after.png。
结构化结果：test-results/first-encounter-ruins/report.json。
生产启动检查：test-results/first-encounter-ruins/production-report.json（未经拦截的dist，仅启动和基本输入/暂停，未生产通关）。

本次未重跑整关通关脚本，未ZIP、部署或真机测试。上一轮整关回归记录保持在VERIFICATION.md。
已加载threejs-debug-profiler/SKILL.md及debug-profile-checklists.md、scene-debugging.md；复用已有QA技能和测试脚本。

