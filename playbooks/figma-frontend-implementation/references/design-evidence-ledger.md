# Design Evidence Ledger

Use this artifact as a compact, task-local handoff. Store it outside the customer repository unless the customer explicitly requires delivery documentation there.

| Screen/state | Viewport | Figma node/reference | Code mapping | Evidence source | Confidence | Assumption or deviation | Acceptance |
|---|---|---|---|---|---|---|---|
| Dashboard/default | 1400px | `47:8` | `DashboardPage`, `.dashboard` | Figma web + MCP context | high | Panels remain static placeholders; no chart spec | pending screenshot |

## Rules

- Use one row for each meaningful screen/state; split repeated components only when their evidence differs.
- `Confidence` is `high`, `medium`, or `low`; low confidence on visible behavior/copy is a blocker unless the customer approves a default.
- Cite a Figma node, screenshot filename, or precise reference. “Figma” by itself is not enough.
- `Assumption or deviation` must state why it is safe, who approved it, or what must be clarified.
- `Acceptance` is `pending`, `matched`, `known deviation`, or `blocked`. Only mark `matched` after rendered comparison at the stated viewport.
