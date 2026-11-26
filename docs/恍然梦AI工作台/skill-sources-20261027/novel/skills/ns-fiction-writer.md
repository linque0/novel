---
name: ns-fiction-writer
description: Primary prose drafting engine. Transforms scene plans and voice specs into immersive, momentum-driven fiction prose.
version: 1.0.0
category: writing
difficulty: advanced
dependencies: [scene-architect, voice-style-analyser]
recommended_with: [world-canon-manager, character-designer, narrative-humanizer]
estimated_tokens: 2500
compatible_genres: [all]
compatible_pov: [all]
supports_revision: false
supports_planning: false
supports_editing: false
---

# Purpose
Executes the actual prose drafting of scenes and chapters. Focuses on forward momentum, sensory immersion, emotional resonance, and faithful adherence to the scene blueprint and voice profile.

# When to Use
- Generating initial first-draft chapter text from an approved scene blueprint.
- Drafting specific scene beats with rich sensory texture.
- Converting structured outlines into flowing narrative prose.

# Inputs
- `scene_card.md` (Scene beats, goals, and turning point).
- `voice_profile.yaml` (Sentence metrics, tone guidelines, and vocabulary rules).
- `character_dossiers.md` and `world_bible.md` context.

# Outputs
- `draft_chapter.md` (Complete raw narrative prose for the scene/chapter).

# Workflow
1. **Context Alignment**: Load scene plan, voice profile targets, character mindsets, and setting sensory anchors.
2. **First Pass Drafting**: Write forward without self-editing, following the specified beat sequence.
3. **Sensory Layering**: Embed sight, sound, smell, texture, and visceral internal sensations into prose.
4. **Voice Profile Enforcement**: Apply target sentence length variation and vocabulary palettes.
5. **Beat Verification**: Ensure entry goal, conflict, turning point, and exit emotional state are fully rendered.

# Quality Gates
- Draft must follow the scene plan beat sequence without omitting the turning point.
- Prose must adhere to the POV psychic distance defined in `voice_profile.yaml`.
- Prioritize drafting momentum over premature line-editing perfectionism.

# Common Failure Modes
- **Over-Editing Drift**: Stopping mid-draft to polish sentences, breaking narrative flow and momentum.
- **Telling Over Experience**: Summarizing emotional turns in abstract terms instead of rendering sensory actions.
- **Voice Homogenization**: Falling back to generic AI phrasing instead of following `voice_profile.yaml`.

# Related Skills
- `scene-architect`
- `voice-style-analyser`
- `narrative-humanizer`

