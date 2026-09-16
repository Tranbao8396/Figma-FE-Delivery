# Foundation Manifest

Create this after the foundation phase. It hands an implementation-ready base to later skills without requiring them to reread the full Figma analysis or filesystem.

## Required Fields

```yaml
mode: scaffold_new_repo | implement_existing_repo
viewport_mode: desktop_only | responsive_required
stack:
  requested: framework/runtime from task
  verified: framework/runtime from local evidence
tree_contract:
  required: [paths]
  optional: [paths]
  generated: [paths]
  missing: [paths]
dependency_graph: [entry edges]
foundation_scope:
  delivered: [tokens, shell, components]
  deferred: [page/domain behavior]
evidence:
  commands: [command + pass/fail summary]
  viewport: width/height or target browser view
  screenshot: output path or unavailable reason
handoff:
  allowed_next_slice: page/component scope
  blockers: [items]
```

`figma-context init-foundation-manifest` is the only template generator. Do not copy an old manifest or create field names ad hoc. The canonical artifact at `reports/foundation-manifest.json` has this shape:

```json
{
  "schemaVersion": "1.0.0",
  "kind": "foundation_manifest",
  "status": "pending",
  "mode": "scaffold_new_repo",
  "viewport_mode": "desktop_only",
  "sourceFingerprint": null,
  "sourceState": null,
  "files": [
    { "path": "package.json", "purpose": "Project scripts and dependencies" },
    { "path": "src/main.jsx", "purpose": "Application entry" }
  ],
  "evidence": {
    "commands": [{ "command": "npm run build", "status": "pass", "summary": "Build completed" }],
    "viewport": "1400x887",
    "screenshot": "reports/foundation-baseline.png"
  },
  "handoff": { "allowed_next_slice": "Products page", "blockers": [] }
}
```

Command status is only `pass`, `fail`, or `not_run`. Sau khi điền evidence, dùng `figma-context finalize-foundation-manifest` để CLI ghi `status: ready`, `sourceFingerprint` và `sourceState` từ source hiện tại.

## Required Decisions

- Name the shared shell, base tokens, and primitives delivered.
- List each created/changed source file with one-line purpose.
- State which Figma content remains placeholder-only because business copy or behavior is unresolved.
- Separate build evidence from visual evidence.
- State exactly what page-level work may begin next; do not imply final application completion.
