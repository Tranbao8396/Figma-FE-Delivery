# Context Builder Workflow

Context Builder is a manual preparation tool. It writes only under `D:\agents\figma-frontend-agent\contexts\` unless `FIGMA_CONTEXT_ROOT` is set for isolated tests.

## Commands

```powershell
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js init --out D:\intake.json
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js build --intake D:\intake.json
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js validate --context <task-context.draft.json>
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js approve --context <task-context.draft.json>
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js status --context <task-context.approved.json>
```

`build` reads local source/rules and locally supplied design artifacts only. It never calls Figma web, Figma MCP, or a Figma API. A missing raw design artifact leaves dependent phases blocked instead of attempting an external refresh.

Use `design-collector/bin/figma-design.js import` to convert saved Figma MCP/export JSON into a raw design artifact, or its explicit `collect` command for a node-targeted Figma REST request. Put the resulting output path in `design.rawArtifactPath` before calling `build`.

## Approval Contract

Review the draft before approval. `approve` rejects malformed, blocked, stale, sensitive, or missing-reference context. It creates `task-context.approved.json` plus a SHA-256 sidecar, then makes both files read-only. Do not edit or rename an approved context.

Provide the approved file path explicitly in an Agent task. The Agent validates the checksum and phase gate before using it; it does not discover, build, or approve context on its own.

## Definition Of Done

- [x] Context is outside customer source trees.
- [x] Profile, project, and task context use references and hashes instead of payload duplication.
- [x] The builder supports init, build, validate, approve, and status.
- [x] Approved task context has a checksum and approval metadata.
- [x] Build and status detect stale source/design artifacts.
- [x] Context mode is blocked unless the requested phase is ready.
- [x] Direct mode remains available for ad-hoc intake.
- [x] Lifecycle Hook remains status-only.
