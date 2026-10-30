# 旧木兵器架、三矛与叶纹圆盾

2026-10-29。按已确认 `artifacts/concepts/boss-courtyard/leaf-weapon-rack-design-sheet-v1.png` 完成独立模型和庭院接入。

## 资产

- `leaf-weapon-rack.glb`：自包含模型，1,465,088 字节，已导出并重新加载核对几何、边界、材质颜色及内嵌木纹。可以保存到本地，不依赖临时下载链接。
- `three-quarter.png`、`front.png`、`side.png`、`back.png`：完整单体视角。
- `shield-front.png`、`shield-back.png`：叶纹、凸面厚度、握把与拱形皮带。
- `scene-closeup.png`、`rack-closeup-390.png`、`rack-closeup-844.png`：游戏内桌面及手机尺寸，使用测试展示镜头。横屏目标提高以避开 HUD，游戏相机没有改动。
- `metrics.json`：单体、GLB 和实际游戏检查结果。

## 制作与接入

`src/leaf-weapon-rack.ts` 是可编辑缓存工厂。旧木立柱、真凹口横梁、托盘、宽脚和背部交叉斜撑，配木端面、旧铜扣、绳缚、裂纹及少量苔藓；三支错落的长矛配叶形钢矛头、金色叶脉、铜套与青绿绑布。一面凸木圆盾有旧铜厚包边、铆钉、青绿三叶浮雕，背面具有贴合曲面的握把端部和真正向后拱出的臂带。长矛位于横梁前方，由铜夹固定，不穿过横梁。

原 `boss-blockout-weapon-rack` 容器接入此工厂，位置仍为世界 (176.5,0,-43)，正面 +Z 面向庭院。保留一个简单箱体代理，宽 2.8、高 2，深度从 0.6 扩至 1.3 覆盖宽脚及前伸的盾饰，物理对象数量不变。沿用既有遮挡系统，真正挡住玩家时 0.16，离开恢复 1。未改中央叶纹地面、Boss、剑、树根或水槽。

组合 22 meshes / 8 materials / 10,536 triangles / 1 本地 128×256 木纹贴图，约 2.857×4.250×1.148，最低 Y≈0。按功能组和材质合批；三个长矛、木架和圆盾保留独立具名组，工厂克隆共享几何和材质。无每帧更新、新灯光、依赖或外部模型下载。

## 验证与成本

- `npm run build` 通过，保留既有大包体警告。
- `tests/leaf-weapon-rack.mjs` 通过：有限几何／法线、贴地、共享、三矛高差、矛头实体厚度、盾体厚度约 0.149、横梁凹口高差约 0.105、臂带后拱留空、非空画布及 GLB 重载。
- 实际游戏位置、前方完整显示／背后遮挡 0.16／离开恢复、底座实际阻挡与重置通过。玩家从前方接近停在 Z≈-41.950，保持站立。重置前后均为 192 bodies / 265 colliders。桌面及手机横竖屏截图已检查，无 page、console 或 HTTP 错误。
- 生产 `tests/boss-courtyard-blockout.mjs` 通过：模型接入、116 点中央地面、外围六段通行、八向闪避、道具碰撞、Boss 预警、遮挡和手机尺寸。未重复完整 Boss／渡船流程。
- 生产中央战斗镜头为 219 calls / 273,290 triangles / 78 points，705 geometries / 32 textures。相比上一项相同镜头增加 17 calls / 10,476 triangles / 22 geometries / 1 texture；新模型替换原 5 meshes / 60 triangles 占位。
- 专用兵器架镜头隐藏为 174 calls / 234,174 triangles，显示为 196 / 244,710。不同镜头不混作前后对比。
- 单体目标 ≤25 meshes、<15,000 triangles、≤8 materials、≤2 textures，实际在预算内。庭院粗搭组合从 108,184 增至 118,660 三角形，因此总组合测试预算由 110,000 调为 120,000；没有跳过原布局／通行断言。当前整体几何和绘制仍高于技能通用手机参考值，需真机测量，不能以手机尺寸截图代表性能达标。

## 工作记录

- 技能：已读取 Three.js Game Director、Graphics Builder、QA Release；概念图阶段使用内置 imagegen。范围为单个静态道具，未做全游戏 premium／AAA 质量声明。
- 参考：Director phase-playbook；Graphics implementation-blueprint、model-recipes、render-recipes、technical-art、visual-scorecard 及 procedural-model-quality、material-lighting-quality、performance-safe-visual-detail 检查表；QA qa-release-checklists、visual-verification、playtest-qa。无自定义着色器或渲染管线变更。
- 资产来源：已生成并确认的项目设定图 → 本地几何与小木纹贴图 → GLB 导出；本步骤没有调用外部 3D 服务。
- 独立只读检查覆盖全部单体视角和桌面／横竖屏实景；发现并修复握把端悬空、长矛穿梁、皮带缺中段细分及横屏展示镜头矛尖被 HUD 遮住的问题。
- 验证沿用固定测试镜头、几何断言、GLB 重载和像素非空检查；本次不冻结截图像素基线。UI、战斗规则、音效和环境动画不在范围内。

未部署、打包或进行手机真机性能测试。武器是场景陈设，尚无拾取或交互功能。
