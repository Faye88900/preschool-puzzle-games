# 古代风之巨剑

制作日期：2026-10-29。第 3 项：正式巨剑已接入第三关。

## 模型与设计

- 设计图：`artifacts/concepts/boss-courtyard/giant-sword-design-sheet-v1.png`。
- 源文件：`src/ancient-wind-sword.ts`，导出 `createAncientWindSword()`。
- 导出：`ancient-wind-sword.glb`，1,038,672 字节，材质和纹理自包含，已导入重载验证。
- 轴向：+Y 向上、+Z 正面，剑尖 y=0；本地尺寸约 6.366×14.189×1.977。
- 8 个网格／材质、10,172 三角形、一张 256×256 矿物纹理。模板克隆共享资源。
- 暖灰浅色斜切边、暗钢内面、叶形护手、青绿风之圆印、叶纹通道、橙红裂痕、金属绕柄与叶芽剑首。正反面有实体结构。
- 本轮为静态地标模型；树根保持独立占位，供下一项制作。

## 技术美术与素材来源

采用既有 imagegen 设定图 + 本地可编辑 Three.js 几何 + GLB 导出的混合流程。表面采用标准 PBR 材质；不增加灯光、后期处理或依赖。发光细节不投射阴影。剑的简单碰撞代理与视觉网格分开，外围布景继续使用现有镜头淡出。

本轮资产凭据探测的原样输出：

```text
TRIPO_API_KEY=SET
```

本轮未提交 Tripo 生成任务；几何按已生成的指定设定图本地制作。外部输出证据为上方项目内 imagegen 设定图，3D 实物为本目录 GLB。无需骨骼、动画或自动绑定。

| 参考与阶段 | 状态 | 证据 |
|---|---|---|
| threejs-3d-generator/SKILL.md、references/threejs-integration.md | 已读取 | 素材与导出检查 |
| web-3d-asset-pipeline/SKILL.md | 已读取 | 格式、轴向、代理碰撞、共享资源 |
| threejs-game-director/SKILL.md | 已读取 | 专项制作与独立 QA 委派 |
| graphics-builder 的 model-recipes.md、technical-art.md、render-recipes.md | 已读取 | 实体造型、材质角色、合批与预算 |
| QA 的 qa-release-checklists.md、visual-verification.md、playtest-qa.md | 已读取 | 自动化及视图检查 |
| 独立模型与视觉检查 | 已完成 | 专项 QA worker；tests/ancient-wind-sword.mjs、metrics.json |
| API 参数/生成任务、骨骼、音频、全场景重做 | 本轮不涉及 | 静态模型专项 |

## 验证

- `npm run build`：通过（既有包体警告仍在）。
- `tests/ancient-wind-sword.mjs`：通过，涵盖有限几何／法线、真实正反厚度、共享资源、GLB 往返、实际倾斜后的落地、重置和桌面／手机视图。
- `tests/boss-courtyard-blockout.mjs`：生产构建通过，覆盖地面、道具碰撞、码头与中央通行、八向闪避、预警及遮挡淡出。
- `tests/boss-arena.mjs`：生产构建通过，覆盖原有边界、Boss／钥匙、恢复与重置、渡船往返。
- 三组测试均无页面、console error 或 HTTP 错误。
- 白底正面、侧面、背面、斜视和游戏桌面／手机横竖屏均已查看；专项检查还验证了画布非空像素。

同镜头：隐藏巨剑为 160 次绘制／140,204 三角形，显示为 168／150,376。增加 8 次绘制、10,172 三角形。生产场景整体内存统计为 604 个几何对象、28 个纹理，属于整个第三关的资源统计；本模型额外使用 8 个几何对象、1 个纹理。未进行清理全关资源或硬件 FPS 优化。

截图：`three-quarter.png`、`front.png`、`side.png`、`back.png`、`gameplay-desktop.png`、`scene-closeup.png`、`gameplay-390.png`、`gameplay-844.png`。指标：`metrics.json`。

未增加像素基线：场景仍逐项用正式模型替换粗搭，现阶段保留确定性场景截图、几何断言和既有玩法回归。没有重新运行整套巨剑战斗动画回归；本轮沿用原有攻击逻辑，额外验证了自然 Boss 击败与钥匙流程。

尚未部署、打包发布或进行手机真机性能测试。横屏跟随镜头仍可能裁掉地标顶部，中央 Boss 战视野保持可见。下一项是缠绕树根正式模型。

## 后续位置对齐

Boss 已移至叶纹圆盘后方中轴 (187.5,0,-34)，巨剑底座移至右后侧 (192.5,0,-42)，根须占位随之平移。造型、独立 GLB、尺寸和倾斜角不变。更新后的游戏截图仍在本目录，概念图对照全景位于 `artifacts/models/boss-courtyard-blockout/concept-layout.png`。布局、场地及完整 Boss 战斗回归通过；死亡恢复与 reset 均返回新的 home 和初始朝向。新镜头下显示巨剑为 162 次绘制／149,064 三角形，隐藏为 154／138,892，模型增量仍是 8 次绘制、10,172 三角形。
