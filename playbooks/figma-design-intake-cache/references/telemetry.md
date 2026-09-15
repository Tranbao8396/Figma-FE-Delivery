# Optimization Telemetry

Record task-level counters in the context pack or a sibling summary. These are proxy measurements for optimization; do not claim exact model token usage unless the runtime exposes it.

| Metric | Definition | Target signal |
|---|---|---|
| `figma_mcp_calls_total` | All ledgered MCP calls | Lower without lost evidence |
| `duplicate_call_count` | Same fact/node read despite current snapshot | Zero unless authorized invalidation |
| `snapshot_hit_rate` | Snapshot-hit plans / all resolved plans | Rising over repeated phases |
| `refresh_rate` | Authorized node refreshes / covered nodes | Low, explained by design changes |
| `raw_context_chars` | Characters loaded from raw tool output | Falling as packs are reused |
| `pack_section_reads` | Named pack sections loaded by phase | Proves selective loading |
| `review_qc_mcp_calls` | MCP calls from normal review/QC path | Zero |
| `evidence_coverage` | Executed visual cases with comparable reference/render | High before approval |

At close, compare the counters with task scope and note only observed outcomes. A lower call count is not success if evidence coverage or post-review defect rate worsens.
