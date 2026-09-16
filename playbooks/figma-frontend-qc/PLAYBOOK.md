---
name: figma-frontend-qc
description: Execute evidence-based UI, visual, responsive, browser, accessibility, and edge-case quality checks for Figma frontend work. Use after review; do not implement fixes, call Figma MCP directly, or self-certify final pass.
---

# Figma Frontend QC

Execute the approved test scope and produce immutable evidence. QC can show that criteria have evidence; it cannot grant final delivery approval by itself.

## Preconditions

Require a review handoff, applicable test plan, quality profile, quality evidence bundle, target context-pack rows, runnable build, and the target viewport/state matrix. If a required item is absent, mark affected cases `blocked` or `not_run`; do not replace it with a guess.

In context mode, first require the approved task context to permit `qc`; use its referenced evidence and write test artifacts only under the task context reports area. Do not alter the approved context baseline.

Read [quality-profile.md](references/quality-profile.md) before execution and [test-report-contract.md](references/test-report-contract.md) before writing results.

## Evidence-First Execution

1. Capture application screenshots at every declared visual viewport/state using the recorded browser, DPR, zoom, fonts/assets, route and data seed. For menus, popovers, modals and tooltips, capture the open state separately and record shadow/elevation, blur, overlay, clipping and placement checks.
2. Compare against the bundle reference using side-by-side/overlay first. Use pixel diff only when environments are comparable and tolerance/masks were approved.
3. Run the functional, keyboard/accessibility, browser and edge/monkey matrix applicable to the implemented feature. Record actual results, not intended behavior.
4. For responsive scope, test each supplied Desktop/Tablet/SP frame plus the declared breakpoint-boundary and long-content cases. For desktop-only scope, mobile/tablet is `not_in_scope`.
5. If a material Figma fact is absent or stale, create an `evidence_refresh_request`; do not call MCP. If refresh is denied or quota is exhausted, leave the case `blocked`/`inconclusive`.

## Status and Verdict Policy

Allowed executor statuses: `not_run`, `not_applicable`, `not_in_scope`, `blocked`, `fail`, `inconclusive`, and `evidence_ready`. A green automation result is evidence, not a final verdict.

Only a human approver, independent reviewer, or customer-approved CI policy may record `verified_pass`, with verifier and timestamp. QC must never write `PASS`, `pixel-perfect`, or equivalent unilateral certification.

## External Format

Keep canonical test case, test run, evidence index and deviation records in task context. Export an approved adapter for Excel, CSV, Jira, TestRail, or a customer template without dropping evidence, status or verifier fields. When an external template cannot hold mandatory fields, attach the canonical evidence index and state the limitation.

## Handoff

Report coverage, executed/not-run counts, failures, blocked cases, evidence paths, browser/viewport matrix, refresh requests, and the current verdict authority. Do not edit implementation code during QC.
