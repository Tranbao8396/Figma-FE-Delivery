# Codex Lifecycle Hooks

Codex lifecycle hooks are project-scoped event commands configured in a customer's `<repo>/.codex/hooks.json`. They are separate from the local compilers in `../hooks/`.

Use [hooks.json.template](hooks.json.template) only when a project needs lifecycle status reporting. Copy/adapt it inside that project's `.codex/` directory after deciding the project context location.

The supplied dispatcher is deliberately read-only. It reports whether `FIGMA_FRONTEND_CONTEXT_DIR` exists. It does not build context, scan the repository, call Figma MCP, alter source, inject an approved context into an Agent, or determine pass/fail. Context Builder remains explicitly invoked by a user before the Agent task begins.
