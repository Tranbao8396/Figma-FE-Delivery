const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
process.env.FIGMA_CONTEXT_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "figma-cli-root-"));
const { execute, resolveCommand, resolveTaskContext } = require("../src/cli");

test("routes grouped commands and preserves legacy aliases", async () => {
  assert.deepEqual(resolveCommand(["ctx", "status"]).group, "context");
  assert.equal(resolveCommand(["amend-init"]).action, "create");
  const modern = await execute(["util", "allocate-port"]);
  assert.equal(modern.meta.command, "util allocate-port");
  assert.equal(modern.meta.legacyAlias, false);
  const legacy = await execute(["allocate-port"]);
  assert.equal(legacy.meta.legacyAlias, true);
  assert(legacy.meta.warnings[0].includes("util allocate-port"));
});

test("resolves only approved task contexts and rejects unsafe task selectors", () => {
  const root = process.env.FIGMA_CONTEXT_ROOT;
  const approved = path.join(root, "tasks", "pos", "POS-001", "task-context.approved.json");
  fs.mkdirSync(path.dirname(approved), { recursive: true });
  fs.writeFileSync(approved, "{}");
  assert.equal(resolveTaskContext("pos/POS-001"), approved);
  assert.throws(() => resolveTaskContext("pos/../secret"), /safe path segments/);
  assert.throws(() => resolveTaskContext("pos"), /project-key/);
});

test("rejects --task combined with --context", async () => {
  await assert.rejects(() => execute(["context", "status", "--task", "pos/POS-001", "--context", "x"]), /either --context or --task/);
});
