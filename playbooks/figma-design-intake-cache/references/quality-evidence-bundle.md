# Quality Evidence Bundle

This task-local bundle is the only Figma design input for ordinary review and QC. It lives outside the customer repository and references the design snapshot; it does not contain credentials or raw MCP output.

## Provenance

- Bundle revision and status: `current` / `stale` / `quota_exhausted`.
- Snapshot revision, Figma file key, covered node/state/viewport set.
- Approved reference screenshots/exports with capture time and checksum when available.
- Asset/font confirmation, browser baseline, and known dynamic regions.

## Visual Comparison Matrix

| Screen/state | Reference | Render target | Viewport/DPR/zoom | Browser | Dynamic mask approval | Acceptance status |
|---|---|---|---|---|---|---|

## Refresh Requests

| Request ID | Target node/state | Trigger | Render evidence | Severity | Owner decision | Ledger ID |
|---|---|---|---|---|---|---|

## Rules

- A bundle can support `evidence_ready`, never unilateral delivery `PASS`.
- Reference and render are comparable only when viewport, state, font/assets and capture environment are recorded.
- Screenshots are immutable artifacts. A new capture creates a new bundle revision rather than overwriting old evidence.
