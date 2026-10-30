# 三级叶槽流水、跌水与云海瀑布

2026-10-29。根据已确认的 `leaf-channel-waterfall-vfx-design-sheet-v1.png` 完成实时效果深化，原石槽、叶纹、支撑和碰撞保持。

| 文件 | 内容 |
|---|---|
| before.png / after.png | 静态水预览与实时水效 |
| basin-closeup.png / waterfall-closeup.png | 浅水叶脉、泡沫、水丝近景 |
| cloud-sea-scene.png | 岛边到云雾的完整衔接，游戏内测试镜头 |
| cloud-sea-overview.png | 独立组合，测试镜头 |
| water-motion.webm | 实际 WebGL 画布约 3.2 秒录屏 |
| scene-closeup.png | 游戏内水槽近景，测试镜头 |
| water-closeup-390.png / water-closeup-844.png | 手机横竖屏尺寸近景 |
| metrics.json | 像素运动、减少动态、时钟、物理及成本 |

## 实现

`src/leaf-channel-water.ts` 复用 `src/leaf-water-channel.ts` 水路，`src/maze.ts` 接入活动时钟。三个细分水面有双层波纹法线、微小顶点起伏、天空近似反光、深浅色差、落水涟漪及集中泡沫，浅水仍可看见叶脉。

四段曲面连接进水口、两段跌水和末端瀑布。流动纹理、透明扰动及边缘起伏形成纵向水丝。末端瀑布延伸至局部 Y=-27.5，Y=-19 后逐渐淡出；78 个水滴以一次 Points 绘制。12 个合批云雾面片仅位于这条瀑布下方，最高边缘约 Y=-17.1，带缓慢漂移，不是实体落水池。世界云层、远岛、渡船海面及桥水保持。

全部水效复用一张本地确定性 128×128 RGBA DataTexture，无下载、依赖、新灯光、全屏后处理或额外场景渲染。暂停／对话冻结；减少动态固定水面、瀑布及云雾并隐藏水滴。遮挡材质克隆后仍同步时间、共享贴图，水花跟随槽体淡出。

保留靠近误透明修复：三槽与进水口分别检测实体遮挡，水面、瀑布、水滴及云雾不触发槽体淡出。六处靠近点均完全可见，真正遮挡时只淡出对应槽体，瀑布独立可见。详见 `../leaf-channel-visibility/`。

反射为解析天空近似，没有场景倒影、屏幕折射或流体求解。云雾是朝向相机的面片近似，没有体积云计算。原 `../leaf-water-channel/three-tier-leaf-water-channel.glb` 保留静态交换资产；本次实时效果由 Three.js 代码提供，没有重新导出为动态 GLB。

## 验证与成本

- `npm run build` 通过，既有大包体警告保留。
- `tests/leaf-channel-water.mjs` 通过：水流不同时间 29,462 像素变化，云雾近景 30 秒漂移 3,025 像素变化；相同时间及减少动态重复渲染均为零变化。
- 五个网格水效材质同步活动时钟，暂停保持、减少动态归零，水花跟随遮挡值 0.16。重置前后均为 192 bodies / 265 colliders。
- 生产 `tests/leaf-channel-visibility.mjs` 和 `tests/boss-courtyard-blockout.mjs` 通过：六处靠近、四处实际遮挡、恢复、116 点中央地面、六段通行、八向闪避、道具碰撞、预警与手机尺寸画面。最终只调整云色和羽化后，再通过构建及水效测试，未因颜色变化重复通行测试。
- 当前组合 25 meshes / 23,192 triangles / 78 points / 12 materials / 1 shared texture，26 calls。较上一版增加 1 call / 144 triangles / 24 points。
- 生产中央战斗镜头：202 calls / 262,814 triangles / 78 points，683 geometries / 31 textures。专用水槽镜头显示为 177 calls / 234,382 triangles，隐藏为 151 / 211,190；不同镜头不混作前后对比。
- 单体、游戏内及手机尺寸截图已检查。无捕获的 page、console、HTTP 或 shader 编译错误，视频来自实际画布。

未增加音效、部署、打包或重复完整 Boss／渡船流程。未做手机真机性能测试；上述数据来自电脑浏览器。
