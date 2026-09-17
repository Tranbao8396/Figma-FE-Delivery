const test = require("node:test");
const assert = require("assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { classifySourceState, collectSourceInventory } = require("../src/core");

test("classifies empty, workspace, partial, and usable project inventories", () => {
  assert.equal(classifySourceState([], {}), "empty_directory");
  assert.equal(classifySourceState(["README.md", ".gitignore"], {}), "workspace_only");
  assert.equal(classifySourceState(["package.json", "src/components/Button.jsx"], { scripts: {} }), "partial_scaffold");
  assert.equal(classifySourceState(["package.json", "src/main.jsx"], { scripts: { build: "vite build" } }), "existing_project");
});

test("excludes runtime reports from the source inventory fingerprint input", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "source-inventory-"));
  fs.mkdirSync(path.join(root, "reports"));
  fs.writeFileSync(path.join(root, "reports", "design-evidence-ledger.json"), "{}");
  fs.writeFileSync(path.join(root, "package.json"), "{}");
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(path.join(root, "src", "main.js"), "export {};");
  assert.deepEqual(collectSourceInventory(root).files, ["package.json", "src/main.js"]);
});
