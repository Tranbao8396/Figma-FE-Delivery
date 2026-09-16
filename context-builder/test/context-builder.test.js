const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
process.env.FIGMA_CONTEXT_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "figma-context-store-"));
const { buildContext, validateContext, approveContext, initializeFoundationManifest, finalizeFoundationManifest, transitionToImplementation } = require("../src/core");
const { prepareContext } = require("../src/prepare");
const { loadRootEnv } = require("../src/env");

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "figma-context-"));
  const source = path.join(root, "source");
  fs.mkdirSync(source);
  fs.writeFileSync(path.join(source, "package.json"), JSON.stringify({ dependencies: { react: "19.0.0" }, scripts: { test: "node --test" } }));
  fs.mkdirSync(path.join(source, "src"));
  fs.writeFileSync(path.join(source, "src", "main.jsx"), "export default null;");
  return { root, source };
}

function supplierContract() {
  return {
    deliveryMode: "add_page_to_static_site",
    sourceChangePolicy: "preserve_existing_entry",
    entrypointStrategy: "modify_navigation_only",
    route: { path: "supplier.html", navigationHref: "supplier.html" },
    filePlan: { primary: ["supplier.html"], create: ["supplier.html"], modify: ["index.html", "src/styles.scss"], forbid: [] }
  };
}

function scaffoldContract() {
  return {
    owner: "agent",
    framework: { name: "react", majorVersion: "19" },
    packageManager: "npm",
    buildTool: "vite",
    styling: "scss",
    routing: "react-router",
    sourceTree: { create: ["package.json", "src/main.jsx", "src/styles/app.scss"], forbid: [] },
    requiredScripts: ["dev", "build", "test"],
    baseLayout: ["app-shell", "header", "main"],
    initialPrimitives: ["button", "menu"]
  };
}

function visualFoundationInput(source, root, taskId) {
  const raw = path.join(root, `${taskId}.json`);
  const image = path.join(root, `${taskId}.png`);
  fs.writeFileSync(image, "reference");
  fs.writeFileSync(raw, JSON.stringify({ pages: [{ id: "57:99", frames: [{ nodeId: "57:99", state: "default", viewport: "1400x887", children: [{ id: "57:99", name: "Products", type: "FRAME", absoluteBoundingBox: { width: 1400, height: 887 } }] }] }] }));
  return { project: { key: "scaffold-transition", sourcePath: source }, task: { id: taskId, requestedPhase: "foundation", allowedPhases: ["analysis", "foundation"] }, profile: { customer: "test-customer", name: "scaffold-standard", version: "1", framework: { name: "react", majorVersion: "19" } }, design: { targetFrame: { nodeId: "57:99", name: "Products" }, rawArtifactPath: raw, referenceImages: [{ path: image, role: "visual_comparison" }] }, viewportContract: { referenceViewport: { width: 1400, height: 887 }, deviceScope: "pc_only", layoutBehavior: "min_width", minWidth: 1400 }, scaffoldContract: scaffoldContract() };
}

test("loads only an absent allowlisted token from a selected env file", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "figma-context-env-"));
  const envPath = path.join(root, ".env");
  fs.writeFileSync(envPath, "FIGMA_ACCESS_TOKEN=from-file\nUNRELATED_SECRET=must-not-load\n");
  delete process.env.FIGMA_TEST_TOKEN;
  fs.appendFileSync(envPath, "FIGMA_TEST_TOKEN=from-file\n");
  const result = loadRootEnv(["FIGMA_TEST_TOKEN"], { envPath });
  assert.deepEqual(result.loadedKeys, ["FIGMA_TEST_TOKEN"]);
  assert.equal(process.env.FIGMA_TEST_TOKEN, "from-file");
  assert.equal(process.env.UNRELATED_SECRET, undefined);
  process.env.FIGMA_TEST_TOKEN = "from-terminal";
  assert.deepEqual(loadRootEnv(["FIGMA_TEST_TOKEN"], { envPath }).loadedKeys, []);
  assert.equal(process.env.FIGMA_TEST_TOKEN, "from-terminal");
  delete process.env.FIGMA_TEST_TOKEN;
});

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
  const intake = { project: { key: "visual-gate-test", sourcePath: source }, task: { id: "task-6", requestedPhase: "implementation" }, profile: { customer: "test-customer", name: "standard-visual", version: "1", codingRules: ["Use semantic HTML."] }, design: { nodes: ["57:99"], targetFrame: { nodeId: "57:99", name: "Products" }, rawArtifactPath: raw, referenceImages: [{ path: image, role: "visual_comparison", measurementAuthority: "figma_frame" }] }, viewportContract: { referenceViewport: { width: 1400, height: 887 }, deviceScope: "pc_only", layoutBehavior: "min_width", minWidth: 1400, maxWidth: null, interpolationAllowed: false }, implementationContract: supplierContract() };
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
  const result = buildContext({ project: { key: "collected-stale-test", sourcePath: source }, task: { id: "task-7", requestedPhase: "implementation" }, profile: { customer: "test-customer", name: "standard-collected-stale", version: "1", codingRules: ["Use semantic HTML."] }, design: { nodes: ["57:99"], targetFrame: { nodeId: "57:99", name: "Products" }, collectedArtifactPath: collected, referenceImages: [{ path: image, role: "visual_comparison", measurementAuthority: "figma_frame" }] }, viewportContract: { referenceViewport: { width: 1400, height: 887 }, deviceScope: "pc_only", layoutBehavior: "min_width", minWidth: 1400, maxWidth: null, interpolationAllowed: false }, implementationContract: supplierContract() });
  const approved = approveContext(result.taskPath);
  fs.writeFileSync(collected, JSON.stringify({ kind: "figma_collected_artifact", pages: [] }));
  const status = validateContext(approved.approvedPath, { requireApproved: true, phase: "implementation" });
  assert(status.errors.includes("collected_design_artifact_stale"));
});

test("implementation blocks a declared dropdown state when its required shadow is not confirmed", () => {
  const { root, source } = fixture();
  const raw = path.join(root, "menu.json");
  const image = path.join(root, "menu.png");
  fs.writeFileSync(image, "reference");
  fs.writeFileSync(raw, JSON.stringify({ pages: [{ id: "57:99", frames: [{ nodeId: "57:99", children: [{ id: "57:99", name: "Products", type: "FRAME", absoluteBoundingBox: { width: 1400, height: 887 }, children: [{ id: "57:100", name: "User menu open", type: "FRAME", effects: [] }] }] }] }] }));
  const intake = { project: { key: "shadow-state-test", sourcePath: source }, task: { id: "task-shadow", requestedPhase: "implementation" }, profile: { customer: "test-customer", name: "standard-shadow", version: "1" }, design: { targetFrame: { nodeId: "57:99", name: "Products" }, rawArtifactPath: raw, referenceImages: [{ path: image, role: "visual_comparison" }], visualStates: [{ id: "user-menu-open", state: "open", trigger: "click-user-summary", targetNodeId: "57:100", required: true, requiredEffects: ["DROP_SHADOW"] }] }, viewportContract: { referenceViewport: { width: 1400, height: 887 }, deviceScope: "pc_only", layoutBehavior: "min_width", minWidth: 1400 }, implementationContract: supplierContract() };
  const result = buildContext(intake);
  const validation = validateContext(result.taskPath, { phase: "implementation" });
  assert(validation.errors.includes("required_visual_state_evidence_missing"));
  assert.deepEqual(validation.context.design.visualStates[0].readiness.errors, ["visual_state_required_effect_missing"]);
});

test("requires a scaffold contract for foundation on an empty source directory", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "figma-foundation-empty-"));
  const source = path.join(root, "source");
  fs.mkdirSync(source);
  const intake = visualFoundationInput(source, root, "foundation-blocked");
  delete intake.scaffoldContract;
  const result = buildContext(intake);
  const validation = validateContext(result.taskPath, { phase: "foundation" });
  assert(validation.errors.includes("scaffold_contract_missing"));
});

test("transitions an approved foundation baseline into a fresh implementation context", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "figma-foundation-transition-"));
  const source = path.join(root, "source");
  fs.mkdirSync(source);
  const foundationBuild = buildContext(visualFoundationInput(source, root, "foundation-1"));
  assert.equal(validateContext(foundationBuild.taskPath, { phase: "foundation" }).valid, true);
  const foundationApproved = approveContext(foundationBuild.taskPath);

  fs.mkdirSync(path.join(source, "src"));
  fs.writeFileSync(path.join(source, "package.json"), JSON.stringify({ dependencies: { react: "19.0.0" }, scripts: { build: "vite build", test: "node --test" } }));
  fs.writeFileSync(path.join(source, "src", "main.jsx"), "export default null;");
  const manifestPath = initializeFoundationManifest(foundationApproved.approvedPath).manifestPath;
  const legacyManifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  delete legacyManifest.foundationContextHash;
  fs.writeFileSync(manifestPath, JSON.stringify({ ...legacyManifest, files: [{ path: "package.json", purpose: "Project scripts" }, { path: "src/main.jsx", purpose: "Application entry" }], evidence: { commands: [{ command: "npm run build", status: "pass", summary: "Build completed" }], viewport: "1400x887", screenshot: "reports/foundation.png" } }));
  const finalized = finalizeFoundationManifest(foundationApproved.approvedPath);
  assert.equal(finalized.sourceState, "existing_project");
  assert.equal(JSON.parse(fs.readFileSync(manifestPath, "utf8")).provenanceMigrated, true);

  const transitioned = transitionToImplementation(foundationApproved.approvedPath, { task: { id: "implementation-1", title: "Products implementation" }, implementationContract: supplierContract() }, { foundationManifestPath: manifestPath });
  assert.equal(transitioned.validation.valid, true, JSON.stringify(transitioned.validation.errors));
  const context = transitioned.validation.context || validateContext(transitioned.validation.taskPath).context;
  assert.equal(context.lineage.foundationContextPath, foundationApproved.approvedPath);
  assert.equal(context.projectRef.sourceFingerprint, finalized.sourceFingerprint);
});

test("transition preserves inherited artifacts when implementation intake uses null and retargets a nested frame", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "figma-transition-retarget-"));
  const source = path.join(root, "source");
  const raw = path.join(root, "dashboard.json");
  const image = path.join(root, "dashboard.png");
  fs.mkdirSync(source);
  fs.writeFileSync(image, "reference");
  fs.writeFileSync(raw, JSON.stringify({ pages: [{ id: "page-1", frames: [{ nodeId: "page-1", state: "default", children: [{ id: "page-1", name: "Page 1", type: "CANVAS", children: [{ id: "frame-1", name: "Dashboard", type: "FRAME", absoluteBoundingBox: { width: 1400, height: 887 } }] }] }] }] }));
  const foundation = buildContext({ project: { key: "retarget-transition", sourcePath: source }, task: { id: "foundation-retarget", requestedPhase: "foundation", allowedPhases: ["analysis", "foundation"] }, profile: { customer: "test-customer", name: "retarget-standard", version: "1", framework: { name: "react", majorVersion: "19" } }, design: { targetFrame: { nodeId: "page-1", name: "Page 1" }, rawArtifactPath: raw, referenceImages: [{ path: image, role: "visual_comparison" }] }, viewportContract: { referenceViewport: { width: 1400, height: 887 }, deviceScope: "pc_only", layoutBehavior: "min_width", minWidth: 1400 }, scaffoldContract: scaffoldContract() });
  const approved = approveContext(foundation.taskPath);
  fs.mkdirSync(path.join(source, "src"));
  fs.writeFileSync(path.join(source, "package.json"), JSON.stringify({ dependencies: { react: "19.0.0" }, scripts: { build: "vite build" } }));
  fs.writeFileSync(path.join(source, "src", "main.jsx"), "export default null;");
  const manifestPath = initializeFoundationManifest(approved.approvedPath).manifestPath;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.files = [{ path: "package.json", purpose: "Project scripts" }, { path: "src/main.jsx", purpose: "Application entry" }];
  manifest.evidence.commands = [{ command: "npm run build", status: "pass", summary: "Build completed" }];
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  finalizeFoundationManifest(approved.approvedPath);

  const transitioned = transitionToImplementation(approved.approvedPath, {
    task: { id: "implementation-retarget", title: "Dashboard implementation" },
    design: { targetFrame: { nodeId: "frame-1", name: "Dashboard" }, collectedArtifactPath: null, normalizedArtifactPath: null, rawArtifactPath: null, referenceImages: [{ path: image, role: "visual_comparison" }] },
    implementationContract: supplierContract()
  }, { foundationManifestPath: manifestPath });
  assert.equal(transitioned.validation.valid, true, JSON.stringify(transitioned.validation.errors));
  const draft = JSON.parse(fs.readFileSync(transitioned.build.taskPath, "utf8"));
  assert.equal(draft.design.targetFrame.nodeId, "frame-1");
  assert(draft.design.collectedArtifactPath.endsWith("dashboard.json"));
  const normalized = JSON.parse(fs.readFileSync(draft.design.normalizedArtifactPath, "utf8"));
  assert.equal(normalized.meta.targetFrame, "frame-1");
  assert.equal(draft.visualReadiness.targetFrameConfirmed, true);
});

test("migrates the retired short foundation manifest aliases during finalization", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "figma-foundation-legacy-manifest-"));
  const source = path.join(root, "source");
  fs.mkdirSync(source);
  const foundationBuild = buildContext(visualFoundationInput(source, root, "foundation-legacy"));
  const foundationApproved = approveContext(foundationBuild.taskPath);
  fs.mkdirSync(path.join(source, "src"));
  fs.writeFileSync(path.join(source, "package.json"), JSON.stringify({ dependencies: { react: "19.0.0" }, scripts: { build: "vite build" } }));
  fs.writeFileSync(path.join(source, "src", "main.jsx"), "export default null;");
  const manifestPath = initializeFoundationManifest(foundationApproved.approvedPath).manifestPath;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  delete manifest.foundationContextHash;
  fs.writeFileSync(manifestPath, JSON.stringify({ ...manifest, filesChanged: ["package.json", "src/main.jsx"], commands: [{ name: "npm run build", status: "passed" }], evidence: { screenshotPath: "reports/foundation.png" } }));

  finalizeFoundationManifest(foundationApproved.approvedPath);
  const finalized = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  assert.deepEqual(finalized.files.map((file) => file.path), ["package.json", "src/main.jsx"]);
  assert.equal(finalized.evidence.commands[0].status, "pass");
  assert.equal(finalized.evidence.screenshot, "reports/foundation.png");
  assert.equal(finalized.provenanceMigrated, true);
});

test("prepare imports a supplied Figma JSON then builds and validates one draft", async () => {
  const { root, source } = fixture();
  const visual = path.join(root, "products.png");
  const designJson = path.join(root, "products-figma.json");
  const intakePath = path.join(root, "POS-142.intake.json");
  fs.writeFileSync(visual, "reference");
  fs.writeFileSync(designJson, JSON.stringify({ nodes: { "57:99": { document: { id: "57:99", name: "Products", type: "FRAME", absoluteBoundingBox: { width: 1400, height: 887 } } } } }));
  fs.writeFileSync(intakePath, JSON.stringify({ project: { key: "prepare-test", sourcePath: source }, task: { id: "POS-142", requestedPhase: "implementation" }, profile: { customer: "test-customer", name: "standard-prepare", version: "1", codingRules: ["Use semantic HTML."] }, design: { nodes: ["57:99"], targetFrame: { nodeId: "57:99", name: "Products" }, referenceImages: [{ path: visual, role: "visual_comparison", measurementAuthority: "figma_frame" }] }, viewportContract: { referenceViewport: { width: 1400, height: 887 }, deviceScope: "pc_only", layoutBehavior: "min_width", minWidth: 1400, maxWidth: null, interpolationAllowed: false }, implementationContract: supplierContract() }));
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

test("implementation is blocked when file and route ownership is absent", () => {
  const { root, source } = fixture();
  const raw = path.join(root, "supplier.json");
  const image = path.join(root, "supplier.png");
  fs.writeFileSync(image, "reference");
  fs.writeFileSync(raw, JSON.stringify({ pages: [{ id: "57:99", frames: [{ nodeId: "57:99", children: [{ id: "57:99", name: "Supplier", type: "FRAME", absoluteBoundingBox: { width: 1400, height: 887 } }] }] }] }));
  const result = buildContext({ project: { key: "missing-contract-test", sourcePath: source }, task: { id: "task-8", requestedPhase: "implementation" }, profile: { customer: "test-customer", name: "standard-missing-contract", version: "1" }, design: { targetFrame: { nodeId: "57:99", name: "Supplier" }, rawArtifactPath: raw, referenceImages: [{ path: image, role: "visual_comparison" }] }, viewportContract: { referenceViewport: { width: 1400, height: 887 }, deviceScope: "pc_only", layoutBehavior: "min_width", minWidth: 1400 } });
  const validation = validateContext(result.taskPath, { phase: "implementation" });
  assert(validation.errors.includes("implementation_contract_missing"));
});

test("static add-page contract rejects index.html as the primary page", () => {
  const { root, source } = fixture();
  const raw = path.join(root, "supplier.json");
  const image = path.join(root, "supplier.png");
  fs.writeFileSync(image, "reference");
  fs.writeFileSync(raw, JSON.stringify({ pages: [{ id: "57:99", frames: [{ nodeId: "57:99", children: [{ id: "57:99", name: "Supplier", type: "FRAME", absoluteBoundingBox: { width: 1400, height: 887 } }] }] }] }));
  const invalidContract = { ...supplierContract(), filePlan: { primary: ["index.html"], create: ["supplier.html"], modify: [], forbid: [] } };
  const result = buildContext({ project: { key: "index-primary-test", sourcePath: source }, task: { id: "task-9", requestedPhase: "implementation" }, profile: { customer: "test-customer", name: "standard-index-primary", version: "1" }, design: { targetFrame: { nodeId: "57:99", name: "Supplier" }, rawArtifactPath: raw, referenceImages: [{ path: image, role: "visual_comparison" }] }, viewportContract: { referenceViewport: { width: 1400, height: 887 }, deviceScope: "pc_only", layoutBehavior: "min_width", minWidth: 1400 }, implementationContract: invalidContract });
  const validation = validateContext(result.taskPath, { phase: "implementation" });
  assert(validation.errors.includes("implementation_static_page_primary_mismatch"));
  assert(validation.errors.includes("implementation_static_page_cannot_use_index_as_primary"));
});
