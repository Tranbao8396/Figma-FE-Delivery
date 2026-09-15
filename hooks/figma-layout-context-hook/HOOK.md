# Layout Context Compiler

Local Node.js compiler for compact, evidence-aware static-layout JSON. Invoke its CLI from a phase Skill; it is not a Codex Skill and is not a lifecycle event hook.

```text
npm run build-context -- --raw <raw.json> --intake <intake.json> --out <layout-context.json>
```

It does not call Figma MCP, edit customer source, or certify quality. See `package.json`, `src/`, `schemas/` and `test/` for the executable contract.
