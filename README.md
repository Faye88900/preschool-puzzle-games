# Preschool Puzzle Games

幼儿益智小游戏 · 软糖冲刺 / Gummy Rush

Three.js + Rapier 的幼儿游戏。第一关：玩家与 11 名电脑同场比赛，前 8 名晋级，限时 90 秒。第二关：三把钥匙的解谜花园。支持电脑键盘和手机触控。

## 运行

需要 Node.js 22.12 或以上。

```sh
npm install
npm run dev
```

打开 http://127.0.0.1:5188/ 进入首页；第一关为 `?level=1`，第二关为 `?level=2`，角色预览为 `?character=1`。正式构建和预览使用 `npm run build`、`npm run preview`；浏览器测试使用 `npm test`，需要已安装的 Chrome。

键盘使用 WASD 或方向键移动、空格跳跃、Shift 冲扑、Esc 暂停。手机使用屏幕摇杆和动作按钮。页面需通过 HTTP 服务打开，不能直接双击 `index.html`。

## 文件结构

第二关入口：首页「选择关卡」中的第二关，或 `http://127.0.0.1:5188/?level=2`。
用 WASD / 方向键或摇杆移动，E / 屏幕手掌按钮互动，空格 / 问号按钮听提示，Esc 暂停。语音使用系统中文语音，静音同时关闭提示音和语音。

第二关是 78 × 96 的自由探索花园，中央广场和环形小路连接三个独立谜题，面积约为旧版的九倍。任意顺序完成，中途可以离开再回来：

- 积木工坊：找到黄色正方体，搬到方形机关上，铁门打开后进入房间拿钥匙。积木可以随时放下再拿起。
- 流水池塘：转动三段弯水管，把水源和小花接通；已接通的水管变蓝，全部连通后出现蓝色钥匙。
- 音乐花林：观察牌子的「圆形 → 星星 → 三角形」，按对应顺序敲响三朵花。敲错只重置本地顺序，不影响其他谜题或已有钥匙。

拿齐三把钥匙后，穿过花林后面的花园大门通关。没有计时、淘汰或强制游玩顺序。平时只显示当前区域和观察提示；主动按问号才出现临时方向引导，再次求助提供更具体的提示。保留第一关同款第三人称跟随视角、平滑转身、交替迈步和摆臂，搬运时双臂抱住积木。

设计参考：[Captain Toad](https://www.nintendo.com/us/store/products/captain-toad-treasure-tracker-108040/) 的观察环境寻找宝物，以及 [A Monster’s Expedition](https://www.monsterexpedition.com/) 的开放探索解谜；这里使用适合幼儿的三种简化规则，没有使用外部游戏素材。

`tests/puzzle.spec.ts` 检查六种解谜顺序、错误尝试、积木搬放、真实行走穿门、三锁出口、重玩复位、角色动画和手机视角/触控。浏览器触控模拟不等于真机验证；系统中文语音效果取决于设备语音包。
第二关独立在 `src/puzzle.ts`，复用现有角色、材质、标签和 UI。Rapier 仍为 1/120 秒固定步进，角色 capsule + CCD，铁门与出口各有独立 collider。两关共用 `src/movement.ts` 的速度 7.2、地面/空中加速、转向与迈步摆臂动画；互动半径 1.9，放置容差 2.5。桌面和手机均采用第一关的 55° 第三人称透视跟随，镜头位于角色后上方并看向前方；仅 `?test=1` 暴露测试定位接口。
skills 参考已读：Game Studio 的 `three-webgl-game`、`game-playtest`，`level-design`、`puzzle`、`threejs-gameplay-systems`；后者的 `gameplay-workflows`、`game-design-level-design`、`physics-engine-selection` 和两份完成检查清单均已读取。没有增加依赖或外部图片。

- `src/main.ts`：入口；`src/race.ts`：赛道、规则、物理和音效。
- `src/ai.ts`：电脑选手；`src/models.ts`、`src/scenery.ts`：模型与环境。
- `src/ui.ts`、`src/style.css`：界面；`public/audio/`：本地音效。
- `tests/race.spec.ts`：自动化测试；`scripts/inspect-threejs-canvas.mjs`：可选的画布检查工具。

`dist/`、`node_modules/` 和 `test-results/` 是生成或安装目录，已在 `.gitignore` 中排除。`artifacts/` 同样被排除，其中 `design/` 的旧截图和设计图片已清理；测试截图写入 `test-results/`。`audio-sources/` 只保留音效制作所需的原始片段、许可证和校验记录。测试生成的截图和报告可在验证后清理；音效制作源文件和许可证应保留。

