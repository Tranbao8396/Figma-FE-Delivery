---
name: figma-frontend-implementation
description: Implement Figma frontend pages and components from approved manifests with design evidence, scoped assumptions, and responsive contracts. Use after foundation; do not use for initial analysis, code review, or final QC.
---

# Figma Frontend Implementation

Implement a page or component slice without losing the design evidence, customer rules, or established source conventions. This skill starts after analysis and foundation; it does not replace review or final quality control.

## Preconditions

Before editing, read only the relevant sections of the approved task manifest, foundation manifest, and Figma context pack. Confirm:

- The current page, state, target Figma frame/node, accepted viewport scope, acceptance criteria, and files/components expected to change.
- Each required visual state and its confirmed effect facts. A dropdown/modal/popover surface must use the `boxShadow`, `filter`, or `backdropFilter` emitted by the layout context when present.
- The approved `implementationContract`: delivery mode, route, entrypoint strategy, source-change policy, and file plan with primary/create/modify/forbid paths.
- The applicable customer rules, local repository instructions, framework/version, and nearby component patterns.
- Every high-impact ambiguity is resolved or explicitly marked as an approved boundary. Do not turn missing copy, data schema, business behavior, or visual state into an unrecorded guess.
- A foundation baseline exists. If the tree, build chain, shell, shared token, or required primitive is missing, return to `figma-frontend-foundation` instead of rebuilding it ad hoc in a page slice.

In context mode, require the approved task context to permit `implementation`. Its layout, viewport, rules, and assumption records are the input contract; a blocked or stale reference ends the phase rather than triggering direct intake. When an `amendment.approved.json` is supplied, validate its checksum, base hash, task ID and `implementation` permission; use only its in-memory delta for evidence nodes/states and permitted file additions, never edit the base context.

Treat `implementationContract` as a hard source-ownership boundary. Do not create a page, route, component file, or alternate app structure that is absent from its file plan. Do not replace, rename, or repurpose an existing entrypoint such as `index.html` unless `deliveryMode` is `replace_single_static_entry` and `entrypointStrategy` is explicitly `replace`.

For `add_page_to_static_site`, implement the page in `filePlan.primary` and preserve the existing entrypoint's content. An entrypoint listed under `filePlan.modify` may be changed only for the declared navigation/shared-shell purpose. If the contract is absent, invalid, conflicts with the current tree, or leaves file/route ownership unclear, stop and report `implementation_contract_missing` or the specific contract conflict; do not infer a replacement strategy.

Require exactly one confirmed target frame, an explicit viewport contract, and a local visual-comparison reference. Treat `referenceViewport` only as a measurement authority; use `layoutBehavior`, `minWidth`, and `maxWidth` exactly as declared. Do not infer `max-width` from a 1400px Figma frame.

For a static-UI scope, do not add APIs, persistence, domain calculation, chart libraries, or CRUD behavior unless the manifest expressly includes them.

## Evidence-First Slice

Before substantial page code, run `figma-context evidence init --context <task-context>` and create or update its compact ledger at `contexts/tasks/<project>/<task>/reports/evidence/design-evidence-ledger.json`. One row is enough for a small component; a screen can have rows for its shell, repeated component, and state. Never write the ledger, screenshots, or QC bundle into the customer source unless the customer explicitly requires delivery documentation there. When Figma MCP is needed, first use the task-local snapshot managed by `figma-design-intake-cache`; do not create a duplicate unbudgeted read.

Use evidence in this precedence order:

1. Latest user instruction and customer acceptance criteria.
2. Customer coding rules and project instructions.
3. Figma web frame/state or supplied visual reference at the target viewport.
4. Node-specific Figma MCP context, assets, variables, variants, and Code Connect when available.
5. Verified local tokens, components, and repository patterns.
6. A documented, low-impact default.

For an icon or illustration, use an exported Figma asset or an approved local icon-library mapping recorded in the asset manifest. Do not recreate the visual with CSS pseudo-elements, text glyphs, or an approximate icon when asset evidence is absent; create an evidence refresh request instead.

Do not add, remove, or tune a shadow, elevation, blur, overlay or clipping rule from taste. If a requested visual state declares `requiredEffects`, implement the corresponding confirmed layout-context value. If its node/effect evidence is absent, the state is blocked and requires an `evidence_refresh_request`.

When two sources conflict, do not silently choose. Record the conflict and request clarification when it changes visible copy, behavior, scope, or acceptance. Use the newest confirmed visual reference for appearance and the customer decision for product behavior/copy.

## Figma Access Policy

Treat Figma web or a supplied screenshot as the visual reference. Use Figma MCP only when it materially improves the current decision: node hierarchy, dimensions, variables, component variants, assets, motion, or Code Connect.

- Query the page/state node being implemented, not the whole file. Reuse node IDs and facts already stored in the ledger or manifest.
- When the target node changes, the design was updated, a needed state/asset is absent, or implementation has a material unexplained mismatch, create an `evidence_refresh_request` for `figma-design-intake-cache`. Do not re-query MCP directly.
- Use Figma app/API context only when web/MCP cannot expose required structure or the user explicitly asks to inspect or edit the Figma file.
- Do not use MCP as a substitute for rendered visual comparison. Never claim pixel-perfect from node metadata or CSS intent alone.

## Implement in Slices

1. Inspect the closest local component/page and reuse its token, semantics, state and test patterns when they fit.
2. Map the target frame to semantic structure and resilient layout constraints. Do not translate Figma coordinates directly into absolute positioning unless the design itself requires an anchored element.
3. Change the smallest coherent set of files. Reuse foundation primitives; add a component abstraction only when it is reused or prevents meaningful duplication.
4. Keep the requested state boundary: static content remains static; mock interaction is visibly local; production behavior requires its contract.
5. After each meaningful slice, run the smallest relevant declared check and inspect the target viewport if the app can run. Fix visual deviations within the slice before expanding scope.

Respect rule precedence: current user instruction, customer/project rule, existing repository pattern, then general practice. Preserve unrelated working-tree changes.

## Responsive Mode

For `desktop_only`, implement and verify only the manifest viewport. Do not add mobile/tablet breakpoints as speculative polish.

For `responsive_required`, read [responsive-contract.md](references/responsive-contract.md) before coding. Require a desktop and SP/mobile reference, or explicit permission to interpolate between specified viewports. Use layout constraints, Grid/Flex, max/min widths, and media/container queries rather than a fixed desktop canvas or viewport-scaled fonts. Record every nontrivial interpolation in the ledger.

## Slice Gate and Handoff

A slice is ready for review only when:

- Code follows the applicable naming, semantic, styling, framework, and dependency rules.
- The evidence ledger maps the screen/state to its source and any remaining deviation/assumption.
- The configured build, lint, typecheck, or narrow test applicable to the changed surface has passed, or a failure is reported with cause and scope.
- Screenshot evidence exists for each requested design viewport when the app can run. Use `figma-context evidence capture --context <task-context> --url <local-url> --screen <screen> --state <state> --viewport <width>x<height> [--amendment <approved-amendment>]`; it stores the PNG under the task report directory and updates the ledger/bundle with `captured_pending_comparison`, never a unilateral pass. Responsive work also includes breakpoint-boundary and long-content checks.
- The handoff says exactly what changed, what was checked, what is intentionally deferred, and what remains blocked.

Do not label a result `pixel-perfect` without matching viewport references, confirmed fonts/assets, rendered screenshots, and reviewed comparison evidence. Send code to `figma-frontend-review` next; final visual/UI/browser assertions belong to `figma-frontend-qc`.

## Token Discipline

- Load the manifest section, target context-pack rows, and local modules for this slice only.
- Keep design facts in the evidence ledger; do not fetch the same Figma frame or reread the whole conversation for every edit.
- Prefer compact command outcomes and screenshot notes over raw logs and repeated explanations.
- Open generated output, broad source trees, or unrelated Figma pages only to diagnose a concrete failure.
