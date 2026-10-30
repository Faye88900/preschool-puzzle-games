# 第一次遇怪：林间小哨站 v1

设计讨论用概念图，由内置 imagegen 生成，尚未实现到游戏。
文件：woodland-outpost-v1.png
场景依据：artifacts/models/dark-knight/game-desktop.png（本地已有截图）。
保留圆润玩家、黑甲小骑士、绿篱迷宫、风力魔杖和中央走位空间。主要新增旧石板、叶棚哨站、边缘景物和少量落叶。
设计图不能作为精确布局、碰撞、运行性能或手机效果的验证。

## 参考与转化
- Kirby and the Forgotten Land / Natural Plains：参考花草、旧物和绿地的层次组织，不复用角色或关卡。
  https://www.nintendolife.com/guides/kirby-and-the-forgotten-land-natural-plains-all-missions-and-collectibles
  https://www.nintendo.com/en-gb/Games/Nintendo-Switch-games/Kirby-and-the-Forgotten-Land-2045110.html
- Captain Toad: Treasure Tracker：参考紧凑小景、成组道具和清晰路线的构图。
  https://www.nintendo.com/sg/switch/ajh9/index.html

## Final prompt
```text
Use case: stylized-concept.
Create ONE finished 16:9 landscape environment design image for the existing original Three.js browser game Bean Rush, redesigning ONLY its first easy monster encounter after a garden windmill bridge. This is a scene concept, not code or an advertisement.
REFERENCE IMAGE: the attached local game screenshot is the composition/layout, world, existing player and existing enemy identity reference. Preserve the player: small round pale lavender-white bean-like explorer seen from behind, purple petal-like ears/wings, holding its slender mint/blue leaf wind wand. Preserve the first enemy: ONE tiny round charcoal-black toy knight with short limbs, glowing amber eyes under a rounded black helmet, small lowered shield. Never replace either with Kirby, Mario, Toad or another known game character.
DESIGN DIRECTION: Original 'Leaf-Shield Woodland Outpost'. Borrow environmental composition principles from the grassy Natural Plains stages of Kirby and the Forgotten Land (lush layered vegetation around worn surfaces, groups of flowers, softly rounded forms, readable enemy silhouettes), and the compact miniature stage composition of Captain Toad Treasure Tracker (small meaningful prop clusters, clear leading paths, strong handcrafted landmarks). Original assets, no copied level geometry, no franchise branding.
LAYOUT / CAMERA: A single immersive elevated third-person GAMEPLAY CAMERA view close to the screenshot's camera, not an orthographic dollhouse, not a top-down map. Player lower center in foreground, small black knight middle center facing the player, onward hedge maze corridor visible beyond the encounter toward upper center. The wood bridge entry remains suggested at far lower-left edge. Keep the original rectangular hedge-walled clearing footprint, continuous FLAT walkable ground, tall soft box-shaped green maze hedges around it and the clear blue sky/cloud floating-garden setting. Improve richness inside the existing footprint; do not turn it into a different level. The path must remain open. Tall objects at far edges, not hiding either character.
SCENE DESIGN:
- Break up the huge uniform pale dirt floor with a weathered, irregular pale-gray moss-jointed stone-paver patch beneath and just behind the knight. Let pavers taper naturally into sandy dirt, NOT a formal circular arena. Small grass tufts, a few thin roots, a short broken trail of tiny knight footprints. Central approach and retreat area stays spacious, mostly flat and uncluttered.
- A memorable small rustic guard post just BEHIND AND TO THE SIDE of the knight: two warm honey-brown wooden posts, a modest curved green leaf-like fabric canopy, one short muted ochre pennant, a small hanging charcoal shield emblem echoing the knight. A charming minor garden outpost, not a house or fortress. Keep the onward route fully open, do not invent a locked gate.
- Asymmetric edge clusters: on one side a low weathered tree stump, two wooden supply crates, a few terracotta pots, three peach/red capped mushrooms and thick ferns; on the other a rounded mossy rock cluster, rounded shrub, small white and buttery-yellow wildflowers, a low short wooden fence following the edge. Props look deliberately grouped and varied in height, not scattered uniformly.
- A couple of warm green rounded tree crowns and natural vine sprigs beyond the hedge make the background layered. Soften long bare hedge faces with occasional climbing greenery and flower clusters at their bases. Keep recognizable hedge maze shapes.
- Subtle visible motion cues only: a few golden-green leaves drifting in a gentle wind near the knight and a softly curved pennant. No attack blast, no battle chaos.
STYLE / LIGHTING: Polished but buildable stylized real-time 3D game environment, rounded low-to-mid-poly assets compatible with screenshot, matte painted wood, simple soft grass, broad readable shapes. Bright inviting late-morning sunshine, warm ground and cool green shade, soft contact shadows, restrained atmospheric depth. Cheerful gentle first encounter for children, not scary. Color hierarchy greens and sandy cream, warm wood, yellow/peach flower accents; dark knight clearly stands out. Render characters legibly, small scale but not lost.
OUTPUT: One full-bleed beautiful gameplay-view environmental concept image. No HUD, health bars, labels, words, logos, title, watermark, layout panels, arrows or borders. No new enemy, reward chest, NPC, puzzles, steps, raised platforms, cliffs through the play space, giant mushrooms, waterfall, castle, photorealism or cinematic depth-of-field blur. Preserve usable central movement space.
```

