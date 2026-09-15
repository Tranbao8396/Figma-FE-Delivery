# MCP Budget

This is a task-local control plane, not a representation of the provider quota. Set the budget conservatively from the task scope and known account constraints.

| Field | Value |
|---|---|
| Source mode | `web_only` / `web_plus_mcp` / `cache_fallback` |
| File key | |
| Target nodes and states | |
| Task call budget | |
| Reserve calls | |
| Calls used | |
| Last failure / quota signal | |
| Fallback owner | |

## Allocation Heuristic

- Reserve most calls for target frames/states that determine implementation; do not spend budget enumerating unrelated pages.
- Hold at least one call for a material mismatch, only when the external budget permits it.
- Combine related facts for one target node in a single context request where the tool supports it.
- A retry is permitted only after a transient failure and only when it can still produce new information. Never retry a quota error automatically.

The actual provider limit can vary by endpoint, plan, seat, and file location. Treat a documented or observed provider error as authoritative for the current task.
