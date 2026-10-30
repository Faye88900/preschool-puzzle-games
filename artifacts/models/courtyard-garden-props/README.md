# 庭院陶盆、浇水壶与嫩芽

2026-10-30，按已确认 `artifacts/concepts/boss-courtyard/terracotta-watering-can-seedling-design-sheet-v1.png` 制作并接入第三关 Boss 岛庭院。

## 资产

- `courtyard-garden-props.glb`：自包含静态模型，1,712,748 字节；重新加载检查几何、边界、材质及内嵌贴图通过。
- `three-quarter.png`、`front.png`、`side.png`、`back.png`、`top.png`：组合多角度；`watering-can-detail.png`：开口、把手及喷头细节。
- `scene-closeup.png`、`props-closeup-390.png`、`props-closeup-844.png`：实际场景桌面及手机尺寸展示。只在测试中设置展示镜头，游戏相机未修改。
- `metrics.json`：结构射线、像素、GLB、场景碰撞、绕行、遮挡、重置及绘制数据。

## 实现与成本

`src/courtyard-garden-props.ts` 保留可编辑几何源与缓存工厂。两只厚口赤陶盆采用连续外壁、口沿、内壁、厚底及真实排水孔；立盆有土面和嫩芽，侧倒盆为空腔。浅绿带、旧铜叶纹和少量缺口／裂线呼应相邻徽碑。青绿铜锈浇水壶包含真实填水开口、内壁、镂空把手、空心长嘴和具有 20 个贯穿孔的喷头。嫩芽是独立组，含两片主叶和一片中央新叶。

组合为 17 meshes、13,828 triangles、7 materials、两张 128×128 DataTexture，尺寸约 2.311×1.228×1.366，最低 Y=0。具名盆、壶、嫩芽及叶片内按材质合批，克隆共享几何和材质；无新依赖、新灯光或每帧更新。资产来源为内置 imagegen 已确认设计图 → 本地几何制作 → GLB，无外部 3D 服务调用。

`src/boss-courtyard-blockout.ts` 在世界 (175.5,0,-7) 替换两根陶盆占位圆柱，保留一个简化箱体代理并调整为 2.5×0.75×1.4。没有增加物理体；重置前后均为 192 bodies／265 colliders。遮挡沿用既有庭院机制，近旁位置测试包含恢复到 1 和淡出到 0.16。

专用测量镜头：隐藏本组 290 calls／350,876 triangles，显示 307／364,704，实际增量 17 calls／13,828 triangles。生产中央战斗镜头仍为 230 calls／281,654 triangles／78 points，因为新道具位于该镜头外；不能据此推断模型没有性能成本。中央镜头场景资源 750 geometries／34 已上传纹理；本组完整纹理在单体检查中为两张。庭院组合由 135,752 增至 149,516 三角形，原占位为 64 三角形；总组合断言上限调整至 150,000。

## 验证与限制

`npm run build`、`tests/courtyard-garden-props.mjs`、生产 `tests/boss-courtyard-blockout.mjs` 全部通过。浏览器脚本沿用 `PLAYWRIGHT_MODULE`、`PLAYWRIGHT_BROWSERS_PATH`（若浏览器装在非默认位置）和 `TEST_URL` 环境配置；单体测试使用开发服务，生产布局测试使用生产预览。

检查了有限坐标／法线、资源共享、空盆底面及排水孔、壶体开口及把手负空间、喷头穿孔、三片独立嫩叶、非空画布、GLB 重载、游戏位置、代理阻挡、三段近旁绕行、遮挡及重置。生产回归另覆盖 116 点中央地面、六段通行、八向闪避、攻击预警和桌面／手机画面。无页面、console 或 HTTP 错误。单体多角度、壶体细节和游戏内桌面／390×844／844×390 图片已人工查看；首版装饰带闪烁和展示镜头被墙遮挡已修正。

这是静态装饰，没有拾取、浇水玩法或动画。截图、结构射线、像素检查与 GLB 重载足以覆盖本次局部替换，未建立严格像素基线；未重复完整 Boss／渡船流程、部署或进行手机真机性能测试。既有构建包体警告仍在；专用近景 307 calls／364,704 triangles、全场几何资源超出通用手机起始预算，手机尺寸截图不代表真机性能结论。下一项为植被布置。
