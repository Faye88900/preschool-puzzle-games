# 云端冒险 · Bean Rush

Three.js + Rapier 3D 小游戏，支持电脑键盘和手机屏幕按钮。

- 第一关「天空赛道」：跑跳、避开障碍，前 8 名晋级。
- 第二关「解谜花园」：积木压机关、接通水管、引导小鸡，收集三把钥匙。
- WASD / 方向键移动，空格跳跃，Shift 冲扑，E 互动，H 提示，Esc 暂停。

## 交给同事上传

`bean-rush.zip` 是本地打包的网页。解压后，将 `index.html` 与 `assets`、`audio`、`fonts`、`images`、`models` 文件夹一起上传到网站的同一目录，保持名称和结构。

网站入口为该目录下的 `index.html`。支持网站子目录；无需安装 Node.js 或重新构建。请通过 HTTP / HTTPS 网站打开。

## 维护源码

需要 Node.js 22.12 或以上：

```sh
npm ci
npm run dev
```

构建：`npm run build`，结果在 `dist`。本地预览：`npm run preview`。

首页设置内可切换中文、英文、马来文，也支持 `?lang=zh`、`?lang=en`、`?lang=ms`。本次仅切换文字，语音仍沿用原有中文朗读。
首页设置可开关背景音乐、音效与语音，以及「4岁辅助转向」。辅助默认关闭，也可在赛道暂停菜单中切换：靠近左右边缘时帮助回正，跳跃和躲避仍由玩家控制。
运行 `node tests/feedback.test.mjs` 检查三语提示、旧设置兼容和辅助转向边界。素材来源和许可证保留在 `public` 中。
推送到 `main` 后，现有 GitHub Actions 会构建并更新 GitHub Pages。
