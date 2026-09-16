---
name: figma-frontend-foundation
description: Build or validate the source tree, build pipeline, design tokens, base layout, and reusable frontend components before page-specific implementation. Use after Figma analysis when scaffolding a new frontend or establishing a safe foundation in an existing repository; do not use for page business logic, code review, or final quality control.
---

# Figma Frontend Foundation

Establish a verified frontend foundation so later page work has stable files, entry points, layout primitives, and component boundaries. Work from an approved task manifest and the actual repository; do not treat a customer-provided tree as proof that files already exist.

## Preconditions

Require these facts before creating or changing files:

- A task manifest or compact equivalent with delivery mode, viewport scope, framework/stack, relevant customer rules, component/file plan, and material ambiguity decisions.
- For context mode, an approved `implementationContract` when foundation creates a page, route, entrypoint, or reusable source structure.
- A local repository path for `implement_existing_repo`, or explicit authorization to create a scaffold for `scaffold_new_repo`.
- A known package manager and build/runtime path, from the customer or project evidence.

In context mode, the approved task context must permit `foundation`; use its referenced source/rules/layout artifacts and do not replace its approved scope.

If a required business decision is blocked, foundation work may build generic shell/tokens only when the manifest explicitly allows it. Do not invent domain fields, routes, API contracts, or production behavior.

## Source-Tree Contract

Read [source-tree-contract.md](references/source-tree-contract.md) before deciding whether to create or modify the tree.

1. Inspect the smallest useful surface: root config, package/lockfile, build config, entry HTML, source entries, and the exact directories in the task manifest.
2. Classify each requested path as `required`, `optional`, `generated`, `external`, or `missing`.
3. Check the dependency graph rather than only filenames: HTML/template -> JavaScript entry -> style entry -> assets -> build output.
4. Exclude `node_modules`, build output, caches, coverage, and binary assets from ordinary tree scans. Inspect them only to diagnose a specific failure.
5. In an existing repository, preserve its directory conventions and do not recreate a parallel app structure. In a new scaffold, create only paths required by the selected stack and manifest.

Treat entrypoint replacement, page creation and route ownership as material decisions. If the contract does not explicitly authorize the requested source surface, foundation may report the missing contract but must not choose `index.html`, a new page file, or a routing approach on its own.

## Foundation Scope

Build in this order, stopping after the approved foundation boundary:

1. Package/build setup, entry points, scripts, ignore rules, and asset handling appropriate to the stack.
2. Design tokens and base styles: color, typography, spacing, radius, confirmed elevation/shadow, layout dimensions, focus treatment, and reset/base rules. Create a reusable shadow token only when the same confirmed effect is repeated; keep one-off effects local to their component.
3. Semantic application shell: `header`, navigation, `main`, one active-page `h1`, and viewport constraints from the manifest.
4. Reusable primitives/components required across pages: buttons, fields, selects, panels, cards, tables, toolbar, pager, menu, and placeholders only when indicated by the design.
5. Minimal rendering or routing shell needed to prove page switching/layout, without implementing page-specific CRUD, calculations, export, or data persistence.

For `desktop_only`, build and verify only the specified desktop viewport and browser scope. Do not add mobile/tablet behavior merely because it is generally useful.

## Foundation Gate

Read [foundation-manifest.md](references/foundation-manifest.md) before handoff. The foundation is ready only when:

- Required tree paths and entry/dependency graph are present and traceable.
- The configured build or development compile passes. Run only commands declared by the project or introduced as part of the authorized scaffold.
- The shell is semantic, has one active-page `h1`, and does not create obvious overflow at the viewport in scope.
- Shared components render without console errors and follow the customer naming/styling rules.
- A baseline screenshot or equivalent visual evidence exists for the shell and reusable components.
- The foundation manifest records files changed, commands run, remaining ambiguity, and the permitted boundary for page implementation.

Do not claim page completeness, pixel-perfect matching, cross-browser completion, or final accessibility verification at this stage.

## Cost and Token Discipline

- Use the source-tree contract and foundation manifest as the handoff; later skills should not rediscover the scaffold.
- Prefer a path allowlist and compact summary over broad filesystem dumps.
- Read config and entry files before component/page files; open only modules connected to the current slice.
- Keep generated build artifacts out of context unless a build failure points to them.
- Reuse existing tokens/components in an existing project; create no abstraction unless it supports more than one planned page or removes real duplication.

## Completion Report

Report the selected mode, stack verification, tree contract summary, files created/changed, build evidence, baseline viewport checked, component foundation delivered, and blockers handed to implementation.
