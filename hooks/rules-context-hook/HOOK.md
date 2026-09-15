# Rules Context Compiler

Local Node.js compiler for structured customer coding and delivery rules. Invoke it from intake; it is not a Codex Skill or event hook.

```text
npm run build-context -- --rules <rules.json> --out <rules-context.json>
```

It normalizes directives and surfaces conflicts. It does not invent rules or change customer source.
