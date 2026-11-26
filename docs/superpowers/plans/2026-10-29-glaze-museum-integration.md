# 琉光美术馆主题产品接入

Approved by user 2026-10-29. Reference prototype: C:/Users/linque/.codex/visualizations/2026/10/28/01a1815e-1eaa-7371-a7e9-0ebde8cc86db/glaze-museum-study.html

## Binding requirements
- Integrate real Vue/Naive UI/editor/store behavior across shelf, editor, outline, lore, characters, snippets, settings, shared dialogs and ordinary detached windows. Exclude independent Dream workbench and AI windows.
- Full uncropped paintings, carved gilt frame, plaster cornice, museum label, celadon wall and directional environmental light. No easels or 3D shelf covers.
- Shelf desktop 42:58, 32–40px gap; 6 directory rows visible at 1440x900, 4 at 1080x680. Work title 36–40px, module24–28, normal14–16, helper>=12.
- Complete current work info and menu/continue/outline binding; selection-only row click, explicit opening, cycling, keyboard navigation; stale chapter guards retained.
- Reusable GlazeArtwork with natural ratio, loading/error/preview. Painting choice decodes and persists before display; latest request wins, failed choice preserves prior state, cross-window sync.
- Workbench defaults approx240/260 side widths, readable640–760 body width while preserving user settings, resizing, editor identity, cursor and scroll. Narrow panes become accessible drawers rather than disappear.
- All CRUD/actions continue through existing product services. No demo logic. Scope style/provider changes to writing surface and owned overlays, including editor Teleport. No DB migration or dependencies. Session lighting switch.
- Use local licensed assets; preserve all unrelated working changes. Do not commit/push/release.

## Tasks
1. Artwork, preference concurrency, ornaments and shared museum theme.
2. Real shelf with selected work, real actions and responsive catalog.
3. Workbench/panels/settings/overlay scope and responsive UX.
4. Targeted regressions, native dev/app protocol checks, performance, visual review, build and evidence.

## Acceptance
0/1/2/6/100 works; long names/missing data; all paintings contain/no parent crop; keyboard/focus/error states; 1440x900/1080x680/800x680/actual200%; all modules save/readback and rapid selection; cross-window + Dream isolation; 6work first usable P95<=200ms and no image main-thread task>100ms. Isolated profiles only. Deliver screenshots and recording with honest limitations.
