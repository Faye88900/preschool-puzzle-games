# 古花园遗迹：断石柱、弧形石凳、远景残亭 v1

仅为设计讨论用概念图，由内置imagegen基于当前游戏实景编辑生成，未修改游戏代码或运行时资产。
图像：garden-ruins-additions-v1.png
实景底稿：test-results/first-encounter-ruins/user-view-after.png

## 新增布局
- 断石柱：拱门附近左右两侧，高低错落，沿场地边缘放置。
- 弧形石凳：左后角，面向场地中央，地面完整承托并与绿篱留出间距。
- 远景残亭：后方偏右、另一排绿篱之外，作为背景层次。
- 原有小骑士、角色、石拱门、叶纹石板、花瓶、桥入口和中央走位空间保留。

图像是设计意向，生成结果可能存在比例和细节偏差，不作为精确地图、碰撞或镜头的验证。
整体布局确认后，再补残亭独立建模参考图；本次未生成模型、未实现、未打包或部署。

## 最终提示词
```text
Use case: precise-object-edit / stylized-concept.
Create ONE integrated environment proposal image by editing the supplied screenshot of the existing original Bean Rush 3D game. Treat the supplied screenshot as the EDIT TARGET and exact layout/camera/world/character identity reference. This is a buildable environment design proposal for three additions only.
COMPOSITION INVARIANTS:
Keep the same elevated third-person camera angle, wide landscape framing, scale, flat rectangular first-knight courtyard, pale irregular flagstone paving and leaf medallion, existing ivory stone arch at the far end toward the right, ochre pennant, leaf shield crest, the existing broken boundary stone walls, urns, flower bowls, trimmed boxy green hedge maze, left bridge entrance, floating garden island and blue cloud sky. Preserve the tiny round black knight with amber eyes standing on the medallion in the middle distance. Preserve the pale lavender-white round original player with purple ear/wing shapes and mint leaf wand near the lower center. Keep the central battle floor and all existing passages open. Avoid redesigning or relocating the existing level. Remove the HUD/buttons/text overlays to make a clean scene design image, otherwise retain the view.
Add exactly these THREE environment elements, with meaningful hierarchy:
1. BROKEN STONE COLUMNS flanking the existing arch area, SEPARATE from the intact arch supports. One short weathered column left of the arch and one somewhat taller column to the far right side, both along the courtyard perimeter. Each has a chunky square ivory base, a simple softly octagonal shaft with two or three carved shallow courses, a jagged chipped top, a restrained leaf relief and a small moss patch. Heights roughly 1.5x and 2.5x the knight+helmet height respectively, much shorter than the 6m arch. Original friendly garden ruins, not ornate classical Corinthian columns. Do not place columns in front of or touching the knight; do not narrow the arch opening. They add asymmetric silhouettes at the boundary.
2. CURVED STONE BENCH in the LEFT REAR CORNER OF THE COURTYARD, nearer the far wall than the player and to the left of the knight, clearly on a dedicated pale stone pad within the perimeter. A small inviting approximately 100-degree crescent bench, warm ivory carved stone, rounded thick seat, two squat solid supports, a slightly chipped end and a faint leaf engraving. Open side faces the middle of the courtyard. It is a modest seating nook 2.5-3 player widths across, not a large circular arena, not a fountain or semicircular wall. Make the curved seat and both supports legible from the gameplay camera. Put it on ground level with contact shadow, visibly separate from the green hedges, urns and existing stone wall. Leave the left bridge entrance clear.
3. DISTANT RUINED GARDEN PAVILION beyond the BACK-RIGHT HEDGE ROW, OUTSIDE THE PLAYABLE COURTYARD. A small old open-sided octagonal garden pavilion on existing distant lawn: ivory stone columns, a partly missing shallow sage-green tiled roof, some ivy climbing up one column and creeping across the roof, one broken beam. Only the upper roof and a couple of columns peek above / between distant hedges, providing layered depth. It should appear substantially smaller in screen space than the foreground arch, with mild atmospheric softness, distinctly farther away. Place it to the upper-right of the arch, with a clear visible roof silhouette against sky, not directly on top of the arch and not framing the knight as a second huge gate. No new island or extra bridge. No glowing portal, no grand palace, no new objective.
CRITICAL SPATIAL QUALITY: Every stone object sits on a clear stone or grass pad. Keep readable air gaps between hedge foliage and the column bases / bench / urns. No stone or pottery embedded in green hedge cubes, no foliage clipping through seating, no floating supports, no intersecting props. Preserve the already-fixed clear spaces around existing urns and broken walls. The open center must remain generous and playable.
STYLE: Match the existing game's accessible rounded low-to-mid-poly 3D art: matte cream stone, soft bevels, simple broad shapes, restrained sage moss and peach flower accents, sunny warm lighting with consistent soft shadows. Enhance the three new assets enough for an environment designer to model them, but keep the rest of the scene close to the actual screenshot, not a wholesale hyper-detailed remake. Visual hierarchy: player and knight encounter first, original arch and supporting columns second, left bench a quiet secondary detail, distant pavilion a small background landmark. The image must communicate proximity, clear separation and buildable placement.
OUTPUT: one clean full-bleed wide game-camera scene design image. No split panels, labels, title, legend, arrows, watermarks, logos, new characters, enemies, chests, puzzles, extra lamp posts, additional buildings, waterfalls, stairs, elevation changes or blocked routes.
```

