# DSH Desktop

English | [中文](README.zh.md)

DSH Desktop is a community desktop edition of [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness): the full Harness web UI plus its local backend, packaged as an Electron app inside a DeepSeek-official-inspired shell.

> Community project, not an official DeepSeek AI product. The DeepSeek name and whale mark belong to their owner.

## Highlights

- **Electron packaging for three platforms** — Windows NSIS installer ships today; macOS (dmg/zip, x64 + arm64) and Linux (AppImage/deb) targets are wired into the `desktop-release` workflow.
- **Automatic updates** — electron-updater feed on [GitHub Releases](https://github.com/Baixu22/deepseek-harness-destop/releases/latest) with blockmap delta updates; in-app top actions provide a repository link and a manual "check for updates" control.
- **Official-style hero landing** — ink-wash backdrop, interactive particle grid and the "探索未至之境" cursor-blend spotlight interaction, ported from deepseek.com.
- **Theme-adaptive window icon** — the taskbar and shortcut icons follow the light/dark theme (black and white whale variants), applied through the app's AUMID.
- **Reasoning-effort slider** — a GLSL blue-flame intensity slider docked in the composer; levels are probed at runtime from the model menu, never hardcoded.
- **Custom efforts per provider** — the custom-provider dialog offers a themed multi-select dropdown to declare which common effort levels a gateway serves; the composer menu honors it.
- **Conversation utilities** — prompt-rail navigator for long sessions, completed-turn tidying, hover-hold context popover.

## Install

Grab the latest installer from [Releases](https://github.com/Baixu22/deepseek-harness-destop/releases/latest).

| Platform | Artifact | Status |
| --- | --- | --- |
| Windows x64 | `DSH-Windows-x64-Setup-*.exe` | shipping |
| macOS x64 / arm64 | `DSH-macOS-*-*.dmg` / `.zip` | CI target wired, parked |
| Linux x64 | `DSH-Linux-x64-*.AppImage` / `.deb` | CI target wired, parked |

The installer is not code-signed yet; Windows SmartScreen may warn — verify the published SHA-256 before installing.

## Run from source

Node.js 22.19+ and pnpm 11.7:

```sh
git clone https://github.com/Baixu22/deepseek-harness-destop.git
cd dsh-desktop
pnpm install
pnpm run build
pnpm run dsh            # Harness web UI on 127.0.0.1:4173-ish port
pnpm run desktop:dev    # Electron shell over the local backend
```

## Package a release

```sh
pnpm --filter @baixu22/dsh-desktop run package:win    # or :mac / :linux / :all
```

Pushing a `v*` tag runs the three-platform release workflow and publishes installers plus the electron-updater feed (`latest.yml`, blockmaps) to GitHub Releases.

## Project home

[github.com/Baixu22/deepseek-harness-destop](https://github.com/Baixu22/deepseek-harness-destop) — issues, releases and roadmap live here.
