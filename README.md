# 云端冒险 · Bean Rush

Three.js + Rapier 3D 小游戏，支持电脑键盘和手机屏幕按钮。

- 第一关「天空赛道」：跑跳、避开障碍，前 8 名晋级。
- 第二关「解谜花园」：积木压机关、接通水管、引导小鸡，收集三把钥匙。
- 第三关「风语迷宫」：帮助园丁找工具，获得风力魔杖，放下风车桥，遇到暗甲小骑士，再观察叶盾钥匙守卫的攻击空隙，取得钥匙并从捷径返回出口。入口为 `?level=3`。
- WASD / 方向键移动，空格跳跃，Shift 冲扑，E 互动，H 提示，Esc 暂停。

## 交给同事上传

运行 `npm run build` 后，将 `dist` 内的 `index.html` 与 `assets`、`audio`、`fonts`、`images`、`models`、`textures` 文件夹一起上传到网站的同一目录，保持名称和结构。旧版 `bean-rush.zip` 已清理，交付前须按当前源码重新构建。

网站入口为该目录下的 `index.html`。支持网站子目录；无需安装 Node.js 或重新构建。请通过 HTTP / HTTPS 网站打开。

## 维护源码

需要 Node.js 22.12 或以上：

```sh
npm ci
npm run dev
```

构建：`npm run build`，结果在 `dist`。本地预览：`npm run preview`。

首页设置内可切换中文、英文、马来文，也支持 `?lang=zh`、`?lang=en`、`?lang=ms`。本次仅切换文字，语音仍沿用原有中文朗读。
第三关的 E / 屏幕互动按钮会根据附近对象交谈、拾取或吹风；H 提示，Esc 暂停。第三关语音使用浏览器对应语言的朗读声音，设备需有相应语音。耗尽活力会回到安全点并保留本局进度；重新开始会清空本局，刷新不保存进度。
园丁任务：沿湿脚印寻找小车，推开后取出铲子，带回并在小花坛种下花苗；开花后获得风魔杖。可先自由探索再找园丁。专项检查运行 `node tests/gardener-quest.mjs`，环境变量与下方浏览器测试相同。
第三关复用 `public/models/SOURCES.md` 已登记的免费模型和原有音效；风车、魔杖、暗甲小骑士等为本项目组合建模。浏览器测试：设置 `PLAYWRIGHT_MODULE` 为已安装 Playwright 的入口，`TEST_URL` 为开发服务器地址，再运行 `node tests/maze-browser.mjs` 与 `node tests/level-selection.mjs`。小骑士模型、盾牌动画与场景检查运行 `node tests/dark-knight.mjs`；巡逻、追击距离、实际命中、键盘躲避、绕角与脱战返回、动作过渡和受击检查运行 `node tests/knight-animation.mjs`。测试注入仅发生在开发服务器响应中，不写入生产构建。
首页设置可开关背景音乐、音效与语音，以及「4岁辅助转向」。辅助默认关闭，也可在赛道暂停菜单中切换：靠近左右边缘时帮助回正，跳跃和躲避仍由玩家控制。
运行 `node tests/feedback.test.mjs` 检查三语提示、旧设置兼容和辅助转向边界。素材来源和许可证保留在 `public` 中。
推送到 `main` 后，现有 GitHub Actions 会构建并更新 GitHub Pages。

## 项目备份与接续

源码、运行素材、测试，以及 `artifacts`、`output`、`test-results` 中保留的概念图、生成记录、模型导出、截图和工作笔记均纳入 Git。`node_modules`、`dist`、日志、环境密钥和临时 ZIP 不纳入备份；换电脑后运行 `npm ci`，再运行 `npm run dev`。

2026-10-30 已完成 Boss 庭院第 13–16 项道具、植被、远景、环境动画，以及渡船视角和庭院配色修正；第 17 项整体验证仍待完成。进度见 `artifacts/concepts/boss-courtyard/PROGRESS.md`，单项记录在 `artifacts/models`。本次同时备份草地布局、渲染和地面稳定性改动及 `test-results` 下对应验证记录。历史测试结果代表当时验证，不代表每次备份均已重跑。
