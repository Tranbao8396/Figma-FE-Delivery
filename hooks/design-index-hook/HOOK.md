# Design Index Compiler

Local Node.js compiler for the screen/frame/state/viewport index from a cached raw design artifact. Invoke it before design request planning; it is not a Codex Skill or event hook.

```text
npm run build-context -- --raw <raw.json> --out <design-index.json>
```

It does not call Figma MCP or retain raw layer trees.
