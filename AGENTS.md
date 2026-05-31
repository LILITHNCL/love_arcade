# Codex project instructions

## Project-local frontend design skills

Use the skills under `.agents/skills` when the task matches their scope. Read the relevant `SKILL.md` before making UI changes or performing a UI review.

| Skill | Use when |
| --- | --- |
| `frontend-design` | Building or substantially restyling a frontend page, component, or visual experience. |
| `baseline-ui` | Building or reviewing UI and applying a consistent quality baseline. Treat stack-specific advice as conditional: preserve the project's existing stack. |
| `fixing-accessibility` | Adding or reviewing interactive controls, forms, dialogs, keyboard behavior, focus management, semantic HTML, ARIA, contrast, or reduced-motion support. |
| `fixing-motion-performance` | Adding or reviewing animation, transitions, scroll-linked effects, or rendering-performance-sensitive UI behavior. |
| `emil-design-eng` | Polishing interactions, motion, component details, and the perceived quality of an interface. |

Combine skills when appropriate. For example, use `frontend-design`, `baseline-ui`, and `fixing-accessibility` together for a new UI; add `fixing-motion-performance` and `emil-design-eng` when the work includes animation or detailed interaction polish.

## Dependency guardrail

Do not add runtime dependencies solely to satisfy a skill recommendation. Prefer the project's existing HTML, CSS, JavaScript, components, and libraries. Add a runtime dependency only when an applicable skill explicitly requires it **and** the project already uses that stack, unless the user directly requests a stack change.

## Invoking skills in Codex

Users can invoke a skill by naming it in the request, for example:

- `Use frontend-design and baseline-ui to build this page.`
- `Use fixing-accessibility to review index.html.`
- `Use fixing-motion-performance and emil-design-eng to polish this animation.`
