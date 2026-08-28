# Agent Note: Backend unpacked by the installer, not at first launch

Status: implemented

[English](2026-08-28-installer-unpacked-backend.md) | 中文

## Problem

Windows 安装包以 gzip tarball 的形式把后端放在 Electron Builder 资源里，每次安装（以及每次版本升级）后的首次启动都要花约 84 秒解压，应用窗口才能加载后端 URL。用户把这段停顿理解为应用很慢；而且解压步骤还会在 `userData/backend-<version>` 下复制一份状态，升级时必须检测、复用或替换。

## Decision

后端以未压缩的 extraResources 目录随包交付。`stage-backend` 在 `desktop-backend/` 生成部署树（deploy、NTFS 硬链接断链、前端覆盖）后即停止；Electron Builder 直接打包该目录，NSIS 安装程序在安装过程中把它展开到 `<install>/resources/backend`。`prepareBackendRoot` 每次启动直接在 `process.resourcesPath/backend` 下校验 `BACKEND_RUNTIME_PATHS`，不做任何解压。tarball、解压辅助脚本、`.desktop-backend-ready` 标记文件和版本化的 `userData` 暂存目录全部移除。profile 插件锚点校准每次启动都针对（现已版本稳定的）resources 路径运行。

## Alternatives considered

**在 NSIS `customInstall` 宏里用 `tar.exe` 解压。** 否决：这会重新引入一个作为安装运行时依赖的解压工具，增加需要维护的自定义 NSIS 脚本面，而且负载里仍然要放一份压缩 tarball 供 NSIS 存储——双重压缩，相比直接交付目录没有任何收益。

**保留首启解压但更激进地缓存。** 否决：每次版本变更都会使缓存失效，84 秒的成本会在每次升级时重现——这正是用户抱怨最多的场景。

## Consequences

应用启动完全不依赖解压：实测安装后的冷启动与后续启动持平。安装包体积和下载量适度增长（NSIS LZMA 会重新压缩目录树），安装耗时比以前更长，因为展开工作由安装程序完成——这是用户本来就预期安装阶段工作的一次性成本。卸载不完整或损坏的安装由同一套 `BACKEND_RUNTIME_PATHS` 校验发现，并带上缺失路径响亮失败。

## Verification

`pnpm run desktop:pack` 产出的安装程序在 `resources/backend` 下携带部署树；静默安装后，首次启动在数秒内达到后端 HTTP 就绪，`apps/desktop/tests` 覆盖 manifest 与运行时路径契约。
