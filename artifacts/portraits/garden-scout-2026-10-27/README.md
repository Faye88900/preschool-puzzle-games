# 芽芽对话立绘与表情

六张原始透明 PNG 保存在本目录，均为 1254×1254。内置 `image_gen` 先以已确认的 `artifacts/concepts/garden-scout-2026-10-27/scout-character-sheet-v1.png` 为人设参考生成招呼立绘，再以招呼图为参考编辑另外五种表情，保留服装、道具、体态、光照和画面位置。对应完整提示词保存在各自的 `*-prompt.txt`。没有使用截图头像代替人设立绘。

| 原始立绘 | 表情 | 对话用途 | 完整生成提示词 |
| --- | --- | --- | --- |
| [greeting.png](greeting.png) | 招呼 | 首句自我介绍 | [prompt](greeting-prompt.txt) |
| [thinking.png](thinking.png) | 思考 | 宝箱尚未打开、准备答题 | [prompt](thinking-prompt.txt) |
| [surprised.png](surprised.png) | 惊讶 | 晶石升起、拾取提示 | [prompt](surprised-prompt.txt) |
| [guiding.png](guiding.png) | 指路 | 晶石已收好，指向码头 | [prompt](guiding-prompt.txt) |
| [encouraging.png](encouraging.png) | 鼓励 | 提醒返回守卫岛取钥匙 | [prompt](encouraging-prompt.txt) |
| [celebrating.png](celebrating.png) | 开心庆祝 | 拿到钥匙、出口打开 | [prompt](celebrating-prompt.txt) |

运行资源位于 `public/images/garden-scout-dialogue/*.webp`，每张 512×512，共 413,430 字节。`prepare-assets.mjs` 使用已有 Sharp 缩小和编码 WebP（quality 92、alphaQuality 100），保持透明通道，没有更改构图或绘画内容。六张高清原图仍保留原字节；尺寸、Alpha 与大小记录在 `asset-metrics.json`。

`src/maze.ts` 按当前台词选择表情并预加载整组素材。复用现有对话框的桌面与手机布局。原有园丁、主角头像和芽芽固定朝向/近处招手逻辑不变。旧 `garden-scout-dialogue.png` 是模型渲染检查图，已不作为当前对话立绘。

`tests/garden-scout.mjs` 检查八条台词与六种立绘的对应关系、图片加载、透明像素和四角、旧头像分支及桌面 1280×800、手机竖屏 390×844、短横屏 844×390。真实游戏截图和结果位于 `artifacts/models/garden-scout-v2/scene/`、`production/`。`expressions-overview.png` 为浏览器渲染的表情总览。尚未进行实体手机或线上部署验证。
