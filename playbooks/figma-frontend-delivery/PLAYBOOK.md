---
name: figma-frontend-delivery
description: Route Figma-to-frontend work through disciplined analysis, foundation, local-source context, framework knowledge, and delivery gates. Use for end-to-end Figma frontend work; use `figma-frontend-analysis` for plans and `figma-frontend-foundation` before page implementation.
---

# Figma Frontend Delivery

Route Figma frontend work through the appropriate phase without losing the customer's codebase, rules, framework, or delivery expectations.

Before this playbook, use `figma-context-task-intake` to declare `context` or `direct` mode. In context mode, do not invoke a compiler or Figma access policy unless the approved context explicitly identifies an authorized evidence refresh request.

## Route First

- For design analysis, estimates, feasibility, task breakdown, implementation planning, or test planning without code changes, use `figma-frontend-analysis`.
- For Figma intake that needs MCP, cache reuse, quota handling, or design-context handoff, use `figma-design-intake-cache` before analysis or implementation. Require its request plan and context pack before direct Figma MCP access.
- At project intake, invoke the `source-context-hook` and `rules-context-hook` compiler CLIs before reading broad source trees or repeatedly parsing customer rules. Invoke `design-index-hook` against the cached design artifact before asking Figma for more evidence.
- For static-layout context compilation after intake, invoke the `figma-layout-context-hook` CLI with target screens, framework and coding-rule input; downstream phases use this compact JSON rather than raw design output.
- For source-tree setup, scaffolding, design tokens, shell/layout, or shared components before page/domain work, use `figma-frontend-foundation` after analysis.
- For page or component implementation, use `figma-frontend-implementation` after an approved task manifest and foundation manifest. Do not turn material design ambiguity into code assumptions silently.
- For independent code review, use `figma-frontend-review` after implementation. For evidence-based visual/function/browser QC, use `figma-frontend-qc` after review.
- Before Review, invoke the `evidence-linker-hook` CLI to link Figma references, source files and test IDs. For QC, capture the approved matrix first, then invoke it with QC phase so visual-evidence IDs are included. It reports missing coverage only; it cannot certify a pass.
- Maintain `project-context-index.json` with `project-context-index-hook`. It is the only project-wide context loaded first; every phase reads its `ready`/`blockedBy` record before loading child artifacts.

## Intake Order

Before estimating or editing code, establish the minimum reliable context in this order:

1. Classify the task as `analysis_only`, `implement_existing_repo`, or `scaffold_new_repo`; classify viewport scope as `desktop_only` or `responsive_required` from the request and design evidence.
2. Confirm the local repository root and inspect its working-tree status. Preserve unrelated user changes. Invoke the `source-context-hook` CLI to create/reuse a compact source digest, then read only exact repository instructions and files relevant to the task.
3. Invoke the `rules-context-hook` CLI over customer/project rules. Resolve any reported conflict in the task manifest rather than choosing silently.
4. Identify the framework/runtime from the source context plus exact project files such as `package.json`; do not infer framework from Figma alone.
5. Read the Figma web share link or supplied reference images. Invoke/reuse `design-index-hook` from the task-local raw artifact, then classify every missing design fact through the request planner. Use Figma MCP only for authorized `MCP_required` facts, then update/reuse the task-local context pack through `figma-design-intake-cache`.
6. Create `context-index-input.json` under `contexts/projects/<project-key>/` from the project-context-index template. Build/rebuild `project-context-index.json` after each source/rules/design/layout/evidence artifact change.
7. Read `phases.analysis`. If it is blocked, record the missing artifact as a blocker; otherwise load only its artifact IDs, then state material assumptions, scope boundaries, file/component plan and estimate.

## Standard-Web Baseline

Treat semantic `HTML`, responsive/layout `CSS`, DOM/event/module `JavaScript`, and maintainable `SCSS` as core capabilities. Prefer the project's established styling method over introducing a new one. When a project is framework-free, use this baseline directly.

## Framework Context

Reusable framework knowledge belongs under `D:\agents\figma-frontend-agent\contexts\frameworks\`, outside any customer repository. Use the schema in [framework-context.md](references/framework-context.md) when creating or refreshing a context.

- Select a context by framework and major version, for example `nextjs-15.md`, `react-19.md`, `vue-3.md`, or `vanilla-html-css-js-scss.md`.
- Verify the repository version and conventions before relying on a stored context. If they differ materially, treat the context as a discovery index, read the primary project sources, then update or create the correct context.
- Keep only reusable technical knowledge in this directory. Never store customer code, credentials, proprietary assets, customer-specific rules, or task decisions here.
- Keep customer/project-specific facts in the task conversation or a temporary project context outside the repository; never promote them into reusable framework context.
- Load only the sections needed for the current task to reduce token use.

## Delivery Gate

Before code changes, ensure `phases.implementation.ready` is true in `project-context-index.json` and the task manifest records resolved scope, target frames, viewport mode, applied rules, component/file plan, required states, acceptance criteria, material ambiguity and validation plan. Before page/domain changes, require a foundation manifest covering source-tree contract, build chain, shell/tokens/components and baseline evidence. Implementation records its Figma node/reference, code mapping and allowed deviation in a design-evidence ledger. In `desktop_only` mode, do not create mobile/tablet deliverables unless the user adds them.

## Implementation and Verification

- Follow the rule precedence: current user instruction, then customer/project rule, then existing repository pattern, then general practice. Surface real conflicts rather than silently choosing.
- Make small, scoped changes. Reuse existing components and tokens when they fit. Do not hard-code a token when the repository provides the corresponding design token.
- Build behavior for the viewport scope in the task manifest. For `responsive_required`, use sensible constraints where Figma does not specify intermediate widths; for `desktop_only`, prioritize the specified desktop viewport and browser matrix.
- Run the applicable build, lint, typecheck, and tests. When the application can run, inspect desktop, tablet, and mobile screenshots against Figma/reference images and correct meaningful visual deviations.
- Self-review the final diff for bugs, regressions, missing tests, rule violations, and technical debt.
- Do not consume Figma MCP in review or QC. Those phases use the quality evidence bundle and issue a budgeted `evidence_refresh_request` through `figma-design-intake-cache` only when needed.

## Figma Access Fallback

When Figma MCP or web access is incomplete, use screenshots, exported assets, existing design tokens, and explicit customer clarification. Mark inferred values and unconfirmed variants. Do not claim pixel-perfect verification without comparable design references, target viewports, fonts, and assets.

## Completion Report

Report the implementation scope, customer rules applied, framework/version verified, checks and viewports run, important visual comparison outcomes, remaining assumptions, unresolved design gaps, and any deliberate technical-debt tradeoff. Final `verified_pass` belongs only to the configured independent authority.
