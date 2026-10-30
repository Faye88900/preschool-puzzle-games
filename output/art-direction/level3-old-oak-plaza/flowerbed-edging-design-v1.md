# 花坛边框模块设计图 v1

日期：2026-10-19
状态更新：2026-10-19 已使用 Three.js 制作并接入。源码 `src/flowerbed-edging.ts`；三个单体、组合 GLB 与四视图见 `artifacts/models/flowerbed-edging/`。后续按用户截图修订：场景组合已改为完整闭合花坛，并删除附近草丛；原设计图的开放组合仅保留为初始参考。以下保留原始概念记录。
图片：flowerbed-edging-design-v1.png

## 设计方向

延续古树广场既有奶油石、圆角石块、青绿叶饰和低矮绿植。提供直段、弧段、带叶饰端头三类构件；高度与截面统一，接口采用平切面，外露端头圆润。花草、土壤与边框分开摆放，组合可形成路边条状花坛及留开口的弧形花坛，避免封住座椅缺口和通行路线。

图片展示整体植物组合、三个无植物模块、顶视拼接示例和材质色板。它是造型参考，孤立弧段与拼装图的石块数量/曲率为示意；后续 Three.js 建模时需统一模块截面、半径、转角与接口，按实际场地确定尺寸和碰撞。当前没有修改关卡或生成 ZIP。

## 来源

内置 imagegen 生成原创设计图。参考 new-props-model-sheet-v1.png 右下花坛的石材与造型，参考 pergola-rest-nook-design-v1.png 的配色、圆角处理与板式。已目视确认直段、弧段、端头、组合效果及材质均可辨。

原图：C:\Users\yongting\.codex\generated_images\01a152e5-284b-7ba0-b1b8-ff0bf2b0615e\exec-af8baac8-4335-423e-9c0b-52e127d4d117.png

## 生成提示词

Create a polished landscape 16:9 ORIGINAL game prop concept design board for a modular LOW flowerbed edging kit for the Old Oak Plaza in a preschool-friendly Three.js low-poly garden game. Reference image 1: ONLY the flowerbed borders in the BOTTOM RIGHT quadrant provide the cream-stone shape/material reference, not the other props. Reference image 2: use ONLY the existing cream stone, restrained teal leaf emblems, rounded child-friendly bevels and ivory-paper concept-board typography and presentation. Do NOT include a pergola, tree bench, signpost, giant tree, timber fence, brass fittings, characters or whole game level. Clear Chinese title 花坛边框模块 · 设计图 and subtitle 古树广场专用. Layout: a large isolated three-quarter assembled flowerbed on the LEFT with low C-shaped cream-stone edging, rounded block faces, restrained warm stone flecks, a tiny teal three-leaf badge on one terminal. Soil is ground-level behind the curb and plants are separate: small fern clusters, low lime-green leaves, a few white daisies and restrained pale yellow flowers. Maintain low height and open space around the bed. This is a SINGLE COURSE stone CURB KIT, not tall planters or massive solid blocks and not a trough kit. On the RIGHT show three clear unplanted isolated modular components, same curb cross-section/height/thickness, spaced neatly: a STRAIGHT segment composed of three rounded cream-stone blocks labeled 直段, a clean QUARTER-CIRCLE curved segment composed of four wedge-shaped stone blocks labeled 弧段, and a compact rounded TERMINAL CAP with a teal leaf emblem labeled 端头. The straight and curved segments have FLAT matching cut ends so they can connect flush; only the exposed terminal end is rounded. Never depict a full U-shaped planter as a single segment. Bottom strip: small clean TOP-VIEW assembly examples with subtle joining seams, one straight border transitioning smoothly into a quarter-circle, and one C-shaped planting edge with two terminal caps leaving an obvious open front; short caption 自由拼接 · 留出通道. Include small material swatches 奶油石, 青绿, 深土, 叶绿 and footer 外观概念 · 待三维建模. One discreet callout 植物独立摆放. Crisp readable Chinese, refined cream background and forest-green text, coherent kit geometry across views, inviting soft 3D game render with gentle sunlight/contact shadows, uncluttered layout, no numerical dimensions, no oversized complicated plants covering the kit, suitable as direct reference for procedural Three.js modeling.
