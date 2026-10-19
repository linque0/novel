Plan: user-approved 大纲画布连线路由与流程图操作优化 (2026-10-19)

Scope: production outline canvas only; preserve existing dirty work and character graph. New works default ortho, old works retain bezier fallback. Unified geometry, adaptive collision, stable obstacle routing, manual preferences, transactional connect/reconnect gestures, one undo, compatibility, UI/performance verification.

Rulings:
- Work in current checkout on existing feature branch 前端重置, preserving pre-existing modifications. A HEAD-only worktree would omit the current canvas/skin work required by the approved plan. Baselines copied before edits; no commits requested.
- Hindsight tools are absent from callable metadata; discovery returned no matches. No memory claims used.
- Retain legacy cubic parameter and polyline arclength junction mapping through compatible parameter knots on the unified visible geometry.

Tasks:
- [x] Unified geometry and routing, regression tests
- [x] Relation transactions, compatibility and preferences
- [x] Flowchart gesture state, handles, snapping and cancellation
- [x] Selective cache and animation-frame updates
- [x] Production UI, skins/zoom, persistence/undo and benchmark
- [x] Final fresh review and fixes

Evidence: 48/48 baseline + 57/57 routing + 11/11 relation tests; 55/55 production interaction checks; build success. Four skins × two styles × three zooms checked; hit layer opacity zero, 20px non-scaling stroke. Native CUA route adjustment and endpoint reconnect preview/commit checked. Visible IAB 100-node/150-edge frame P95: ortho 16.6ms, bezier 11.2ms, 129 samples, 130 distinct positions. Detailed evidence and screenshots in docs/outline-routing-validation/README.md.

Review fixes: restore pre-gesture cache on cancellation; cascade deleted-node incoming hosts and their dependents; validate only affected host graph to tolerate unrelated legacy orphan references; skip blocked-host junction snap. Visual fixes: propagate obstacle correction across aligned manual points and allow shortened endpoint stubs; measure visible adaptive curve corridor overlap instead of endpoint chord. Fresh reviewer rechecked corrections, no important issues remaining.
