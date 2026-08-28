# Agent Note: Backend unpacked by the installer, not at first launch

Status: implemented

English | [中文](2026-08-28-installer-unpacked-backend.zh.md)

## Problem

The Windows installer carried the backend as a gzip tarball in Electron Builder resources, and the first launch of every install (and every version upgrade) spent ~84 seconds extracting it before the app window could load the backend URL. Users read that pause as the application being slow, and the extraction step also duplicated state under `userData/backend-<version>` that had to be detected, reused, or replaced across upgrades.

## Decision

The backend ships as an unpacked extraResources directory. `stage-backend` produces the deployment tree at `desktop-backend/` (deploy, NTFS hard-link detach, frontend overlay) and stops there; Electron Builder packs the directory itself, and the NSIS installer expands it into `<install>/resources/backend` during installation. `prepareBackendRoot` validates `BACKEND_RUNTIME_PATHS` directly under `process.resourcesPath/backend` on every startup and never extracts anything. The tarball, the extraction helper script, the `.desktop-backend-ready` marker, and the versioned `userData` staging directory are all removed. The profile-plugin anchor calibration runs on every startup against the (now version-stable) resources path.

## Alternatives considered

**Extract in a NSIS `customInstall` macro with `tar.exe`.** Rejected: it reintroduces an extraction tool as a runtime dependency of installation, adds a custom NSIS script surface to maintain, and still leaves a compressed tarball in the payload that NSIS must then store anyway — double compression without benefit over shipping the directory.

**Keep first-launch extraction but cache more aggressively.** Rejected: every version change invalidates the cache, so the 84-second cost recurs on each upgrade — exactly the case users complained about most.

## Consequences

Application startup no longer depends on extraction at all: the measured cold start after install is on par with later launches. The installer and its download grow modestly (NSIS LZMA re-compresses the tree), and installation takes longer than before because the installer now does the expansion — a one-time cost paid while the user already expects setup work. A partially uninstalled or corrupted install is detected by the same `BACKEND_RUNTIME_PATHS` validation and fails loud with the missing paths.

## Verification

`pnpm run desktop:pack` produces an installer whose `resources/backend` holds the deployment tree; a silent install then reaches backend HTTP readiness in seconds on first launch, and `apps/desktop/tests` covers the manifest and runtime-path contract.
