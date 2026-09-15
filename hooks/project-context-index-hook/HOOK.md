# Project Context Index Compiler

Build a compact project-level index of existing context artifacts. Invoke it after intake and whenever a context artifact changes.

```text
npm run build-context -- --input <context-index-input.json> --out <project-context-index.json>
```

The input lists artifact paths relative to its project context directory and the phases that require them. The compiler reads only artifact metadata, verifies kind/fingerprint/status, and produces phase-scoped retrieval records. It does not copy raw context into the index, call Figma MCP, modify customer source, execute tests, or issue a delivery verdict.

Start each project from [context-index-input.template.json](templates/context-index-input.template.json). Store both input and output under `contexts/projects/<project-key>/`; rebuild after an artifact changes. Before any phase, read `phases.<phase>` from the index and load only its current artifact IDs.
