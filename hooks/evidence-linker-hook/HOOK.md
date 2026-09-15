# Evidence Linker Compiler

Local Node.js compiler for mapping Figma references, source files, test IDs and visual evidence. Invoke it before review/QC; it is not a Codex Skill or event hook.

```text
npm run build-context -- --input <evidence.json> --out <evidence-links.json>
```

It reports coverage and missing evidence only. It cannot execute tests or certify a pass.
