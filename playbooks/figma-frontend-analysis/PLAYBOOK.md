---
name: figma-frontend-analysis
description: Analyze Figma frontend work before implementation: inspect design, customer rules, framework and local source; surface ambiguity; create an implementation-ready task manifest, estimate, and test plan. Use for Figma analysis, feasibility, estimates, breakdowns, and planning; do not use to write production code.
---

# Figma Frontend Analysis

Create a decision-ready plan for a Figma frontend task. The goal is to prevent code from being written against an unverified design, unclear business behavior, or incompatible project convention.

## Context-Mode Gate

When `figma-context-task-intake` selected `context` mode, do not perform ordinary intake or build context. Read the approved task context and its phase-indexed artifacts only. Use its scope, rules reference, evidence, and assumptions as the analysis input. If `phases.analysis.ready` is false, report the blocker and stop.

## Start With Classification

Classify these facts before deep reading:

- Delivery mode: `analysis_only`, `implement_existing_repo`, or `scaffold_new_repo`.
- Viewport mode: `desktop_only` or `responsive_required`. Do not infer mobile scope when the task/design is explicitly desktop-only.
- Design evidence: Figma web link, node-specific link, screenshot/export, or description only.
- Source status: local repository available, supplied target tree only, or no source.
- Framework: requested stack and version, then verified stack and version from local sources when available.

If a missing fact changes the estimate or deliverable, record it as an assumption or blocker. Do not ask about low-impact details that can be assigned a documented default.

## Evidence Intake

1. Read the newest user instruction, customer coding rules, acceptance criteria, and repository instruction files first.
2. When a repository exists, inspect only the root configuration, working-tree status, target route/page, and closely similar components before expanding the search.
3. Read Figma primarily through the web/share link and reference images. Identify exact file/page/frame/node, target viewport, visible variants, typography, spacing, asset requirements, and component relationships. When MCP is needed, use `figma-design-intake-cache` to create a request plan and context pack, then create/reuse a task-local snapshot instead of repeatedly fetching context.
4. For an approved static-layout task, invoke the `figma-layout-context-hook` compiler CLI after intake to compile target screens, framework and coding-rule digest into compact JSON. Treat `inferred` or `missing` fields as assumptions/blockers, not confirmed design facts.
5. Build a rule-compliance snapshot: naming, architecture, styling, state/data, test, accessibility, allowed dependencies, and delivery format.
6. Build a design inventory. Separate what is visible, what is inferred, and what is missing. For every requested dropdown, modal, tooltip, popover or overlay, record its open state, trigger, target node/reference, surface effect (shadow/blur), clipping and positioning evidence.

Read [task-manifest.md](references/task-manifest.md) when drafting the analysis artifact.

## Ambiguity and Scope Control

Create an ambiguity register for inconsistent labels, placeholder content, unspecified behavior, missing states, missing assets, unconfirmed breakpoints, unclear data rules, and unconfirmed surface effects. A visible dropdown with no open-state/effect evidence is a visual-state blocker when its shadow, blur, elevation or overlay is in scope.

- Mark an item `blocker` when it changes business behavior, data shape, user-visible copy, page scope, or visual acceptance criteria.
- Mark an item `defaultable` only when a documented standard choice will not materially change scope. State the default and its rationale.
- For wireframes, distinguish `static layout`, `mock interaction`, and `production behavior`. Estimate them separately; never quietly include production behavior in a static UI estimate.

## Design-to-Code Analysis

Map the design into:

- App shell, pages, sections, shared components, and route/state boundaries.
- Layout constraints, typography, spacing, color/token candidates, asset sources, and content overflow risks.
- Interaction/state matrix: loading, empty, error, long content, missing image, hover, focus, disabled, active, menu/modal, validation, and authentication states only when relevant to the scope.
- Existing code/component mapping when a repository exists; otherwise a proposed scaffold/file map that respects the supplied stack and rules.

Do not prescribe absolute positioning merely because Figma exposes coordinates. Identify the underlying grid, flex, container, table, or form behavior.

## Estimate Guard

Estimate only after the delivery mode, viewport mode, framework, design evidence, rules, and material ambiguity are recorded. Include setup, shared components, page/state work, tests, review, and visual checks exactly once.

Use narrow effort ranges and a confidence rating. Where unknown work cannot be bounded, add a time-boxed investigation instead of broadening every estimate. State whether the estimate covers static UI, mock interaction, or production behavior.

## Required Output

Produce a concise analysis plus a task manifest containing:

- Scope and delivery/viewport modes.
- Evidence and confidence: Figma nodes/frames, source status, framework verification, applied rule snapshot.
- Design inventory and component/file map.
- Ambiguity register with blocker/defaultable decision.
- Implementation slices and acceptance criteria.
- UI, user-experience, accessibility, browser, and end-to-end test plan that matches the scope.
- Estimate, dependencies, risks, and the explicit condition that permits implementation to begin.

For `analysis_only`, stop after this output. Do not create project code or claim verification that requires a running application.

## Token Discipline

- Keep the task manifest as the handoff source for later phases; do not require them to reread the whole conversation.
- Read the smallest Figma and repository surface that can answer the current decision.
- Reuse versioned framework context as an index, then verify against the local project before relying on it.
- Store only stable, reusable framework knowledge outside the project; customer/project decisions belong in the manifest or project context.
- Record Figma source mode, request-plan/context-pack paths, snapshot path, nodes covered, calls used/reserved, and quota fallback in the manifest when Figma MCP is used.
