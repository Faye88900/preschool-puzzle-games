# 岛屿岩壁与残墙（第 5 项）

2026-10-29，本地场景已接入。源代码：`src/boss-island-stonework.ts`、`src/boss-island.ts`。

## 交付

| 文件 | 内容 |
|---|---|
| boss-island-stonework.glb | 完整岛体岩壁、石沿及五段残墙，6,522,872 字节 |
| ruined-wall-modular-kit.glb | 直墙、弧墙、转角、立柱、缺口、碎石六模块，595,904 字节 |
| stonework-three-quarter.png、front / side / below | 实际模型斜视、正面、侧面、底部 |
| modular-kit.png | 六模块实物预览 |
| island-overview.png | 游戏内测试相机全景 |
| gameplay-desktop.png、gameplay-390.png、gameplay-844.png | 实际跟随镜头，桌面和手机横竖屏模拟 |
| metrics.json | 最终模型、GLB 和运行时验证数据 |

## 设计与资源

- 依据项目生成设定图 `artifacts/concepts/boss-courtyard/island-cliffs-ruined-walls-design-sheet-v1.png`，整体关系沿用 `sword-split-wind-garden-v4-props.png`。
- 本地可编辑 Three.js 几何，运行时使用缓存工厂；GLB 作为独立交付。无外部模型、贴图或生成服务下载，无新增依赖或灯光。
- 浅色石灰岩、错落的多面外岩、向下收窄的岩体、错缝残墙、少量苔藓与垂藤。总计 25 meshes / 5 materials / 0 textures / 65,782 triangles。
- 岩壁最低点 y=-23.787；模型上宽约 54.324，下部约 23.511。中央战斗地面没有岩石侵入。
- 五个墙组分别接入镜头遮挡淡出，使用原有五段简单边界碰撞。保留地形物理、码头开口、叶纹圆盘和 Boss／巨剑／树根布局。岛面矩形轮廓受既有地形约束；其他清单中的道具仍逐项制作。

## 验证

构建、`tests/boss-island-stonework.mjs` 与生产庭院布局回归通过。模型覆盖几何／法线有限值、实体厚度、模块贴地、共享资源、岛体收窄、GLB 导出重载、五组遮挡和 116 个中央地面采样。布局覆盖入口往返、闪避、碰撞及预警。场地回归覆盖 Boss／钥匙、渡船往返与恢复／重置；最后岩块外形和材质微调没有改动物理，随后重新通过模型和布局测试。

截图已人工查看，无捕获的页面、console error 或 HTTP 错误。固定镜头显示本组为 183 calls / 230,334 triangles；隐藏本组为 162 / 166,912，差额为 21 / 63,422。全组几何与该镜头可见面数不同；场景仍为 27 张纹理。

未进行手机真机性能测试、全关卡通关、发布打包或部署。手机窄屏沿用现有镜头，巨剑局部可能被画面边缘裁切，Boss 与中央战斗区可见。
