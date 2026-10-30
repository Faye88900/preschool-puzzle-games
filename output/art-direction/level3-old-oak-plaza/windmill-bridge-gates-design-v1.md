# 风车、桥与双门美化

日期：2026-10-19
设计图：windmill-bridge-gates-design-v1.png
实现：src/plaza-mechanisms.ts，保持原有 rotor、bridge-deck、gate-grille 独立结构。

参考当前广场的暖木、奶油石、黄铜、青绿叶徽。此前古树出口概念的拱门轮廓落实为真正的固定门框与下沉门栅。参考 Kena 木石门与环境结合、动森木桥栏杆的视觉层次，转化为明亮圆润的原创建模；没有提取游戏资产，不添加新任务。

参考页面：https://www.playstation.com/en-us/games/kena-bridge-of-spirits/ ; https://www.neoseeker.com/kena-bridge-of-spirits/walkthrough/Honor_Adira ; https://www.tumblr.com/chamomile-crossing/619109464837079040/i-couldnt-find-a-fake-bridge-pattern-designed-to

当前设计以图片为外观目标，尺寸与运动服从既有关卡：风车转子局部 (0,2.5,-.86)，桥沿近岸原铰点转动，门栅沿 Y 下沉4单位。桥两侧固定石桥墩和门柱保留独立碰撞。没有重建地形、植物、花坛或 HUD。

图像使用内置 imagegen，原图 C:\Users\yongting\.codex\generated_images\01a152e5-284b-7ba0-b1b8-ff0bf2b0615e\exec-acdd46db-e218-4ae0-9a19-742516f7499e.png 。参考本项目 pergola-rest-nook-design-v1.png 与 exit-gate-states-v1.png。

## 生成提示词

Create a cohesive original 16:9 landscape 3D game prop art-direction board titled 风车 · 桥 · 双门美化方案, subtitle 古树广场配套设施. Reference image 1 ONLY for existing honey timber, cream stone, brass fasteners, teal leaf emblems, rounded bevels and ivory-paper concept-board style. Reference image 2 ONLY for the arch-shaped timber/cream-stone EXIT gate identity and teal grille with a readable gold keyhole; do NOT copy its environment, plants, characters or paving. Four generous clearly separated panels with original rounded low-poly preschool garden game props, isolated on cream background: top left labeled 风车机关: small faceted cream-stone windmill tower with honey timber horizontal bands, dark teal polygon conical roof, FOUR cream panel sails on timber spoke frames, brass axle hub, small teal window, tiny leaf emblem. Keep rotor obviously separate from tower, no large building extensions. Top right labeled 可升降木桥: short straight 5-unit-long timber drawbridge, evenly spaced chunky planks, low safe rounded railings on both sides with cream post caps, brass hinge pins at near bank and two visible underside reinforcement beams. Show bridge lowered in large main view, plus one small side silhouette showing entire bridge tilted up about its near-bank hinge, no ropes across walking lane. Bottom left labeled 青绿出口门: two stout cream stone pillars, an arched honey timber lintel with teal-and-gold leaf crest, a teal vertical-bar grille and large front-facing brass keyhole medallion. Bottom right labeled 暖木捷径门: matching cream pillars and lower timber arch, honey-wood vertical grille, teal leaf badge and smaller gold lock. Both gate designs use ONE single rigid grille that lowers vertically into ground when unlocked, NOT hinged double doors: for each gate add a small simple open-state sketch showing the arch intact and clear doorway, caption 门栅下沉后通行. Keep grille low enough to hide fully in a 4-unit downward travel. All props maintain the existing friendly garden scale, clean readable silhouettes, palette cohesion and buildable shapes. Restrained crest leaves only, NO ground grass/bushes/flowerbeds, no new quests, no magic portal, no extra lantern clutter, no numerical engineering measurements. Soft bright Three.js-like lighting, gentle contact shadows, readable Chinese text, balanced composition, footer 外观参考 · 保留原机关流程.
