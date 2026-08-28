# Agent Note: Taskbar icon escapes the shortcut AUMID to stay theme-adaptive

Status: implemented

English | [中文](2026-08-28-taskbar-icon-escapes-shortcut-aumid.zh.md)

## Problem

The installed app's taskbar icon never followed the OS theme: on a dark taskbar the black-whale icon was near-invisible. `applyThemeIcon` and the `nativeTheme` listener were in place, but the packaged app set its AppUserModelID to the same value electron-builder writes into the installed shortcuts, and Windows renders a taskbar button whose AUMID matches a shortcut with that shortcut's static icon, ignoring `window.setIcon` entirely. Only source runs (which already used a distinct `.dev` AUMID) showed the adaptive icon.

## Decision

The packaged app now uses a window-only AUMID (`io.github.baixu22.dshdesktop.window`) that matches no installed shortcut, so the taskbar button falls back to the window icon that `applyThemeIcon` restates on window creation and on every `nativeTheme` update. The desktop and Start Menu shortcuts keep electron-builder's default AUMID and their static black-whale icon; they are only launch affordances.

## Alternatives considered

**Keep the shortcut-matching AUMID and swap the shortcut's `.ico` per theme.** Rejected: `.ico` files carry no theme variants and Windows does not reload shortcut icons on theme change, so the icon would still be static.

**Make the packaged `.ico` mid-gray so it reads on both taskbars.** Rejected: it fixes visibility by abandoning adaptivity and dulls the icon in the shell surfaces that do use the shortcut icon on any background.

## Consequences

The taskbar icon tracks the OS theme in installed builds. A DSH instance pinned to the taskbar before this change, or a user who pins the running window, gets a second taskbar button distinct from the pinned shortcut because their AUMIDs differ; unpinning and re-pinning consolidates them. Toast notifications and other AUMID-keyed shell integrations now key on the window AUMID rather than the shortcut AUMID.

## Verification

With the OS in dark mode, an installed build's taskbar shows the white whale; switching the OS theme flips the icon without restarting, because the `nativeTheme` listener restates the window icon.
