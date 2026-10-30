# 缠绕巨剑树根

第 4 项已完成：按 `artifacts/concepts/boss-courtyard/wrapping-roots-design-sheet-v1.png` 制作静态树根，并替换第三关旧占位。

## 交付

- 源模型：`src/wrapping-sword-roots.ts`，`createWrappingSwordRoots()`，模型名 `wrapping-sword-roots`。
- 运行时直接使用可编辑工厂；导出的自包含 `wrapping-sword-roots.glb` 为 2,497,692 字节。
- 4 个网格／材质，19,668 三角形，一张 256×512 方向木纹。缓存模板克隆共享几何和材质。
- 尺寸约 19.709×11.443×4.253，y=0 贴地，+Y 向上、+Z 正面。以剑尖为组装原点，根的形态已适配巨剑 z=-0.25 倾角，不再整体旋转。
- 与巨剑同处世界 (192.5,0,-42)，Boss home (187.5,0,-34) 保持不变。
- 三条主根、分叉细根、渐细椭圆截面、扭转起伏、浅色木纤维、方向树皮纹理和少量苔藓嫩叶。细根绕过剑肩，圆印、风纹与裂痕保持可见。

## 检查

| 验证 | 结果 |
|---|---|
| npm run build | 通过；既有大包体警告仍在 |
| tests/wrapping-sword-roots.mjs | 通过；几何／法线、共享资源、实体与渐细形态、GLB 重载、组合遮挡、中央地面、往返路线、基部碰撞、reset 与桌面／手机截图 |
| tests/boss-courtyard-blockout.mjs | 最终版通过；概念图站位、地面、通行、八向闪避、淡出和手机画面 |
| tests/boss-arena.mjs | 底座集成后通过；边界、Boss／钥匙、渡船往返与重置；末次高位细根不改碰撞 |
| 页面／控制台／HTTP 错误 | 未捕获错误 |

剑的圆印、青绿通道、橙色裂痕三个采样点从模型正面与实际游戏相机检查均无遮挡。中央 116 点地面平整，6 段码头—中央—Boss 往返通行通过。两基部停止点分别约 z=-41.800、-41.600；reset 前后 193 bodies／266 colliders 不增长。

同镜头隐藏根模型：160 次绘制／148,776 三角形；显示：164／168,444。根模型增加 4 次绘制、19,668 三角形。生产场景总内存统计为 606 个几何对象、29 个纹理，属于整个第三关资源统计；本次未优化其他区域资源。电脑浏览器测量不代表手机真机帧率。

截图：`three-quarter.png`、`front.png`、`side.png`、`back.png`、`sword-combined.png`、`scene-closeup.png`、`gameplay-desktop.png`、`gameplay-390.png`、`gameplay-844.png`。详细结果：`metrics.json`。

## 流程与范围

采用项目内 imagegen 设定图与本地 Three.js 几何组合的流程，不提交外部 3D 生成任务。沿用已读取的 threejs-game-director、threejs-3d-generator、threejs-aaa-graphics-builder、web-3d-asset-pipeline 与 QA 指引；本轮复核模型资产管线与 technical-art 预算。专项 QA 提供独立测试与视觉检查，末次剑肩细根由主代理重新运行验证。未改攻击逻辑、Boss 站位、巨剑造型、相机、音频或灯光。

未建立像素基线：庭院正逐项替换占位，使用确定性几何与玩法断言及当前截图检查。未重复完整巨剑动作回归；保留此前结果并验证自然击败／钥匙流程。未新增动画，未部署或打包发布，未做手机真机性能测试。下一项：岛屿岩壁与残墙。
