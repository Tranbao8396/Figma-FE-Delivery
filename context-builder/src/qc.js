const fs = require("fs");
const net = require("net");
const path = require("path");
const { captureEvidence, openEvidenceBrowser } = require("./evidence");

function assert(condition, message) { if (!condition) throw new Error(message); }
function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, "utf8")); }
function writeJson(filePath, document) { fs.mkdirSync(path.dirname(filePath), { recursive: true }); fs.writeFileSync(filePath, `${JSON.stringify(document, null, 2)}\n`, "utf8"); }
function safeId(value, label) { const id = String(value || "").trim().replace(/[^a-z0-9._-]+/gi, "-"); assert(id, `${label} is required`); return id; }

function qcPaths(contextPath) {
  const root = path.join(path.dirname(path.resolve(contextPath)), "reports", "qc");
  return { root, planPath: path.join(root, "qc-plan.json"), runPath: path.join(root, "qc-run.json"), diffPath: path.join(root, "visual-diff-summary.json") };
}

function allocatePort(host = "127.0.0.1") {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, host, () => {
      const address = server.address();
      server.close((error) => error ? reject(error) : resolve({ host, port: address.port, warning: "Port is available at allocation time; start the local server immediately." }));
    });
  });
}

function viewport(value, label) {
  assert(value && Number.isFinite(Number(value.width)) && Number(value.width) > 0 && Number.isFinite(Number(value.height)) && Number(value.height) > 0, `${label} requires positive width and height`);
  return { width: Number(value.width), height: Number(value.height) };
}

function qualityCases(context, options) {
  const base = context.viewportContract && context.viewportContract.referenceViewport;
  const defaultReference = context.design && context.design.referenceImages && context.design.referenceImages[0] && context.design.referenceImages[0].path || null;
  const defaultCase = {
    id: "baseline-default",
    screen: options.screen || context.design && context.design.targetFrame && context.design.targetFrame.name || "screen",
    state: "default",
    viewport: viewport(base, "viewportContract.referenceViewport"),
    referenceImage: defaultReference,
    testCases: options.testCases && options.testCases.length ? options.testCases : [`QC-${context.task.id}-BASELINE`],
    actions: [],
    assertions: [{ type: "document", scrollWidthAtMost: Number(base.width), scrollHeightAtLeast: Number(base.height) }]
  };
  const configured = context.qualityPlan && Array.isArray(context.qualityPlan.cases) ? context.qualityPlan.cases : [];
  const configuredIds = new Set(configured.map((entry) => entry.id));
  const requiredVisualStates = context.design && Array.isArray(context.design.visualStates) ? context.design.visualStates.filter((state) => state.required && !configuredIds.has(state.id)).map((state) => ({
    id: state.id,
    screen: defaultCase.screen,
    state: state.state || state.id,
    viewport: defaultCase.viewport,
    referenceImagePath: state.referenceImage && state.referenceImage.path || defaultReference,
    testCases: [`QC-${context.task.id}-${state.id}`],
    actions: [],
    assertions: [],
    blockedReason: "visual_state_action_missing"
  })) : [];
  return [defaultCase, ...configured, ...requiredVisualStates].map((entry, index) => ({
    id: safeId(entry.id || `case-${index + 1}`, "QC case id"),
    screen: safeId(entry.screen || defaultCase.screen, "QC screen"),
    state: safeId(entry.state || "default", "QC state"),
    viewport: viewport(entry.viewport || defaultCase.viewport, "QC viewport"),
    referenceImage: entry.referenceImagePath || defaultReference,
    testCases: Array.isArray(entry.testCases) && entry.testCases.length ? entry.testCases : defaultCase.testCases,
    actions: Array.isArray(entry.actions) ? entry.actions : [],
    assertions: Array.isArray(entry.assertions) ? entry.assertions : defaultCase.assertions,
    visualDiff: entry.visualDiff || context.qualityPlan && context.qualityPlan.visualDiff || {},
    blockedReason: entry.blockedReason || null
  }));
}

function buildQcPlan(contextPath, options = {}) {
  const { validateContext } = require("./core");
  const validation = validateContext(contextPath, { requireApproved: true, phase: "qc", skipTaskReportGate: true, allowSourceDrift: true });
  assert(validation.valid, `QC plan requires approved, current QC context: ${validation.errors.join(", ")}`);
  assert(options.url, "qc-plan requires --url <application-url>");
  const resolved = options.amendmentPath ? require("./amendment").resolveEffectiveContext(contextPath, options.amendmentPath, "qc") : null;
  const context = resolved ? resolved.context : validation.context;
  const plan = {
    schemaVersion: "1.0.0",
    kind: "qc_plan",
    status: "current",
    taskId: context.task.id,
    contextRef: { path: path.resolve(contextPath), status: context.status },
    amendmentRefs: context.amendmentRefs || [],
    url: options.url,
    readySelector: options.readySelector || null,
    dpr: Number(options.dpr || 1),
    zoom: options.zoom || "100%",
    fonts: options.fonts || "unconfirmed",
    assets: options.assets || "unconfirmed",
    dataSeed: options.dataSeed || "not_declared",
    cases: qualityCases(context, options),
    executionPolicy: { visualComparison: "evidence_only", finalVerdictAuthority: "human_or_independent_policy" }
  };
  assert(Number.isFinite(plan.dpr) && plan.dpr > 0, "QC dpr must be positive");
  const paths = qcPaths(contextPath);
  writeJson(paths.planPath, plan);
  return { planPath: paths.planPath, caseCount: plan.cases.length, status: plan.status };
}

async function runQcPlan(contextPath, options = {}) {
  const paths = qcPaths(contextPath);
  const planPath = options.planPath || paths.planPath;
  assert(fs.existsSync(planPath), `QC plan does not exist: ${planPath}`);
  const plan = readJson(planPath);
  assert(plan.kind === "qc_plan" && plan.status === "current", "QC run requires a current qc_plan");
  const { validateContext } = require("./core");
  const validation = validateContext(contextPath, { requireApproved: true, phase: "qc", skipTaskReportGate: true, allowSourceDrift: true });
  assert(validation.valid, `QC run requires approved, current QC context: ${validation.errors.join(", ")}`);
  const resolved = options.amendmentPath ? require("./amendment").resolveEffectiveContext(contextPath, options.amendmentPath, "qc") : null;
  if (resolved) assert(JSON.stringify(plan.amendmentRefs || []) === JSON.stringify(resolved.context.amendmentRefs || []), "QC plan amendment references do not match the supplied amendment");
  const results = [];
  const browser = await openEvidenceBrowser(contextPath, "qc", { allowSourceDrift: true });
  try {
    for (const testCase of plan.cases) {
      try {
        if (testCase.blockedReason) { results.push({ id: testCase.id, status: "blocked", reason: testCase.blockedReason }); continue; }
        const effectiveContext = resolved ? resolved.context : validation.context;
        const capture = await captureEvidence({ contextPath, phase: "qc", browser, url: plan.url, screen: testCase.screen, state: testCase.state, viewport: `${testCase.viewport.width}x${testCase.viewport.height}`, dpr: plan.dpr, zoom: plan.zoom, readySelector: plan.readySelector, fonts: plan.fonts, assets: plan.assets, dataSeed: plan.dataSeed, testCases: testCase.testCases, nodeId: effectiveContext.design && effectiveContext.design.targetFrame && effectiveContext.design.targetFrame.nodeId, referenceImage: testCase.referenceImage, actions: testCase.actions, assertions: testCase.assertions, visualDiff: testCase.visualDiff, amendmentRefs: effectiveContext.amendmentRefs || [] });
        const entry = capture.entry;
        const assertionFailure = (entry.assertions || []).some((assertion) => assertion.status === "fail");
        results.push({ id: testCase.id, status: assertionFailure ? "fail" : "evidence_ready", capture: capture.screenshotPath, assertions: entry.assertions || [], visualDiff: entry.visualDiff || null });
      } catch (error) {
        results.push({ id: testCase.id, status: "blocked", reason: error.message });
      }
    }
  } finally {
    await browser.close();
  }
  const run = { schemaVersion: "1.0.0", kind: "qc_run", status: "current", taskId: plan.taskId, contextRef: plan.contextRef, amendmentRefs: plan.amendmentRefs || [], planPath: path.resolve(planPath), executedAt: new Date().toISOString(), results, verdict: "evidence_ready_only", finalVerdictAuthority: "human_or_independent_policy" };
  writeJson(paths.runPath, run);
  writeJson(paths.diffPath, { schemaVersion: "1.0.0", kind: "visual_diff_summary", status: "current", taskId: plan.taskId, runPath: paths.runPath, comparisons: results.map((result) => ({ caseId: result.id, status: result.visualDiff ? result.visualDiff.status : result.status === "blocked" ? "blocked" : "not_run", detail: result.visualDiff || { reason: result.reason || "visual_diff_not_recorded" } })), verdict: "evidence_ready_only" });
  return { runPath: paths.runPath, diffPath: paths.diffPath, executedCount: results.filter((result) => result.status === "evidence_ready").length, blockedCount: results.filter((result) => result.status === "blocked").length, verdict: run.verdict };
}

module.exports = { qcPaths, buildQcPlan, runQcPlan, allocatePort };
