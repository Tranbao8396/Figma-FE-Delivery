# Design Snapshot

Create one compact Markdown or JSON snapshot per task/file revision outside the customer repository. Keep raw tool output out of the artifact.

```markdown
# Figma Snapshot: <project> / <screen>

## Provenance
- Source mode: web_plus_mcp
- File key: <file key>
- Captured: <ISO timestamp>
- Design revision evidence: <updated link, visible timestamp, or customer confirmation>
- Snapshot status: current / stale / quota_exhausted

## MCP Budget
- Task budget: <n>
- Used: <n>
- Reserve: <n>
- Calls: <node + reason + timestamp>

## Frames and States
| Node | State | Viewport | Confirmed facts | Confidence | Source |
|---|---|---:|---|---|---|

## Assets and Tokens
| Item | Confirmed value/reference | Source | Notes |
|---|---|---|---|

## Ambiguity / Invalidation
| Item | Impact | Decision | Trigger to refresh |
|---|---|---|---|
```

Use the design-evidence ledger from `figma-frontend-implementation` to map this snapshot to code. The snapshot stores design facts; the ledger stores implementation decisions and visual acceptance.
