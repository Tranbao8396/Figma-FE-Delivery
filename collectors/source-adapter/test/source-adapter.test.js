const test = require("node:test");
const assert = require("assert/strict");
const { classifySourceState } = require("../src/core");

test("classifies empty, workspace, partial, and usable project inventories", () => {
  assert.equal(classifySourceState([], {}), "empty_directory");
  assert.equal(classifySourceState(["README.md", ".gitignore"], {}), "workspace_only");
  assert.equal(classifySourceState(["package.json", "src/components/Button.jsx"], { scripts: {} }), "partial_scaffold");
  assert.equal(classifySourceState(["package.json", "src/main.jsx"], { scripts: { build: "vite build" } }), "existing_project");
});
