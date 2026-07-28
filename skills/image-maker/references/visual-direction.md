# Visual Direction Playbook

## Load when

Load this reference after a request is in scope for image making and before a brief is compiled. Use it for a new image, an edit, or a prompt-only artifact. Do not load it for visual analysis, a collection of prompts, interface implementation, or code work.

This playbook chooses visible decisions from the request's purpose. It does not prescribe a house style or a provider command format. User-facing briefs, handoffs, and completion notes are Korean by default unless the user requests another language.

## Establish the visual promise

State the intended use and the single effect the image must achieve. Then identify what a viewer should notice first, what should support it, and what may remain quiet. A useful brief separates:

- **Purpose:** the decision, feeling, or action the image should support.
- **Hierarchy:** the first, second, and background reading order.
- **Subject:** the specific person, object, place, or event and its decisive traits.
- **Boundary:** requested facts that must remain unchanged, especially for an edit.

Do not replace a missing decisive fact with a decorative assumption. Ask one focused question when the omission changes identity, exact rendered text, required content, or the meaning of the image; otherwise make a reversible, purpose-led choice and disclose it in the brief.

## Build the scene deliberately

Choose a composition that makes the hierarchy observable: framing, viewpoint, subject scale, placement, depth, empty space, and crop. Describe relationships rather than mood labels. For example, say where a product sits, what is behind it, and where the eye travels rather than calling it merely polished.

Choose light in terms of source direction, softness, contrast, shadow behavior, and separation. Choose color by role: dominant field, supporting range, accent, and contrast needed for reading. Choose material and rendering cues that explain surface response, edge behavior, texture, and medium without borrowing a named provider recipe.

When the request needs text inside the image, record the exact string in quotation marks and specify its reading priority, location, contrast, scale, and clearance. Never silently correct, translate, shorten, or invent rendered text. Text fidelity and legibility remain unverified until the resulting artifact is inspected.

## Maintain a series

For a multi-image request, write a small invariant set before producing the first image. Keep only the facts that make the set recognizably related, such as recurring subject traits, viewpoint logic, lighting character, palette roles, typography treatment, material language, or layout rhythm. Record each image's intentional variation separately so variation does not accidentally alter an invariant.

For an edit, name the supplied source as evidence, distinguish preserved from changed regions, and keep a new output separate from the source. Do not claim identity, continuity, or preservation merely because the instruction requested it.

## Inspect before making visual claims

Inspect the persisted artifact against the brief when inspection is available and required. Check the hierarchy, subject facts, composition, light, color roles, material cues, exact rendered text, and each series invariant that applies. Record observed defects rather than rephrasing the prompt as a result.

If inspection is optional but unavailable or uncertain after persistence, report that the artifact exists while explicitly withholding claims about visible constraints, rendered text, legibility, and series consistency. If required inspection is unavailable, fails, or shows a critical miss, stop the visual-success report. Follow the runtime capability guidance for the permitted route and terminal state; do not retry indefinitely or present a prompt as an inspected image.

## Brief record

Keep the working brief directly navigable with these fields:

```text
purpose:
hierarchy:
subject:
composition:
light:
color:
material_and_rendering:
rendered_text:
series_invariants:
preserved_or_changed_boundary:
inspection_checks:
assumptions_and_open_question:
```

Omit fields that genuinely do not apply, rather than filling them with placeholders. The record is a decision aid and inspection target, not proof that an image was generated or saved.
