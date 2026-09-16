---
name: figma-context-task-intake
description: Route Figma frontend work from a human-approved task context or a direct request. Use before analysis, implementation, review, or QC when the task may reference a context JSON.
---

# Context Task Intake

Classify every request as exactly one mode before selecting a delivery phase. Announce the mode in the first response.

## Context Mode

Use `context` mode only when the user supplies a path to `task-context.approved.json` and asks to use it.

1. Determine the requested execution phase from the user request, then run `node D:/agents/figma-frontend-agent/context-builder/bin/figma-context.js status --context <path> --phase <phase>`.
2. Require `valid: true`, `status: approved`, a valid checksum, current profile/project/index references, and the current context-index phase gate. `requestedPhase` is the initial approved phase, not a requirement to rebuild the baseline for every later phase.
3. Read the context index reference first. Load only the artifact IDs named for the requested phase.
4. Treat the approved task context as the source of scope, target frame, viewport contract, implementation contract, design references, acceptance criteria, assumptions, and permitted phase. Treat profile/project artifacts as referenced, read-only facts.
5. If validation fails, phase is blocked, or evidence is stale, stop the affected phase. Report the exact artifact or evidence refresh needed. Do not switch to direct mode, rebuild context, approve context, or call Figma MCP to work around the gate.

Context mode may write new implementation evidence, review findings, and QC reports only in the task context's `evidence/` or `reports/` area. It must not modify the approved baseline.

## Direct Mode

Use `direct` mode when no approved context is supplied. Announce it, then follow `figma-frontend-delivery` and the applicable phase playbook.

Direct mode may use local compilers and the Figma request planner. If the user explicitly requests draft preparation, load `playbooks/figma-context-preparation/PLAYBOOK.md`. It can produce a draft context for human review, but it cannot create an approved context or claim that a draft is authoritative.

## Phase Mapping

- `analysis`: use approved scope, source/rules artifacts, design references, and known gaps. Stop after planning when scope says analysis only.
- `foundation` and `implementation`: require their phase gate, one target frame present in the normalized design artifact, an explicit viewport contract, a local visual-comparison image, and a ready implementation contract. Never interpret a reference viewport as `max-width` unless the contract says so; never infer page/route/file ownership.
- `review` and `qc`: require their phase gate plus evidence links and the task reports; never fetch Figma directly.

## Terminology

- **Context Builder**: manual CLI that writes and validates context artifacts.
- **Compiler**: deterministic local program used by the builder or direct intake.
- **Skill/Playbook**: Agent decision policy.
- **Codex Lifecycle Hook**: optional lifecycle automation; it is not the Context Builder.
