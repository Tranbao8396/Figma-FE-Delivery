# Figma Context Pack

The context pack is a task-local, section-addressable digest. It is the default input for downstream skills and must fit in a small, selective read. Store it outside the customer repository alongside snapshot/bundle artifacts.

```markdown
# Figma Context Pack: <project/task>

## Index
| Section | Purpose | Source artifact/revision | Last verified |
|---|---|---|---|

## Scope and Rules
- Delivery/viewport mode, customer rule snapshot, explicit exclusions.

## Source and Build
- Verified framework/version, root commands, target files, reusable local patterns.

## Design Map
| Screen/state | Node | Viewport | Component/layout facts | Confidence | Snapshot section |
|---|---|---:|---|---|---|

## Tokens and Assets
| Token/asset | Confirmed value/reference | Usage | Source |
|---|---|---|---|

## Ambiguity and Decisions
| ID | Fact | Impact | Decision | Owner | Refresh trigger |
|---|---|---|---|---|---|

## Quality Handoff
- Bundle revision, browser/viewport matrix, applicable test suites, external report profile.

## Budget and Telemetry
- Budget, used/reserved, plan/ledger paths, cache hit notes, quota fallback.
```

## Loading Rules

- Analysis reads `Scope and Rules`, `Source and Build`, `Design Map`, and `Ambiguity and Decisions`.
- Foundation/implementation read their target screen rows plus `Tokens and Assets`; they do not load unrelated screens.
- Review reads `Scope and Rules`, changed screen rows, `Ambiguity and Decisions`, and `Quality Handoff`.
- QC reads `Design Map` target rows, `Quality Handoff`, and the quality evidence bundle.
- Do not copy raw MCP output, screenshots, command logs, `node_modules`, generated files, or full customer chat into the pack. Link to artifacts instead.
