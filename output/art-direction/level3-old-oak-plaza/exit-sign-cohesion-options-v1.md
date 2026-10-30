# 出口标识协调优化方案

日期：2026-10-20
图片：exit-sign-cohesion-options-v1.png

## 已落实

按图1删除 `src/maze.ts` 中的风车桥独立文字牌 `sign-bridge`。原风叶指向牌和风车桥机关保留。未打包或更新 ZIP。

## 图2的问题与建议

原出口小牌沿用通用细杆木牌，和已美化的石柱/木拱/青绿门栅缺少连接关系；牌面较小，摆在门柱前方也显得临时。建议让标识与固定门框结合，使用青绿底、奶油字及少量铜钉，保持清楚的“出口 ↑”信息。

A（推荐）：门楣一体式，铭牌与拱梁正面贴合，位于叶徽下方。远处较易识别，和门成为完整入口。实际建模时需核对叶徽/门栅间隙、角色净空及手机可读性。
B：门柱侧铭牌，安装在左石柱上，位置较低、适合近看。字号与板宽受石柱宽度限制。

A 方案已于 2026-10-20 接入：`src/plaza-mechanisms.ts` 在固定 `gate-frame` 下加入略呈弧形的铜边深青绿铭牌、奶油色“出口”和向前箭头，叶徽略微上移以留出间距；`src/maze.ts` 删除原细杆出口牌，并把现有中文/英文/马来文出口文案传给模型工厂。铭牌随固定门框保留，门栅仍独立下沉，捷径门保持原有样式。

原始对比图及图内“尚未接入游戏”标注保留为方案阶段记录。实际结果见 `test-results/plaza-after/exit-nameplate-detail.png`、`exit-nameplate-desktop.png`、`exit-nameplate-mobile.png` 和 `exit-nameplate-open.png`；模型状态图及更新后的独立 GLB 位于 `artifacts/models/plaza-mechanisms/`。未打包 ZIP。

## 图像来源

内置 imagegen，根据用户图2当前游戏截图生成原创设计示意：C:\Users\yongting\AppData\Local\Temp\codex-clipboard-3e161b5b-299a-4788-a455-aa0ad3327636.png。
原始生成图：C:\Users\yongting\.codex\generated_images\01a152e5-284b-7ba0-b1b8-ff0bf2b0615e\exec-884ba356-afd8-4ffa-8c0e-e82b5d91d6cb.png。

## 生成提示词

Create a landscape 16:9 two-option Chinese game environment design comparison board based on the supplied actual screenshot. The subject is ONLY a redesign of the small EXIT SIGN at the teal gate. Preserve the exact friendly low-poly game style: blocky green hedge walls, sandy path continuing into meadow, cream stone posts, warm honey wooden arch, circular teal leaf crest, teal vertical-bar grille, large brass central lock. NO overhaul of the gate silhouette or scenery. Use two generous equal panels, same front three-quarter camera view and identical gate proportions in both so only signage changes. Remove the freestanding beige sign on its thin wooden leg in BOTH options. Do not show characters or HUD. Main title 出口标识 · 协调优化. LEFT panel heading A · 门楣一体式（推荐）: integrate a compact wide, subtly curved dark-teal nameplate FLUSH with the FRONT face of the honey wooden arch, just below the original round leaf crest, with cream Chinese text 出口 and a clear UPWARD arrow meaning onward. Make lettering easily readable, subtle brass corner fasteners, maintain clean visual separation between the crest and lettering and comfortable doorway headroom. It should feel designed as part of the arch, no hanging chains or dangling sign. RIGHT heading B · 门柱侧铭牌: keep the arch and crest exactly as the screenshot, attach a small rounded dark-teal plaque directly to the FRONT of the LEFT stone gatepost around chest height, with cream text 出口 and a small upward arrow, brass fasteners, solidly mounted flush on the pillar, no leg, no freestanding object, do not intrude into walkway. Make the right plaque more compact than the left nameplate but readable. Both designs share the existing teal/cream/brass palette and simple rounded game shapes, clean matte materials, bright original game lighting. Bottom captions respectively 远处易读 · 入口更完整 and 近看清晰 · 门柱承载. Footer 方案示意 · 尚未接入游戏. Avoid adding flowers, bushes, lanterns, extra emblems, new locks, ornate metalwork, frames around the entire game scene or unrelated signs. Keep the actual game simplicity, not a photorealistic fantasy painting. This is a comparison DESIGN IMAGE, not runtime proof.
