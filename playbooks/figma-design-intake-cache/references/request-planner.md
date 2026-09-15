# Figma Request Planner

Create an append-only plan before every Figma MCP request or refresh request.

| Plan ID | Phase | Target node/state | Needed fact | Classification | Cheaper sources checked | Artifact update | Authority | Decision | Ledger ID |
|---|---|---|---|---|---|---|---|---|---|

## Decision Rules

- `local_context`, `web_reference`, and `snapshot_hit` resolve without MCP. Record the evidence path or section used.
- `MCP_required` needs a precise missing fact, budget availability, and authority before the tool is called.
- `blocked` names the missing material fact and the customer input needed; it is never converted to `MCP_required` merely to avoid asking.
- One plan may cover multiple facts only when they belong to the same node/state and a single context request can answer them.
- A rejected or quota-exhausted plan remains in the log. It cannot be silently replaced with a retry.

## Normal Path Example

`implementation` needs spacing already stored in `pack:design/desktop-layout` -> `snapshot_hit` -> no MCP call. A missing component variant creates a new `MCP_required` plan for that node only.
