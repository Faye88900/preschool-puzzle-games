# 叶形风铃柱（第 7 项）

2026-10-29，本地可编辑模型已替换庭院两处风铃占位。

## 文件

| 文件 | 内容 |
|---|---|
| leaf-chime-post.glb | 自包含可保存模型，2,224,472 字节，内嵌铜锈贴图 |
| three-quarter.png、front.png、side.png、back.png | 实际模型斜视、正侧背视图 |
| scene-closeup.png | 庭院内近景，使用测试相机 |
| gameplay-desktop.png、gameplay-390.png、gameplay-844.png | 实际跟随镜头与手机尺寸模拟 |
| chime-closeup-390.png、chime-closeup-844.png | 手机尺寸测试相机近景，方便查看风铃细节 |
| metrics.json | 实体、孔洞、GLB、场景与通行验证结果 |

## 来源与外部生成结果

造型依据：`artifacts/concepts/boss-courtyard/leaf-chime-post-design-sheet-v1.png`。内置图像生成工具还制作了 `leaf-chime-post-single-reference-v1.png`，作为单体建模参考。

已读取 3D Generator 技能；凭据探测结果为 `TRIPO_API_KEY=SET`。最初自动审批因未明确授权外传参考图而拒绝上传。用户随后明确允许使用外部服务且要求产物可下载，重试 Tripo v3.1-20260211 图生模型，设置 detailed texture / detailed geometry、face_limit=16000、smart_low_poly、texture_alignment=original_image、wait+download。服务返回 `HTTP 403`，`code:2010`，`You don't have enough credit to create this task`；没有创建生成任务、没有外部 3D 模型下载，不再重试。没有把本次成品描述为 Tripo 模型。

最终采用图像参考 → 本地 Three.js 几何 → GLB 导出的流程。源代码为 `src/leaf-chime-post.ts`，无第三方网格、贴图下载或新依赖。GLB 可直接本地保存和重新加载，不依赖过期链接或外部生成服务。

## 模型与场景

- 弯曲旧铜枝与端部卷钩、铜座和铆钉、三片不同长度的叶形铃、真实穿孔／挂环、单条红布、浅色分块石台、叶徽与少量苔藓藤叶。
- 石材米白、金铜露边、青绿铜锈和酒红布条。共享一张本地 128×128 DataTexture；无需额外灯光、着色器或后处理。
- 16 网格、7 个源材质、1 张纹理、17,056 三角形。尺寸约 3.106×4.276×1.111，最低点 y=0，正面 +Z；铜枝朝 +X 伸出，原点位于石台底部。
- `chime-frame`、`leaf-chime-0/1/2`、`chime-leaf`、`chime-ring` 和 `chime-streamer` 保留名称及独立挂点。工厂缓存并共享几何、材质。当前为静态道具；摆动和布条动画留在制作清单第 16 项，不含音效。
- `src/boss-courtyard-blockout.ts` 替换 `boss-blockout-chime-0/1` 内的占位，世界位置 (169.5,0,-41)、(205,0,-11)，沿用原 1.1×2.2×1.1 简单底座代理和遮挡淡出。
- 仅保留一座完整彩绘守卫石像的用户选择，以及叶纹地面、Boss、巨剑、树根和码头位置保持。

## 验证

构建及 `tests/leaf-chime-post.mjs`、生产 `tests/boss-courtyard-blockout.mjs` 通过。无捕获的 page / console / HTTP 错误。

- 几何／法线有限、贴地、共享资源、三片长度和分离轮廓、真实挂孔、挂环尺寸与叶片厚度检查通过。叶片采样总厚约 0.144–0.146。
- GLB 重载核对边界、三角形、内嵌纹理及材质名／颜色／roughness／metalness。GLTFLoader 对不含顶点色的挂环创建材质变体，重载后对象计数为 8；有效配色和材质参数仍为原 7 种。
- 两处场景模型、6 段码头／外围往返、两个底座阻挡、0.16 遮挡淡出与重置通过。物理计数保持 192 bodies / 265 colliders。
- 庭院布局覆盖 116 个中央地面采样、8 向闪避、道具碰撞、预警和桌面／手机尺寸画面。只检查本项风险，没有重复完整 Boss／渡船战斗回归。
- 风铃测试镜头显示两模型为 206 calls / 264,054 triangles；隐藏为 174 / 229,942，增加 32 calls / 34,112 triangles。生产中央战斗镜头为 190 / 246,998，657 geometries / 30 textures。镜头可见范围不同，两个测试数据不能直接作前后对比。

已查看实际正侧背、斜视、场景和手机近景。图像是当前模型效果，细小表面细节较概念图简化。沿用现有截图和像素烟测，尚未冻结像素比较基线。未部署、打包、全关卡通关或进行手机真机性能测试。
