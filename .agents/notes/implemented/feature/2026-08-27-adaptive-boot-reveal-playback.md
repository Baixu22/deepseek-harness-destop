# Agent Note: Adaptive boot reveal playback

Status: implemented

English | [中文](2026-08-27-adaptive-boot-reveal-playback.zh.md)

## Problem

The web boot page's brand reveal sweep mapped the visible sweep position straight onto the real loader ratio (activated entries over roster total). The client plugin roster activates in a few hundred milliseconds, so the "DeepSeek Harness" wordmark animation compressed into a flash, and the mount handoff landed on the last activation and cut the easing tail mid-flight. A fixed longer boot delay would solve the flash but make every startup feel slow regardless of how fast the machine actually loads.

## Decision

`BootPage` in `@deepseek-ai/dsh-client-web` plays the complete reveal sweep out to at least the minimum playback duration exported as `BOOT_REVEAL_MIN_MS` (1500 ms). While loading, the sweep keeps easing toward the real activated-over-total ratio and never reports completion before the roster settles. Once the ratio reaches one, playback advances the remaining sweep so the whole animation lasts at least `BOOT_REVEAL_MIN_MS` from page construction: a fast boot renders the full reveal at a proportionally faster pace, and a boot slower than the minimum already tracked real progress and hands over as soon as the last entry activates.

`AppWebEntry.run` awaits `BootPage.awaitReveal()` between entry activation and the UI renderer mount, so the animation always plays to completion before the application takes the mount point. The plugin tree is already active at that point, so the wait gates only the visual handoff, never readiness. `awaitReveal` settles on sweep completion, on `fail()`, or on `dispose()`, so a failure report and teardown are never gated behind the animation.

The playback loop runs on a 16 ms `setTimeout` tick instead of `requestAnimationFrame`: rAF frames never run in occluded tabs, which would strand a backgrounded reload on the boot page forever while the time-based floor self-corrects after a throttled timer fires.

## Alternatives considered

**Fixed longer boot delay.** Rejected because it taxes every startup with the worst-case wait regardless of real load time, exactly the sluggishness the adaptive pace exists to avoid.

**Mount the application immediately and overlay the finishing animation on top.** Rejected because the ui-renderer already snapshots and hydrates the boot DOM for a one-frame handoff; a second overlay surface would duplicate boot-page ownership of the wordmark without buying any readiness, since the reveal gate shows the tree is already active by handoff time.

**Keep requestAnimationFrame and add a timeout cap to the handoff wait.** Rejected because the cap's timer callback is a defensive branch no test can reach, which the per-file 100% coverage gate rejects; the playback loop is pure arithmetic on `setTimeout` that settles on completion, failure, or disposal, so no real stall path needs the cap.

**Slow the existing easing factor instead of adding a duration floor.** Rejected because easing-only duration still depends on when activation events arrive, so the reveal could still flash on a bursty fast boot or linger unpredictably.

## Consequences

A fast boot pays at most `BOOT_REVEAL_MIN_MS` of additional visual time before the handoff while the plugin tree is already active; a boot slower than the minimum pays nothing extra. Every reload shows the complete brand sweep. The boot-page spec pins the frame-less synchronous settle, the failure and disposal settles, and the minimum-duration playback under fake timers; the boot spec pins that the mount happens only after the playback settles.
