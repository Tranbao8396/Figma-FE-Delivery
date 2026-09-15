# Figma Frontend Agent

This root contains one maintainable Figma-to-frontend agent. Customer repositories are never stored here.

## Layout

| Directory | Contents | Retention |
|---|---|---|
| `SKILL.md` | The sole Codex-discovered orchestration Skill | Reusable, no customer data |
| `GUIDE.md` | Human-facing end-to-end operational runbook; read by Agent only for explicit context preparation | Reusable, no customer data |
| `playbooks/` | Phase policies loaded by the orchestration Skill | Reusable, no customer data |
| `context-builder/` | Manual `figma-context` CLI, contract tests, and intake template | Reusable, no customer data |
| `design-collector/` | Manual Figma REST/JSON evidence collector | Reusable, no customer data |
| `collectors/` | Local source/rules adapters | Reusable, no customer data |
| `normalizers/` | Deterministic design filtering and target scoping | Reusable, no customer data |
| `hooks/` | Deterministic local context compilers and tests; not registered as Skills | Reusable, no customer data |
| `codex-hooks/` | Project-scoped Codex lifecycle-hook template and read-only dispatcher | Reusable, no customer data |
| `contexts/frameworks/` | Versioned reusable framework notes, when created | Reusable, no customer data |
| `contexts/profiles/` | Reusable customer framework/rules/format profiles | Customer retention policy |
| `contexts/projects/` | Per-project source and design context | Customer retention policy |
| `contexts/tasks/` | Draft/approved task context, evidence and reports | Customer retention policy |

## Ownership

- The root Skill declares `context` or `direct` mode before phase work. Context mode accepts only a user-supplied approved task context; direct mode preserves the normal intake flow.
- `GUIDE.md` is not a phase artifact or automatic prompt injection. Only explicit draft creation/refresh loads `figma-context-preparation`; approved-context work reads phase-scoped artifacts instead.
- `project-context-index.json` is the mandatory project entrypoint after context-mode validation. The active phase reads its own record before loading a child artifact.
- Context Builder is manually invoked with `node context-builder/bin/figma-context.js`. It creates drafts, validates artifacts and performs the human-approved transition to immutable approved context.
- Compilers in `hooks/` produce compact local artifacts; none are Codex Skills, declare delivery pass, or automatically call Figma MCP.
- Codex lifecycle hooks are optional project `.codex/hooks.json` commands. They may report status, but do not build context automatically.
- Context artifacts live in `contexts/profiles/`, `contexts/projects/`, and `contexts/tasks/`; do not place them in `playbooks/`, `hooks/` or a customer source repository.
- Codex discovers the root Skill through `C:\Users\User\.agents\skills\figma-frontend-agent`.

## Change Policy

1. Update the smallest owning playbook or compiler.
2. Bump a hook schema/version whenever output behavior changes so stale cache cannot be reused.
3. Run Context Builder and affected compiler tests before changing delivery policy.
4. Keep absolute paths and project context references under this root.

## Compatibility Aliases

`D:\agents\<skill-or-hook-name>` remains a symbolic-link compatibility path for existing registrations. The canonical location is always this root. Do not edit through an alias; update the canonical path and retain aliases until they can be removed by an approved link-removal operation.
