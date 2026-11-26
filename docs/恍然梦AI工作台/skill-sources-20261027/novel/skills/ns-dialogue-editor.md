---
name: ns-dialogue-editor
description: Specialized editor for dialogue realism, unspoken subtext, character voice distinctiveness, speech beats, and conversational tension.
version: 1.0.0
category: editing
difficulty: intermediate
dependencies: [character-designer, voice-style-analyser]
recommended_with: [prose-editor, narrative-humanizer]
estimated_tokens: 1900
compatible_genres: [all]
compatible_pov: [all]
supports_revision: true
supports_planning: false
supports_editing: true
---

# Purpose
Refines spoken dialogue in scenes. Replaces generic "on-the-nose" exposition with layered subtext, distinct character vocal signatures, realistic speech interruptions, non-verbal action beats, and emotional tension.

# When to Use
- Editing scene dialogue that feels stiff, unnatural, or overly informative.
- Adding unspoken tensions, hidden motives, and double meanings underneath spoken lines.
- Ensuring characters sound distinct from one another without relying on heavy accents or clunky dialogue tags.

# Inputs
- Draft scene prose containing dialogue exchanges.
- `character_dossiers.md` and `character_voice_sheets.md`.

# Outputs
- `polished_dialogue.md` (Revised dialogue and action beats).
- Subtext analysis matrix (Spoken Line vs. Unspoken Intent).

# Workflow
1. **Exposition Scrub**: Strip out "As you know, Bob" info-dumps where characters explain things both already know.
2. **Subtext Layering**: Rewrite lines so characters talk around their true emotional needs or conceal secrets.
3. **Voice Differentiation**: Verify each character uses syntax, sentence length, and vocabulary reflecting their background and mindset.
4. **Dialogue Tag Streamlining**: Replace adverbs in dialogue tags ("she said angrily") with grounded physical action beats.
5. **Rhythm & Interruption Tuning**: Add natural speech pauses, trailing thoughts, and cross-talk interruptions.

# Quality Gates
- Dialogue tags must be limited primarily to "said", "asked", or physical action beats.
- Every spoken exchange must advance the scene goal, reveal character, or escalate conflict.
- Blind read test: Removing character names from speech blocks should still leave speaker identities clear via voice alone.

# Common Failure Modes
- **On-the-Nose Speech**: Characters explicitly stating their deepest inner feelings and hidden motives without hesitation.
- **Talking Heads**: Long dialogue exchanges taking place in a vacuum without physical setting interaction or action beats.
- **Over-Written Dialect**: Phonetic spelling of accents that slows reading speed and causes reader friction.

# Related Skills
- `character-designer`
- `prose-editor`
- `narrative-humanizer`

