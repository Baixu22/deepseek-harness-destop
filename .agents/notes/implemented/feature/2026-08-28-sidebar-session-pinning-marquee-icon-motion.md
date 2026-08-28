# Agent Note: Sidebar session pinning, hover title marquee, and explicit icon hover motion

Status: implemented

English | [中文](2026-08-28-sidebar-session-pinning-marquee-icon-motion.zh.md)

## Problem

The workspace sidebar had four accumulated rough edges. Sessions could not be pinned, so a session a user returns to repeatedly stayed wherever its workspace group and recency sort put it. Long session titles were simply truncated with an ellipsis; the hidden remainder was unrecoverable. The sidebar, list header, and settings icons had no hover response or an inconsistent one, so hovering gave no confirmation of what a control would do. And the settings About section's repository hover card stopped rendering: its preview image came from a remote screenshot service (microlink) whose response never arrives in the environments where the desktop app runs, and the card failed whole instead of degrading.

## Decision

**Pinning is view state in the workspace store, filtered through derivation.** `pinnedSessionIds: string[]` records pin order in the workspace view store (`packages/client/ui-workspace/src/client/stores.ts`); the persisted shape changes, so the storage key moves from `dsh.workspace.view.v5` to `v6` — `attachPersistence` replaces the whole persisted state instead of merging fields, so a same-key field addition would resurrect stale shapes as `undefined`. `derivePinned` (`tree.ts`) filters the id list against live nodes, dropping archived sessions, stale subagent rows, and blank sessions that are not the current one, and `deriveGroups` removes pinned ids from their workspace groups. Both list renderers (`SessionTree`, `FlatList`) draw a pinned section above the groups with its own header and separator; pinned rows opt out of drag (their `::before`/`::after` slots belong to the card layers instead) and blank sessions expose no pin verb in the row menu.

**The pinned card is a stacked deck, not a z-index bump.** A pinned row keeps `position: relative; z-index: 1` over the section background and carries two pseudo-element under-layers (`::before`, `::after`, both `z-index: -1`) that widen on hover — the pin-list stacked-cards look. The 10px row gap inside the pinned section reserves room for the under-layers so they never overlap the next card or the first workspace header. Pin badge and row actions (pin, ellipsis) stay visible on pinned rows, and the timestamp hides because the verbs take its place — nothing overlaps the title.

**The marquee travels exactly the measured overflow, inside a clipping span.** `titleMarquee` (`rows/Rows.tsx`) measures `scrollWidth - clientWidth` on pointer enter and stores it plus a duration (40px/s, 1.2s minimum) as `--marquee-shift`/`--marquee-duration` on the row. The title renders as an outer `.title` (the existing ellipsis box) wrapping an inner `.titleText` inline-block span; hover (or an open row menu) starts a `title-marquee` alternate-infinite CSS animation on the inner span only, after a 300ms delay so a passing cursor does not trigger it. Hovering switches the outer box to `text-overflow: clip`, so the moving text can never escape its own clipped box regardless of shift value.

**Every animated icon has one named from→to transform.** Search button glyph scales to 1.12, header icon buttons lift 1px, the view-options and settings gear rotate 90°, the new-session plus rotates 90°, shell rail icons scale to 1.08, and the collapsed-rail panel icon plays a scale-and-fade pop on swap (`WorkspaceBrowser.module.css`, `SidebarRoot.module.css`, `SettingsRoot.module.css`, all `prefers-reduced-motion` disabled).

**The About repository card is local.** The HoverCard renders the full repository URL in code type plus a copy hint, with `copyText`/`copyLabel` on the card itself for click-to-copy. No network request participates, so the card renders wherever the app runs.

## Alternatives considered

**A CSS-only marquee with a fixed shift (e.g. `translateX(-100%)`).** Rejected: a percentage shift scrolls the span by its own full width, overshooting short overflows and underscoring long ones; only the measured pixel delta moves the text exactly the hidden amount.

**A JS `requestAnimationFrame` marquee loop.** Rejected: the same measurement drives a CSS `@keyframes` animation, so the loop would add main-thread work per row per frame for no visual difference; the reduced-motion and open-menu cases stay pure CSS.

**Layering with only `z-index` and a shadow.** Rejected: a flat lift does not read as stacked cards, the look the request names; pseudo-elements were free precisely because pinned rows do not participate in drag, which is also why they carry the constraint.

**Keeping the microlink preview with a graceful fallback.** Rejected: the fallback would be a local URL card anyway, and the remote hop only added a failure mode and latency before showing it.

**Merging the new store field on persist load.** Rejected: `attachPersistence` assigns the persisted state wholesale; the repository's pre-release stance (`AGENTS.md`) keeps no compatibility promise for on-disk formats, so the version-key bump is the sanctioned reset.

## Consequences

Pin order is the order pins were made; unpinning returns a session to its workspace group at its normal sort position. The pinned section reserves vertical space even for one row, and the under-layers constrain that section's minimum spacing. The marquee runs only while hovered or while the row menu is open, alternates instead of looping, and cannot paint outside the title box at any shift value; the measurement runs once per pointer entry, not per frame. Users with `prefers-reduced-motion` get the pinned card and all icons static. The persisted workspace view resets once at the v5→v6 key move (sidebar expansion state and search history are the contents at stake). The About card now depends on no network, and the `aboutPreview`/`aboutPreviewImg` styles and `REPO_PREVIEW` constant are gone.

## Testing

`tree.client.spec.ts` pins `derivePinned` filtering, `deriveGroups` exclusion, and the store toggle order; `rows.client.spec.tsx` pins `titleMarquee` measurement, the pin/unpin menu verbs, the badge, the no-wiring and blank-session cases; `browser-styles.client.spec.ts` pins the marquee CSS (measured-shift variable, inner-span-only animation, clip on hover), the pinned card layers, the pinned-section separation, and the reduced-motion blocks; `workspace-browser.client.spec.tsx` mounts the list, pins a session through the store, and asserts the section renders above the groups and the row returns on unpin. `SidebarRoot.module.css` and `SettingsRoot.module.css` icon motion and the About local card are covered by real-browser screenshot review on the desktop build.
