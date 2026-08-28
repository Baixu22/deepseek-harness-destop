# Agent Note: Taskbar icon escapes the shortcut AUMID to stay theme-adaptive

Status: implemented

[English](2026-08-28-taskbar-icon-escapes-shortcut-aumid.md) | 中文

## Problem

安装版应用的任务栏图标从不跟随系统主题：深色任务栏上黑鲸图标几乎不可见。`applyThemeIcon` 和 `nativeTheme` 监听都在位，但打包版把 AppUserModelID 设成了 electron-builder 写入安装快捷方式的同一个值，而 Windows 对 AUMID 匹配到快捷方式的任务栏按钮会渲染该快捷方式的静态图标，完全忽略 `window.setIcon`。只有源码运行（早已使用独立的 `.dev` AUMID）能看到自适应图标。

## Decision

打包版现在使用一个不匹配任何已安装快捷方式的窗口专属 AUMID（`io.github.baixu22.dshdesktop.window`），任务栏按钮因此回落到窗口图标——`applyThemeIcon` 会在窗口创建时和每次 `nativeTheme` 更新时重新设置它。桌面和开始菜单快捷方式保留 electron-builder 的默认 AUMID 和静态黑鲸图标；它们只是启动入口。

## Alternatives considered

**保留匹配快捷方式的 AUMID，按主题更换快捷方式的 `.ico`。** 否决：`.ico` 文件没有主题变体，Windows 也不会在主题切换时重新加载快捷方式图标，图标依然是静态的。

**把打包版 `.ico` 改成中灰色，让它在两种任务栏上都可读。** 否决：这是用放弃适应性换取可见性，而且会钝化那些在任意背景上使用快捷方式图标的 shell 界面。

## Consequences

安装版的任务栏图标跟随操作系统主题。在此改动之前固定到任务栏的 DSH 实例，或把运行中窗口固定下来的用户，会得到一个与固定快捷方式不同的第二个任务栏按钮，因为两者的 AUMID 不同；取消固定再重新固定即可合并。Toast 通知和其他以 AUMID 为键的 shell 集成现在以窗口 AUMID 而非快捷方式 AUMID 为键。

## Verification

操作系统处于深色模式时，安装版的任务栏显示白鲸；切换系统主题无需重启即可翻转图标，因为 `nativeTheme` 监听会重新设置窗口图标。
