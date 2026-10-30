# 环境动画与光效：参考与取舍

2026-10-30。设计图第 16 项。查阅其他游戏的官方介绍、开发者访谈与美术展示，再结合本项目现有道具和场景制作一张静态动画／光效设计板。

## 游戏参考

| 参考 | 查阅来源 | 本项目采用的设计方向 |
|---|---|---|
| Ghost of Tsushima／对马岛之魂 | [开发者问答](https://blog.playstation.com/2020/05/29/ghost-of-tsushima-your-questions-answered/)、[官方入门指南](https://www.playstation.com/en-us/editorial/ghost-of-tsushima-beginners-guide/) | 开发者说明将风和运动融入环境，并以风指引方向。本项目取“统一风向带动植物、落叶和布条”的表达；不增加风导航玩法。 |
| The Legend of Zelda: Breath of the Wild／旷野之息 | [任天堂制作幕后介绍：Open-air concept](https://www.nintendo.com/en-gb/News/2017/March/Go-behind-the-scenes-with-the-making-of-The-Legend-of-Zelda-Breath-of-the-Wild-1206592.html)、[官方游戏展示](https://www.nintendo.com/en-gb/Games/Nintendo-Switch-games/The-Legend-of-Zelda-Breath-of-the-Wild-1173609.html) | 作为开放场景、自然日光和环境可读性的美术参考，保留明亮裸石战斗地面。这是本项目的设计取舍，不是对其渲染算法的结论。 |
| Ori and the Will of the Wisps／奥日与萤火意志 | [官方美术与预告展示](https://www.orithegame.com/)、[官方预告主图](https://ori-prod.azureedge.net/wp-content/uploads/2021/08/WOTW-trailer-1024x786.png) | 从其美术展示取局部辉光与景深层次的方向，压低亮度并用于本项目巨剑风印、少量光尘和远景。保留庭院白昼配色，不照搬森林或角色。 |

以上动效分配、时长与强度都是本项目拟定方案；未对参考游戏做逐帧或渲染性能测量。没有将第三方截图拼入生成成品，生成工具输入为本项目已有庭院与风铃参考图。

## 拟定动画范围

| 系统 | 拟定节奏 | 画面约束 |
|---|---|---|
| 风与落叶 | 基础轻风，约 8–14 秒间隔的小阵风 | 少量叶片经过外围与背景，中央地面保持干净；不画常驻大风带 |
| 风铃与布条 | 铃叶约 2.5–4 秒小摆动，彼此错相；布尾滞后 | 固定石座／铜架／布结，三片铃叶分别摆动 |
| 绿丛、风草、花与藤 | 同一阵风驱动，草尖明显、绿丛与藤较轻 | 固定根部；不整体平移植被或岩石 |
| 三块悬浮碎岩 | 约 7–11 秒小幅上下浮动，各自错相 | 不绕剑公转、不越过场地、不大角度翻转 |
| 巨剑风印与裂隙 | 青绿风印／通道约 5–7 秒平滑呼吸，橙裂光更弱 | 发光限定在既有材质区域，不新增地面符文、光柱或闪屏 |
| 阳光、尘粒与远景 | 日光整体稳定，少量尘粒缓慢漂移 | 光束留在后侧／外围；已有水流继续，不重做瀑布；营火保持熄灭 |

风向与场景轴向在实际接入时统一校准；上表不是已实现的时间参数。暂停时停止，减少动态模式拟定为冻结碎岩／铃叶／植物、停落叶和光尘、保持稳定风印亮度。攻防预警优先于环境装饰亮度，不增加镜头抖动。

## 本次交付范围

`ambient-motion-light-design-sheet-v1.png` 为内置 imagegen 生成的静态设计图；完整输入保存在 `ambient-motion-light-design-sheet-v1-prompt.txt`，后续数量校正输入保存在 `ambient-motion-light-design-sheet-v1-edit-prompt.txt`。已查看并修正初稿多出的前景守卫和零碎浮岩，最终整体保留一座守卫石像与三块近景碎岩。

图中包含整体效果与六个分镜小图，用位置差和示意箭头表达动势，不能作为真实动画播放或游戏运行效果的证明。整体是美术氛围参考，接入时保留实际关卡尺寸与既有道具布局，不照图额外添加树木或地形。本次不修改游戏代码，动态效果、暂停／减少动态、视线和真机性能留待接入验证。
