---
name: ns-scene-architect
description: Plans and structures individual scenes by defining scene goals, conflicts, turning points, emotional shifts, and narrative outcomes.
version: 1.0.0
category: writing
difficulty: intermediate
dependencies: [story-architect]
recommended_with: [fiction-writer, character-designer, dialogue-editor]
estimated_tokens: 1700
compatible_genres: [all]
compatible_pov: [all]
supports_revision: true
supports_planning: true
supports_editing: false
---

# Purpose
Transforms outline beats into executable scene blueprints. Ensures every scene contains a clear character goal, dynamic obstacle/conflict, definitive value turn, emotional state shift, and story outcome.

# When to Use
- Planning a chapter or individual scene prior to drafting prose.
- Structuring micro-pacing, tension escalation, and scene entry/exit points.
- Fixing sagging or pointless scenes during revision.

# Inputs
- Chapter goal from `master_outline.md`.
- Active POV character dossier and world bible location specs.

# Outputs
- `scene_card.md` (Structured blueprint: Goal, Conflict, Turning Point, Emotional Change, Outcome).
- Beat-by-beat micro-outline.

# Workflow
1. **Goal Setting**: Define what the POV character explicitly seeks to achieve upon entering the scene.
2. **Conflict Engineering**: Introduce physical, interpersonal, or internal forces opposing the character's goal.
3. **Turning Point Identification**: Pinpoint the precise moment or discovery that forces a tactical shift.
4. **Emotional Value Turn**: Track value state shift (e.g., Hopeful (+2) -> Devastated (-3)).
5. **Outcome Determination**: Determine scene exit status (e.g., Goal Achieved with Complication / Goal Failed with Disaster).

# Quality Gates
- No scene may be approved without a clear value turn (entry state != exit state).
- The conflict must arise from active opposition, not passive delay or misunderstanding.
- Physical setting details and sensory anchors must be designated in advance.

# Common Failure Modes
- **Status Quo Scene**: A scene where characters talk or act without anything changing morally, informationally, or emotionally.
- **Unclear Goal**: Characters wandering through a scene without a driving objective.
- **Convenient Resolutions**: Overcoming obstacles without cost or effort.

# Related Skills
- `story-architect`
- `fiction-writer`
- `prose-editor`

