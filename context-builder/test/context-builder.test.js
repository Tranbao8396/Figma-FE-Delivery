const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
process.env.FIGMA_CONTEXT_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "figma-context-store-"));
const { buildContext, validateContext, approveContext } = require("../src/core");
const { prepareContext } = require("../src/prepare");

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "figma-context-"));
  const source = path.join(root, "source");
  fs.mkdirSync(source);
  fs.writeFileSync(path.join(source, "package.json"), JSON.stringify({ dependencies: { react: "19.0.0" }, scripts: { test: "node --test" } }));
  fs.mkdirSync(path.join(source, "src"));
  fs.writeFileSync(path.join(source, "src", "main.jsx"), "export default null;");
  return { root, source };
}

test("build reuses profile/project artifacts and allows an analysis-only approval", () => {
  const { source } = fixture();
  const intake = { project: { key: "context-test", sourcePath: source }, task: { id: "task-1", requestedPhase: "analysis" }, profile: { customer: "test-customer", name: "standard", version: "1", codingRules: ["Use semantic HTML."] }, design: { nodes: [] } };
  const first = buildContext(intake);
  const second = buildContext(intake);
  assert.equal(second.cacheHit, true);
  const draft = validateContext(first.taskPath);
  assert.equal(draft.valid, true);
  const approved = approveContext(first.taskPath);
  const status = validateContext(approved.approvedPath, { requireApproved: true });
  assert.equal(status.valid, true);
});

test("approval rejects a task whose requested phase is blocked", () => {
  const { source } = fixture();
  const result = buildContext({ project: { key: "blocked-test", sourcePath: source }, task: { id: "task-2", requestedPhase: "implementation" }, profile: { customer: "test-customer", name: "standard-blocked", version: "1", codingRules: ["Use semantic HTML."] }, design: { nodes: [] } });
  const validation = validateContext(result.taskPath);
  assert.equal(validation.valid, false);
  assert(validation.errors.includes("requested_phase_blocked:implementation"));
  assert.throws(() => approveContext(result.taskPath), /cannot be approved/);
});

test("approved context fails integrity validation after a checksum mismatch", () => {
  const { source } = fixture();
  const result = buildContext({ project: { key: "integrity-test", sourcePath: source }, task: { id: "task-3", requestedPhase: "analysis" }, profile: { customer: "test-customer", name: "standard-integrity", version: "1", codingRules: ["Use semantic HTML."] }, design: { nodes: [] } });
  const approved = approveContext(result.taskPath);
  fs.chmodSync(`${approved.approvedPath}.sha256`, 0o644);
  fs.writeFileSync(`${approved.approvedPath}.sha256`, "broken\n");
  const status = validateContext(approved.approvedPath, { requireApproved: true });
  assert(status.errors.includes("approved_checksum_mismatch"));
});

test("validation marks an approved context stale when its source changes", () => {
  const { source } = fixture();
  const result = buildContext({ project: { key: "stale-test", sourcePath: source }, task: { id: "task-4", requestedPhase: "analysis" }, profile: { customer: "test-customer", name: "standard-stale", version: "1", codingRules: ["Use semantic HTML."] }, design: { nodes: [] } });
  const approved = approveContext(result.taskPath);
  fs.writeFileSync(path.join(source, "src", "new-file.js"), "export const changed = true;");
  const status = validateContext(approved.approvedPath, { requireApproved: true });
  assert(status.errors.includes("source_context_stale"));
});

test("validation marks an approved analysis context stale when its raw design artifact changes", () => {
  const { root, source } = fixture();
  const raw = path.join(root, "raw-design.json");
  fs.writeFileSync(raw, "{}");
  const result = buildContext({ project: { key: "design-stale-test", sourcePath: source }, task: { id: "task-5", requestedPhase: "analysis" }, profile: { customer: "test-customer", name: "standard-design-stale", version: "1", codingRules: ["Use semantic HTML."] }, design: { nodes: [], rawArtifactPath: raw } });
  const approved = approveContext(result.taskPath);
  fs.writeFileSync(raw, '{"changed":true}');
  const status = validateContext(approved.approvedPath, { requireApproved: true });
  assert(status.errors.includes("design_artifact_stale"));
});

test("implementation requires a target frame, viewport contract, and visual reference", () => {
  const { root, source } = fixture();
  const raw = path.join(root, "raw-design.json");
  const image = path.join(root, "product.png");
  fs.writeFileSync(image, "reference");
  fs.writeFileSync(raw, JSON.stringify({ meta: { sourceMode: "imported_json" }, pages: [{ id: "57:99", title: "Products", frames: [{ nodeId: "57:99", state: "default", viewport: "1400x887", children: [{ id: "57:99", name: "Products", type: "FRAME", absoluteBoundingBox: { x: 0, y: 0, width: 1400, height: 887 } }] }] }], designSystem: { colors: { confirmedVariables: {} }, typography: { localTextStyles: [] } }, routingModel: { sharedShell: [] }, ambiguities: [] }));
  const intake = { project: { key: "visual-gate-test", sourcePath: source }, task: { id: "task-6", requestedPhase: "implementation" }, profile: { customer: "test-customer", name: "standard-visual", version: "1", codingRules: ["Use semantic HTML."] }, design: { nodes: ["57:99"], targetFrame: { nodeId: "57:99", name: "Products" }, rawArtifactPath: raw, referenceImages: [{ path: image, role: "visual_comparison", measurementAuthority: "figma_frame" }] }, viewportContract: { referenceViewport: { width: 1400, height: 887 }, deviceScope: "pc_only", layoutBehavior: "min_width", minWidth: 1400, maxWidth: null, interpolationAllowed: false } };
  const result = buildContext(intake);
  const validation = validateContext(result.taskPath, { phase: "implementation" });
  assert.equal(validation.valid, true);
  const context = validation.context;
  const normalized = JSON.parse(fs.readFileSync(context.design.normalizedArtifactPath, "utf8"));
  assert.equal(normalized.kind, "normalized_design_artifact");
  assert.deepEqual(normalized.pages.map((page) => page.id), ["57:99"]);
});

test("validation detects a changed collected artifact after normalization", () => {
  const { root, source } = fixture();
  const collected = path.join(root, "products.collected.json");
  const image = path.join(root, "product.png");
  fs.writeFileSync(image, "reference");
  fs.writeFileSync(collected, JSON.stringify({ kind: "figma_collected_artifact", pages: [{ id: "57:99", title: "Products", frames: [{ nodeId: "57:99", children: [{ id: "57:99", name: "Products", type: "FRAME", absoluteBoundingBox: { width: 1400, height: 887 } }] }] }] }));
  const result = buildContext({ project: { key: "collected-stale-test", sourcePath: source }, task: { id: "task-7", requestedPhase: "implementation" }, profile: { customer: "test-customer", name: "standard-collected-stale", version: "1", codingRules: ["Use semantic HTML."] }, design: { nodes: ["57:99"], targetFrame: { nodeId: "57:99", name: "Products" }, collectedArtifactPath: collected, referenceImages: [{ path: image, role: "visual_comparison", measurementAuthority: "figma_frame" }] }, viewportContract: { referenceViewport: { width: 1400, height: 887 }, deviceScope: "pc_only", layoutBehavior: "min_width", minWidth: 1400, maxWidth: null, interpolationAllowed: false } });
  const approved = approveContext(result.taskPath);
  fs.writeFileSync(collected, JSON.stringify({ kind: "figma_collected_artifact", pages: [] }));
  const status = validateContext(approved.approvedPath, { requireApproved: true, phase: "implementation" });
  assert(status.errors.includes("collected_design_artifact_stale"));
});

test("prepare imports a supplied Figma JSON then builds and validates one draft", async () => {
  const { root, source } = fixture();
  const visual = path.join(root, "products.png");
  const designJson = path.join(root, "products-figma.json");
  const intakePath = path.join(root, "POS-142.intake.json");
  fs.writeFileSync(visual, "reference");
  fs.writeFileSync(designJson, JSON.stringify({ nodes: { "57:99": { document: { id: "57:99", name: "Products", type: "FRAME", absoluteBoundingBox: { width: 1400, height: 887 } } } } }));
  fs.writeFileSync(intakePath, JSON.stringify({ project: { key: "prepare-test", sourcePath: source }, task: { id: "POS-142", requestedPhase: "implementation" }, profile: { customer: "test-customer", name: "standard-prepare", version: "1", codingRules: ["Use semantic HTML."] }, design: { nodes: ["57:99"], targetFrame: { nodeId: "57:99", name: "Products" }, referenceImages: [{ path: visual, role: "visual_comparison", measurementAuthority: "figma_frame" }] }, viewportContract: { referenceViewport: { width: 1400, height: 887 }, deviceScope: "pc_only", layoutBehavior: "min_width", minWidth: 1400, maxWidth: null, interpolationAllowed: false } }));
  const result = await prepareContext({ intakePath, designJsonPath: designJson });
  assert.equal(result.collection.mode, "import");
  assert.equal(result.validation.valid, true);
  assert(fs.existsSync(result.collection.artifactPath));
});

test("prepare refuses Figma REST without explicit authorization", async () => {
  const { root, source } = fixture();
  const intakePath = path.join(root, "POS-143.intake.json");
  fs.writeFileSync(intakePath, JSON.stringify({ project: { key: "prepare-rest-test", sourcePath: source }, task: { id: "POS-143", requestedPhase: "analysis" }, profile: { customer: "test-customer", name: "standard-prepare-rest", version: "1" }, design: { nodes: ["57:99"] } }));
  await assert.rejects(() => prepareContext({ intakePath, figmaUrl: "https://www.figma.com/design/file/Products?node-id=57-99" }), /allow-figma-rest/);
});
