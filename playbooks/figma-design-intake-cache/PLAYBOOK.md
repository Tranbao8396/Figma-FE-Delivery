---
name: figma-design-intake-cache
description: Capture and reuse a compact Figma design snapshot with an MCP call budget, invalidation rules, and web-reference fallback. Use at Figma intake or when a cached design context is missing or stale; do not use to implement UI or bypass Figma limits.
---

# Figma Design Intake Cache

Create a small, task-local design snapshot and context pack that let later phases reuse confirmed design facts without repeatedly calling Figma MCP or loading unrelated history. This skill controls consumption; it does not circumvent Figma rate limits, cache credentials, or authorize access to a Figma file.

## Request Planner Is Mandatory

Before any Figma MCP call, create or update a request plan using [request-planner.md](references/request-planner.md). Classify the needed fact as exactly one of:

- `local_context`: already established by repository, manifest, evidence bundle, or context pack.
- `web_reference`: readable from the Figma web frame or approved screenshot.
- `snapshot_hit`: confirmed by a current task-local snapshot.
- `MCP_required`: hierarchy, variable, component variant, asset, motion, or Code Connect fact that no other source can provide.
- `blocked`: a material fact that cannot be obtained safely with the available sources/budget.

Only `MCP_required` may consume the task budget. The plan must name the target node/state, missing fact, expected artifact update, reason every cheaper source is insufficient, and authorizer. If the same request is already resolved in a current snapshot or pack, record `snapshot_hit` and do not call MCP.

## Start With a Budget

Read [mcp-budget.md](references/mcp-budget.md) before invoking Figma MCP. Record the budget in the task manifest or project context:

- The file and target nodes/states in scope.
- The maximum calls available for this task and a reserve for material mismatches.
- Calls used, call reason, and whether the result is reusable.
- The fallback when the reserve is exhausted.

Choose the smallest useful request. Do not fetch an entire file when the task has a specific frame/state link. Do not re-query a node whose facts are already confirmed in a valid snapshot.

## Intake Procedure

1. Read task scope, Figma web/share link and supplied screenshots. Reuse existing `source-context-hook` and `rules-context-hook` compiler outputs; invoke/reuse the `design-index-hook` compiler from the latest local artifact to identify exact target frames, viewport widths, variants, assets and states before planning Figma access.
2. Locate a task-local snapshot outside the customer repository. Its path belongs in the manifest/project context; never put a PAT, cookie, private URL parameters, or customer source into reusable framework context.
3. Build the request plan. Reuse a snapshot only when its file/node/viewport and design revision evidence still match the task. If it is incomplete, plan only the missing node/state/fact.
4. Use Figma MCP only for facts the web reference cannot reliably provide: hierarchy, variables/tokens, component variants, asset references, motion, or Code Connect.
5. Immediately write the compact result to the snapshot, MCP call ledger, and quality evidence bundle: node ID, viewport, confirmed facts, source/time, confidence, call reason, and unresolved ambiguity. Summarize rather than storing raw MCP output.
6. For `static_layout` scope, invoke the `figma-layout-context-hook` compiler CLI with the raw artifact, target screen scope, framework and coding-rule digest. Save the compact `layout-context.json` outside the customer repository and link it from the context pack. On a matching input fingerprint, use its cache hit rather than rebuilding/re-analyzing.
7. Compile/update the section-addressable context pack. It contains only handoff facts and links, never raw MCP output or a whole chat/tree dump. Read [context-pack.md](references/context-pack.md).
8. Invoke `project-context-index-hook` after adding or changing any project artifact. Its index input lives beside the project context and records relative paths, kinds and phase requirements; a missing/stale artifact blocks only dependent phases.
9. For implementation/review/QC, read the phase record from `project-context-index.json`, then use only its named context pack/snapshot/layout/evidence artifacts. Re-open Figma web or call MCP only after an invalidation trigger through this playbook.

Read [design-snapshot.md](references/design-snapshot.md) when creating or updating the artifact. Read [mcp-call-ledger.md](references/mcp-call-ledger.md) and [quality-evidence-bundle.md](references/quality-evidence-bundle.md) when a later phase needs visual evidence or asks to refresh it. Read [telemetry.md](references/telemetry.md) at task close or during a pilot.

## Invalidation Rules

Refresh a specific node, not the entire file, when any of these occurs:

- Customer supplies a newer Figma link, updated screenshot, changed node ID, or states the design changed.
- The web frame visibly differs from the snapshot.
- A required token, asset, variant, state, or breakpoint is absent or contradictory.
- A rendered comparison reveals a material mismatch that cannot be resolved from confirmed evidence.

Do not refresh for routine code edits, a new conversation turn, or curiosity. Record why the old snapshot became stale.

## Quality Evidence Gate

Review and QC consume the bundle, not live Figma. An implementation agent that finds a material visual mismatch may create an `evidence_refresh_request` containing target node/state, missing/contradictory fact, render evidence, severity, and reason existing artifacts cannot resolve it. It may not call MCP directly.

Only an assigned reviewer, QC owner, or human approver may authorize that request. Once authorized, this skill consumes the smallest applicable budget, refreshes the specific node, updates the ledger and bundle, and marks the old evidence superseded. A rejected request leaves the result `blocked` or `inconclusive`; it does not authorize retries.

## Quota-Exhausted Fallback

When the task budget or external quota is exhausted:

1. Stop automatic MCP retries and record `quota_exhausted` with the failed request reason.
2. Use Figma web, approved screenshots/exports, existing local tokens/components, and the snapshot as available evidence.
3. Mark any missing material fact as `blocked`; use a documented default only when it is low-impact and does not change visible copy, behavior, scope, or acceptance.
4. Ask the customer for a targeted screenshot/export or clarification only when the blocker prevents a correct implementation.

Never present cache data as current when it is stale, and never claim pixel-perfect verification without comparable visual evidence.

## Storage and Security

- Store snapshots in a task/project context directory outside the customer repository, for example `D:\agents\figma-frontend-agent\contexts\projects\<project-key>\figma\`.
- Save summaries, node identifiers, viewport facts, screenshots/exports when authorized, and provenance. Do not save PATs, session cookies, raw API credentials, or private customer data.
- Keep reusable framework context free of customer design details. Delete or archive task context according to the customer retention requirement.

## Completion Handoff

Report the selected source mode (`web_only`, `web_plus_mcp`, or `cache_fallback`), request-plan ID, context-pack path/revision, snapshot path, nodes covered, calls used/reserved, invalidation state, and unresolved blockers. Later skills should read the named context-pack sections instead of re-fetching Figma.
