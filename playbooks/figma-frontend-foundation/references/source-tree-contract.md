# Source-Tree Contract

Use this contract to compare customer input, the local tree, and the tree that the foundation phase is allowed to create. It is a compact decision artifact, not a raw filesystem dump.

## Path Status

| Status | Meaning | Default handling |
|---|---|---|
| `required` | Needed for the selected build/runtime or manifest entry chain | Create or repair only with implementation/scaffold authority |
| `optional` | Useful only when assets, features, or local convention require it | Do not create until needed |
| `generated` | Created by install/build/test tooling | Do not inspect by default; verify existence or failure only |
| `external` | Owned by package manager, service, or customer asset source | Record reference; do not modify |
| `missing` | Requested/needed but unavailable | Block or document a safe default before proceeding |

## Minimum Verification

For a new static frontend, verify equivalents of:

1. Package manifest and lockfile, where the selected package manager produces one.
2. Build configuration and declared scripts.
3. HTML/template entry point.
4. JavaScript or framework entry point.
5. Style entry point and its token/base imports.
6. Asset handling only when the design or build config requires it.

For an existing project, use its framework conventions instead of forcing this static shape.

## Dependency Graph

Record the actual chain in one short line, for example: `src/index.html -> HtmlWebpackPlugin -> dist/index.html`; `src/js/index.js -> src/scss/main.scss -> extracted CSS`; `src/assets -> build asset output`.

If an edge is missing, identify the owning config/file and whether it is a blocker. Do not infer that a directory is required merely because a customer tree listed it: a build configuration may intentionally tolerate an absent optional asset directory.

## Scan Boundary

Default exclusions: `node_modules`, `dist`, `.next`, `build`, `coverage`, tool caches, generated maps, and binary assets. Query an excluded path only when a named command, error, or asset reference requires it.
