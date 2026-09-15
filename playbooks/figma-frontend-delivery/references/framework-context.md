# Framework Context Schema

Use one concise file per framework and major version in `D:\agents\figma-frontend-agent\contexts\frameworks\`. The file is reusable technical context, not a project record.

## Required Metadata

```yaml
identity: nextjs
major_version: 15
last_verified: YYYY-MM-DD
sources:
  - official documentation URL or local project evidence
compatibility_notes: brief version constraints
```

## Reusable Sections

1. `Project discovery`: files that establish version, runtime, package manager, scripts, routing, and configuration.
2. `File conventions`: typical entry points, component boundaries, import conventions, and safe places to look for existing patterns.
3. `Rendering and routing`: server/client boundaries, routing conventions, data flow, and version-sensitive constraints.
4. `Component and state patterns`: supported component composition, state, forms, and data-fetching patterns; distinguish framework defaults from optional ecosystem choices.
5. `Styling and assets`: standard styling options, CSS/SCSS handling, tokens, image/font handling, and responsive considerations.
6. `Quality commands`: commonly relevant build, lint, typecheck, unit, integration, and end-to-end commands. Mark commands as examples unless confirmed in the target repository.
7. `Common pitfalls`: concise, version-specific risks that affect frontend delivery.
8. `Refresh triggers`: signals that require reading primary sources and updating the context, such as major/minor upgrade, conflicting config, different router, or nonstandard build tooling.

## Boundaries

- Do not copy customer repository code, internal URLs, credentials, Figma assets, customer rules, or ticket decisions into this file.
- Do not make a context a substitute for inspecting the current repository.
- Prefer links and concise decision guidance over copied framework manuals.
- Record uncertainty and the source date. Remove or revise claims that cannot be re-verified.
