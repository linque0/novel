---
name: ns-prose-editor
description: Comprehensive prose polisher combining line editing, copy editing, 'show don't tell' conversion, sensory enhancement, and sentence rhythm optimization.
version: 1.0.0
category: editing
difficulty: intermediate
dependencies: [voice-style-analyser]
recommended_with: [dialogue-editor, narrative-humanizer, fiction-writer]
estimated_tokens: 2100
compatible_genres: [all]
compatible_pov: [all]
supports_revision: true
supports_planning: false
supports_editing: true
---

# Purpose
Polishes draft prose line-by-line. Eliminates weak filter words, converts flat emotional telling into sensory physical action, varies sentence lengths for optimal cadence, and tightens grammar while respecting author style.

# When to Use
- Polishing chapter prose after macro structural edits are complete.
- Converting abstract or telling descriptions into visceral sensory details.
- Smoothing out awkward sentence rhythms, repetitive syntax, or clunky phrasing.

# Inputs
- Raw chapter draft (`draft_chapter.md`).
- `voice_profile.yaml` (Sentence targets and stylistic boundaries).

# Outputs
- `edited_prose.md` (Polished prose draft).
- Line-editing diff summary (List of key improvements and rationale).

# Workflow
1. **Filter Word Removal**: Strip unnecessary filter phrases (e.g., "she saw", "he felt", "they noticed", "it seemed").
2. **Show Don't Tell Transformation**: Replace abstract emotion tags (e.g., "he was furious") with physical reactions and sensory anchors.
3. **Cadence & Rhythm Smoothing**: Alternate short punchy clauses with compound rhythmic sentences to eliminate monotonic cadence.
4. **Sensory Depth Injection**: Layer tactile, olfactory, visual, and auditory cues directly into actions.
5. **Precision Word Choice**: Replace weak verb-adverb pairs (e.g., "walked slowly") with strong specific verbs (e.g., "ambled", "trudged").

# Quality Gates
- Filter word density must be reduced by >80% compared to raw draft.
- Sentence length variation must show healthy distribution (mixing 3-8 word punchy lines with 15-25 word flowing lines).
- Original narrative meaning and character tone must remain intact.

# Common Failure Modes
- **Over-Smoothing**: Stripping away intentional stylistic oddities that give the author or narrator unique voice.
- **Purple Prose Overkill**: Over-decorating every sentence with excessive adjectives and complex metaphors.
- **Passive Voice Saturation**: Overusing passive verb constructions that weaken prose momentum.

# Related Skills
- `fiction-writer`
- `dialogue-editor`
- `narrative-humanizer`

