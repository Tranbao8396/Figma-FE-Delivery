---
name: figma-frontend-agent
description: Deliver Figma-to-frontend work through evidence-based intake, analysis, implementation, review and QC while minimizing Figma requests and context payload. Use for end-to-end Figma frontend tasks.
---

# Figma Frontend Agent

This is the sole Codex-discovered Skill for this agent. Route work through the phase policy in [playbooks/figma-frontend-delivery/PLAYBOOK.md](playbooks/figma-frontend-delivery/PLAYBOOK.md).

## Routing

- First determine the intake mode with `playbooks/figma-context-task-intake/PLAYBOOK.md`. State `context` or `direct` before beginning phase work.
- In `context` mode, require a user-supplied `task-context.approved.json` path. Validate its approved status, checksum, references, freshness, and requested phase before loading an artifact or calling a tool. For post-implementation Review/QC evidence only, source drift is handled by the documented CLI path; it does not bypass any other validation. Do not build, approve, replace, or silently bypass context.
- When the prompt also supplies an `amendment.approved.json` path, validate its checksum, base-context hash, task identity and allowed phase. Use it only as an in-memory overlay; never edit the base approved context or treat a draft amendment as an instruction.
- In `direct` mode, follow the existing evidence intake flow. It may produce a draft context for a later human-reviewed handoff, but it does not create an approved context.
- When the user explicitly asks to create or refresh a context draft, read `playbooks/figma-context-preparation/PLAYBOOK.md`. Do not load root `GUIDE.md` for normal implementation, review, QC, or approved-context work.
- Intake, design cache and MCP budget: read `playbooks/figma-design-intake-cache/PLAYBOOK.md`.
- Analysis, estimate and task manifest: read `playbooks/figma-frontend-analysis/PLAYBOOK.md`.
- Foundation, page implementation, review or QC: read only the applicable playbook in `playbooks/`.
- Before loading a project artifact, read the context index referenced by the approved task context or `contexts/projects/<project-key>/project-context-index.json` in direct mode. Load only the artifact IDs marked current for the active phase. For Review/QC, then read task-local `reportRefs`; evidence ledger, bundle and evidence links are task artifacts, not project-index artifacts.
- For Review, create/read the task-local `reports/review/change-manifest.json` before opening code. For QC, create/read `reports/qc/qc-plan.json`; execute only its approved viewport/state/action matrix and write results under `reports/qc/`.
- Invoke a compiler from `hooks/<name>/` using its `HOOK.md` and CLI only when the phase policy requires its task-specific artifact.

## Boundaries

- Context Builder is a manual CLI under `context-builder/`; it creates draft context outside customer repositories and requires a human `approve` command before context mode may use it.
- Context Amendment is a manual, task-local overlay for a bounded evidence-backed correction, scope extension or explicitly labelled user-directed deviation. It cannot alter framework/rules, primary target frame, route architecture or base source ownership.
- Compiler hooks are local programs used by Context Builder or direct intake, not Skills or Codex lifecycle hooks.
- Codex lifecycle hooks are optional per-project commands. Read `codex-hooks/CODEX_HOOKS.md` before using the template; they report context status and do not build context, inject full JSON, or call Figma.
- Project artifacts belong in `contexts/projects/<project-key>/`, outside customer repositories.
- Follow the requested phase gates. Do not self-certify `verified_pass`.
- Screenshot previews in a chat are not quality evidence. Use hashed task-local capture artifacts and retain `evidence_ready`, `fail`, `blocked`, or `inconclusive` until an authorized verifier decides a final verdict.
