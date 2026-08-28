# DSH Desktop

[English](README.md) | 中文

DSH Desktop 是 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的社区桌面版：完整的 Harness Web UI 与本地后端，封装进 Electron 应用，外壳复刻 DeepSeek 官网视觉。

> 社区项目，非 DeepSeek 官方产品；DeepSeek 名称与鲸鱼标识归其所有者。

## 特色

- **三平台 Electron 封装** — Windows NSIS 安装包已发布；macOS（dmg/zip，x64 + arm64）与 Linux（AppImage/deb）目标已接入 `desktop-release` 流水线。
- **自动更新** — 基于 [GitHub Releases](https://github.com/luo-ross/dsh-desktop/releases/latest) 的 electron-updater 更新源，支持 blockmap 增量更新；应用内顶部动作区提供仓库链接与手动「检查更新」。
- **官网同款启动页** — 水墨背景、可交互粒子网格、"探索未至之境" 光标 blend 聚光交互，均从 deepseek.com 移植。
- **主题自适应窗口图标** — 任务栏与快捷方式图标跟随亮/暗主题（黑白鲸鱼双版本），通过应用 AUMID 生效。
- **推理强度滑块** — 停靠于 composer 的 GLSL 蓝色火焰强度滑块；档位运行时从模型菜单探测，不硬编码。
- **自定义提供方强度** — 自定义提供方对话框提供主题化多选 dropdown，声明网关支持哪些常见强度；composer 菜单按声明呈现。
- **会话实用插件** — 长会话用户输入导航 rail、会话结束整理、悬停按住上下文弹层。

## 安装

前往 [Releases](https://github.com/luo-ross/dsh-desktop/releases/latest) 下载最新安装包。

| 平台 | 产物 | 状态 |
| --- | --- | --- |
| Windows x64 | `DSH-Windows-x64-Setup-*.exe` | 已发布 |
| macOS x64 / arm64 | `DSH-macOS-*-*.dmg` / `.zip` | CI 目标已接入，暂挂 |
| Linux x64 | `DSH-Linux-x64-*.AppImage` / `.deb` | CI 目标已接入，暂挂 |

安装包暂未签名，Windows SmartScreen 可能告警；运行前请核对发布的 SHA-256。

## 源码运行

Node.js 22.19+、pnpm 11.7：

```sh
git clone https://github.com/luo-ross/dsh-desktop.git
cd dsh-desktop
pnpm install
pnpm run build
pnpm run dsh            # Harness Web UI
pnpm run desktop:dev    # Electron 外壳
```

## 打包发布

```sh
pnpm --filter @baixu22/dsh-desktop run package:win    # 或 :mac / :linux / :all
```

推送 `v*` tag 即触发三平台发布流水线，安装包与更新源（`latest.yml`、blockmap）自动上传到 GitHub Releases。

## 项目主页

[github.com/luo-ross/dsh-desktop](https://github.com/luo-ross/dsh-desktop) — issue、release 与路线图均在此。
