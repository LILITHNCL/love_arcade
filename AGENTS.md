# Codex project instructions

## Project-local frontend design skills

This repository includes project-local Agent Skills under `.agents/skills`.

Before making UI, layout, styling, accessibility, or animation changes, read the relevant `SKILL.md` files and use the smallest set of skills that fits the task.

| Skill | Use when |
| --- | --- |
| `frontend-design` | Building or substantially restyling a frontend page, component, layout, dashboard, landing page, or visual experience. |
| `baseline-ui` | Building or reviewing UI for spacing, typography, responsive behavior, Tailwind/CSS quality, visual hierarchy, and general frontend polish. Preserve the project’s existing stack. |
| `fixing-accessibility` | Reviewing or fixing semantic HTML, ARIA, labels, forms, dialogs, keyboard access, focus management, contrast, error states, or reduced-motion behavior. |
| `fixing-motion-performance` | Adding or reviewing animations, transitions, scroll-linked effects, layout thrashing, rendering performance, or animation jank. |
| `emil-design-eng` | Polishing microinteractions, motion taste, component details, interaction feel, and perceived product quality. |

## Skill selection

Do not use every skill by default.

For new UI or major redesigns:
- Use `frontend-design`
- Use `baseline-ui`
- Use `fixing-accessibility`
- Add `emil-design-eng` when interaction polish matters
- Add `fixing-motion-performance` when animation or transitions are involved

For UI review:
- Use `baseline-ui`
- Use `fixing-accessibility`
- Add `fixing-motion-performance` if the UI contains motion, transitions, scrolling effects, hover animations, or loading animations

For animation work:
- Use `fixing-motion-performance`
- Use `emil-design-eng`
- Use `fixing-accessibility` to ensure reduced-motion behavior is handled

## Frontend quality bar

Do not only make the feature work. Make it feel finished.

For frontend changes, check:

- Visual hierarchy is clear
- Primary action is obvious
- Spacing and alignment are consistent
- Typography is readable and intentional
- Layout works on mobile, tablet, and desktop
- Loading, empty, error, success, and disabled states are handled
- Interactive elements have hover, focus, active, and keyboard states where appropriate
- Accessibility is not degraded
- Existing behavior is preserved unless the user requested a behavior change

## Motion quality bar

Use motion only when it improves clarity, feedback, or perceived quality.

Prefer:
- `opacity`
- `transform`
- short, subtle transitions
- reduced-motion support

Avoid:
- layout jank
- excessive bounce
- slow decorative animations
- animating width, height, top, left, or other layout-heavy properties unless necessary
- adding animation that blocks interaction

## Dependency guardrail

Do not add runtime dependencies solely to satisfy a skill recommendation.

Prefer the project’s existing HTML, CSS, JavaScript, TypeScript, framework, components, styling system, and animation libraries.

Add a runtime dependency only when:
- the user directly requests it, or
- the project already uses that stack and the dependency is consistent with existing architecture

If a skill recommends a library that the project does not currently use, adapt the idea using the existing stack instead.

## Implementation workflow

Before editing:
- Inspect the existing component, styling, routing, and design patterns
- Reuse existing components, tokens, utilities, and conventions when possible
- Identify the smallest safe change that achieves the requested result

While editing:
- Keep product behavior stable unless requested otherwise
- Avoid broad rewrites when targeted changes are enough
- Keep components readable and maintainable
- Remove dead or duplicated UI code when directly related to the task

After editing:
- Review the diff for visual regressions, accessibility regressions, and unnecessary changes
- Run the relevant project checks when available
- If checks cannot be run, explain why

## Validation

Use the package manager and scripts already present in the repository.

Prefer relevant checks such as:

- lint
- typecheck
- test
- build
- formatting checks

Do not invent scripts. Inspect `package.json` or the repo documentation first.

## Completion summary

When finishing a frontend task, summarize:

- Which skills were used
- What changed visually
- What changed for accessibility
- What changed for motion or interaction polish
- What files were touched
- What validation was run
- Any risks, skipped checks, or follow-up recommendations

## Example prompts

Users can invoke skills explicitly, for example:

- `Use frontend-design and baseline-ui to build this page.`
- `Use frontend-design, baseline-ui, and fixing-accessibility to redesign this settings screen.`
- `Use fixing-accessibility to review index.html.`
- `Use fixing-motion-performance and emil-design-eng to polish this animation.`
- `Use baseline-ui and fixing-accessibility to audit this component before I ship it.`
