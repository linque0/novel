---
name: ns-continuity-reviewer
description: Full manuscript audit skill for physical movement, item inventory, character injury tracking, timeline alignment, and fact consistency.
version: 1.0.0
category: editing
difficulty: intermediate
dependencies: [world-canon-manager]
recommended_with: [developmental-editor, prose-editor]
estimated_tokens: 1700
compatible_genres: [all]
compatible_pov: [all]
supports_revision: true
supports_planning: false
supports_editing: true
---

# Purpose
Audits chapter and manuscript text for physical, temporal, and factual continuity errors. Tracks physical movements, carried items, character injuries, eye/hair color consistency, geography, and event sequences.

# When to Use
- Running a continuity audit pass over completed chapters or full manuscript drafts.
- Verifying physical movement and spatial logic in complex action scenes.
- Auditing character injuries, inventory changes, and timeline synchronization.

# Inputs
- Manuscript chapters (`draft_manuscript.md`).
- `world_bible.md`, `character_dossiers.md`, and `timeline_index.md`.

# Outputs
- `continuity_audit_report.md` (Flagged errors categorized by Severity: Critical, Moderate, Minor).
- Fact tracking updates for `canon_index.json`.

# Workflow
1. **Fact Index Extraction**: Extract active state per scene (who is present, what they carry, physical condition, time of day).
2. **Spatial Logic Check**: Track physical movements (entering/exiting rooms, distance traveled, weapon hand usage).
3. **Timeline Alignment**: Cross-reference story timestamps, travel durations, and weather conditions against `timeline_index.md`.
4. **Injury & Inventory Audit**: Verify injuries persist realistically across scenes and items carried match inventory logs.
5. **Report Generation**: Output clear error locations with line references and recommended corrections.

# Quality Gates
- Every scene must be verified against character physical states (e.g., an injured left arm cannot be used to wield a heavy sword 10 minutes later).
- Zero unaddressed timeline paradoxes or teleporting characters across scenes.

# Common Failure Modes
- **Magical Healing**: Forgetting character injuries between chapters.
- **Disappearing Objects**: Key items vanishing or appearing without being picked up or stowed.
- **Eye/Hair Color Shifts**: Inadvertently altering physical character traits across distant chapters.

# Related Skills
- `world-canon-manager`
- `developmental-editor`
- `story-architect`

