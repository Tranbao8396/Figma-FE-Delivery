---
name: figma-context-preparation
description: Prepare a human-reviewable draft Figma task context from supplied source, rules and design evidence. Use only when the user explicitly asks to create or refresh a context draft.
---

# Context Preparation

This is the compact Agent policy for preparing a context draft. `GUIDE.md` is the human-facing operational runbook, not mandatory phase context. Read only its relevant sections when the user explicitly asks to create or refresh context.

## Entry Conditions

Use this playbook only if the user explicitly asks to create, rebuild, refresh, validate, or prepare a draft context.

1. State `Mode: direct (context preparation)`.
2. Read only the relevant sections of root `GUIDE.md`: Intake Contract, Flow hang ngay, and Visual state/shadow when applicable.
3. Do not load `GUIDE.md` during later delivery phases unless the user asks to create or refresh a context.

## Procedure

1. Confirm repository path, task id/title, requested phase, framework/rules, target frame, viewport contract and stable visual evidence.
2. Reuse a current collected artifact or import supplied Figma JSON first. Do not call Figma REST/MCP without an explicit user/cache-owner authorization for targeted refresh.
3. Create/update `intake.json`; record unknown critical facts as blockers, never as inferred layout/icon/viewport values.
4. Run `figma-context prepare --intake <path>` with `--design-json <path>` when a saved JSON exists. Use `--figma-url <url> --allow-figma-rest` only after explicit user/cache-owner authorization.
5. Review the validation returned by `prepare`; rerun `figma-context validate --context <draft-path> --phase <phase>` only when the user requests a separate check.
6. Return the draft path, validation result, artifact paths, cache/request result, assumptions and exact blockers.

## Boundaries

- Do not run `approve`. Approval is a human review transition.
- Do not modify customer source while preparing context unless the user separately requests it.
- Do not use draft context for implementation/review/QC.
- Do not silently switch to implementation after validation.
- Do not paste full collected/raw node trees into the response; report paths, hashes, diagnostics and requested evidence only.

## Handoff

After human approval, implementation/review/QC must route through `figma-context-task-intake`. They validate the approved context, read the context index, and load only phase-scoped artifacts. They must not reload this playbook or `GUIDE.md` unless asked to prepare a new/revised context.
