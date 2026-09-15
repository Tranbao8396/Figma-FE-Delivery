---
name: figma-frontend-agent
description: Deliver Figma-to-frontend work through evidence-based intake, analysis, implementation, review and QC while minimizing Figma requests and context payload. Use for end-to-end Figma frontend tasks.
---

# Figma Frontend Agent

This is the sole Codex-discovered Skill for this agent. Route work through the phase policy in [playbooks/figma-frontend-delivery/PLAYBOOK.md](playbooks/figma-frontend-delivery/PLAYBOOK.md).

## Routing

- First determine the intake mode with `playbooks/figma-context-task-intake/PLAYBOOK.md`. State `context` or `direct` before beginning phase work.
- In `context` mode, require a user-supplied `task-context.approved.json` path. Validate its approved status, checksum, references, freshness, and requested phase before loading an artifact or calling a tool. Do not build, approve, replace, or silently bypass context.
- In `direct` mode, follow the existing evidence intake flow. It may produce a draft context for a later human-reviewed handoff, but it does not create an approved context.
- When direct-mode work includes creating an intake draft, read `context-builder/INTAKE_GUIDE.vi.md` first. Treat it as the intake contract: record confirmed facts, preserve unknowns, and do not infer a target frame, viewport behavior, dimensions, or icon source.
- Intake, design cache and MCP budget: read `playbooks/figma-design-intake-cache/PLAYBOOK.md`.
- Analysis, estimate and task manifest: read `playbooks/figma-frontend-analysis/PLAYBOOK.md`.
- Foundation, page implementation, review or QC: read only the applicable playbook in `playbooks/`.
- Before loading a project artifact, read the context index referenced by the approved task context or `contexts/projects/<project-key>/project-context-index.json` in direct mode. Load only the artifact IDs marked current for the active phase.
- Invoke a compiler from `hooks/<name>/` using its `HOOK.md` and CLI only when the phase policy requires its task-specific artifact.

## Boundaries

- Context Builder is a manual CLI under `context-builder/`; it creates draft context outside customer repositories and requires a human `approve` command before context mode may use it.
- Compiler hooks are local programs used by Context Builder or direct intake, not Skills or Codex lifecycle hooks.
- Codex lifecycle hooks are optional per-project commands. Read `codex-hooks/CODEX_HOOKS.md` before using the template; they report context status and do not build context, inject full JSON, or call Figma.
- Project artifacts belong in `contexts/projects/<project-key>/`, outside customer repositories.
- Follow the requested phase gates. Do not self-certify `verified_pass`.
