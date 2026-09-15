---
name: figma-frontend-review
description: Review Figma frontend changes against customer rules, manifests, local conventions, and collected evidence. Use after implementation; do not implement fixes, run final QC, or call Figma MCP directly.
---

# Figma Frontend Review

Perform an independent code-review pass after an implementation slice. The output is a findings report and evidence-refresh requests, not a delivery verdict.

## Inputs and Independence

Read the task and foundation manifests, only the changed context-pack rows, customer rules, relevant diff, changed dependency graph, design-evidence ledger, and quality evidence bundle. Review the code as it exists; do not trust implementation self-reporting.

In context mode, first require the approved task context to permit `review`; read only its referenced artifacts and append findings under the task context reports area. Do not alter the approved context baseline.

Do not call Figma MCP. If evidence is missing, stale, or contradictory, create an `evidence_refresh_request` for `figma-design-intake-cache` with the target node/state and observed mismatch. The cache owner decides whether to consume a budgeted call.

## Review Basis

Apply this precedence: current customer instruction and acceptance -> customer/project rules -> approved manifest and responsive contract -> quality evidence bundle -> verified local conventions -> general practice.

Review for scope creep, semantic HTML, naming/styling/framework rules, component/token reuse, state boundaries, validation/error/empty behavior, accessibility and keyboard operation, responsive matrix obligations, dependency/performance debt, regression risk, and testability. A design claim without comparable evidence is a finding or a limitation, never approval.

## Findings Format

Use a compact, append-only review report in task context:

| ID | Severity | File/area | Finding | Evidence/reproduction | Required action | Status |
|---|---|---|---|---|---|---|

Severity is `critical`, `high`, `medium`, `low`, or `info`. A finding must identify a concrete impact and evidence. Do not invent issues merely to fill the report.

## Handoff

The review ends as `findings_open`, `evidence_refresh_requested`, or `review_ready_for_qc`. It never ends as `PASS`. `review_ready_for_qc` means no unresolved critical/high review finding and sufficient evidence has been handed to QC; it does not certify visual or functional delivery.
