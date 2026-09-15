# Source Context Compiler

Local Node.js compiler for the compact source-tree digest used at project intake. Invoke it from delivery/analysis; it is not a Codex Skill or event hook.

```text
npm run build-context -- --repo <customer-repo> --out <source-context.json>
```

It indexes metadata and signatures only. It does not read Figma, retain source content, or modify customer code.
