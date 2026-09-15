# Task Manifest

Create a compact manifest after analysis. It is the handoff contract for implementation, review, and quality control. Keep it specific to one task and do not place it in reusable framework context.

## Required Fields

```yaml
task:
  title: short task name
  delivery_mode: analysis_only | implement_existing_repo | scaffold_new_repo
  viewport_mode: desktop_only | responsive_required
evidence:
  figma:
    source: URL or screenshot reference
    frames: [page/frame/node identifiers]
  repository:
    path: local path or absent
    working_tree: clean | dirty | not_a_repo
  framework:
    requested: stack or unknown
    verified: stack/version or pending
rules:
  sources: [rule files or supplied instructions]
  summary: [task-relevant rules]
scope:
  included: [pages/components/states]
  excluded: [explicit exclusions]
  acceptance_criteria: [observable completion conditions]
```

## Analysis Sections

1. `Design inventory`: shell, pages, sections, shared components, layout constraints, token/asset candidates, and visible states.
2. `Component and file map`: existing files to reuse or proposed files for scaffold mode.
3. `Ambiguity register`: each item has `evidence`, `impact`, `decision` (`blocker` or `defaultable`), and `owner` if confirmation is needed.
4. `Implementation slices`: ordered work units, each small enough to verify with a command, screenshot, or focused test.
5. `Test plan`: UI, behavior, keyboard/accessibility, browser, visual, and end-to-end checks applicable to the selected scope.
6. `Estimate`: effort, confidence, dependency, and explicit coverage level (`static`, `mock`, or `production`).
7. `Implementation gate`: a short statement of what has to be true before code starts.

## Example Gate Decisions

- A POS table whose visible headings are placeholders but whose domain fields affect forms, export, and invoices is a `blocker`.
- A missing hover color for a non-primary control can be `defaultable` when the repository design system supplies an established hover token.
- A task marked `desktop_only` needs desktop visual checks and target-browser checks; it does not automatically require a mobile layout matrix.
