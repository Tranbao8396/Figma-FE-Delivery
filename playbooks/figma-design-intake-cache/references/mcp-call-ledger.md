# MCP Call Ledger

Keep one append-only ledger per task/file in the task context. It measures every Figma MCP request across intake, implementation, review, and QC.

| ID | Phase | Requester | Target node/state | Reason | Authorized by | Budget effect | Outcome | Snapshot/bundle revision | Time |
|---|---|---|---|---|---|---|---|---|---|

## Rules

- `Requester` is the actor that needs a fact; `Authorized by` is the intake owner, reviewer, QC owner, or human approver who approved actual MCP consumption.
- Record failed, rejected, and quota-exhausted attempts as well as successful calls.
- Retries need a new row and a transient-failure reason. A quota error never permits an automatic retry.
- A call is reusable only when its output is summarized into a named snapshot/bundle revision.
