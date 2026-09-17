---
name: figma-context-task-intake
description: Route Figma frontend work from a human-approved task context or a direct request. Use before analysis, implementation, review, or QC when the task may reference a context JSON.
---

# Context Task Intake

Classify every request as exactly one mode before selecting a delivery phase. Announce the mode in the first response.

## Context Mode

Use `context` mode only when the user supplies a path to `task-context.approved.json` and asks to use it.

1. Determine the requested execution phase. For `analysis`, `foundation` and `implementation`, run `figma-context context status --context <path> --phase <phase>` with strict source freshness. For Review/QC after code has changed, use `figma-context context status --context <path> --phase <phase> --allow-source-drift`; this is limited to the post-implementation evidence flow.
2. Require `valid: true`, `status: approved`, a valid checksum, current profile/project/index references, current design artifacts, and the applicable context-index phase gate. `--allow-source-drift` only suppresses `source_context_stale`; it never bypasses the other checks. `requestedPhase` is the initial approved phase, not a requirement to rebuild the baseline for every later phase.
3. When the user also supplies `amendment.approved.json`, run `figma-context amend status --amendment <path> --phase <phase>`. Require a valid checksum, matching base-context hash/task ID and allowed phase. Use its bounded overlay only; draft amendments are not instructions.
4. Read the context index reference first. Load only the project artifact IDs named for the requested phase. For `review`, require the approved task's `reportRefs` and review evidence gate. For QC preparation, require reportRefs plus review-phase evidence links; QC evidence gate applies only after capture and `link-evidence --phase qc`.
5. Treat the approved task context plus an optional approved Amendment as the source of scope, target frame, viewport contract, implementation contract, design references, acceptance criteria, assumptions, and permitted phase. Treat profile/project artifacts as referenced, read-only facts.
6. If validation fails, phase is blocked, or evidence is stale, stop the affected phase. Report the exact artifact or evidence refresh needed. Do not switch to direct mode, rebuild context, approve context, or call Figma MCP to work around the gate.

Context mode may write new implementation evidence, review findings, and QC reports only under the task context's `reports/evidence/` or `reports/` area. It must not modify the approved baseline.

## Direct Mode

Use `direct` mode when no approved context is supplied. Announce it, then follow `figma-frontend-delivery` and the applicable phase playbook.

Direct mode may use local compilers and the Figma request planner. If the user explicitly requests draft preparation, load `playbooks/figma-context-preparation/PLAYBOOK.md`. It can produce a draft context for human review, but it cannot create an approved context or claim that a draft is authoritative.

## Phase Mapping

- `analysis`: use approved scope, source/rules artifacts, design references, and known gaps. Stop after planning when scope says analysis only.
- `foundation`: require its phase gate, one target frame present in the normalized design artifact, an explicit viewport contract, and a local visual-comparison image. For `empty_directory`, `workspace_only`, or `partial_scaffold`, require a ready `scaffoldContract`; honor its `owner` and do not create source when ownership is `user` or `external`.
- `implementation`: require `sourceState=existing_project`, a Foundation manifest with the current source fingerprint when the task has scaffold lineage, and a ready implementation contract. Never interpret a reference viewport as `max-width` unless the contract says so; never infer page/route/file ownership.
- `review`: require current `designEvidenceLedger`, `qualityEvidenceBundle`, and review-phase `evidenceLinks` in `reportRefs`; every link must cover Figma node, source mapping and declared test case.
- `qc`: preparation requires review-phase `evidenceLinks` and an approved QC plan; run capture first, then generate QC-phase `evidenceLinks` and run status before declaring QC-ready. At assessment time require QC-phase links and one rendered screenshot per required target. Never fetch Figma directly.

## Terminology

- **Context Builder**: manual CLI that writes and validates context artifacts.
- **Compiler**: deterministic local program used by the builder or direct intake.
- **Skill/Playbook**: Agent decision policy.
- **Codex Lifecycle Hook**: optional lifecycle automation; it is not the Context Builder.
