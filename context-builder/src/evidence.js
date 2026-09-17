const fs = require("fs");
const path = require("path");
const Module = require("module");
const crypto = require("crypto");
const { buildEvidenceLinks } = require("../../hooks/evidence-linker-hook/src/hook");

function assert(condition, message) { if (!condition) throw new Error(message); }
function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, "utf8")); }
function writeJson(filePath, document) { fs.mkdirSync(path.dirname(filePath), { recursive: true }); fs.writeFileSync(filePath, `${JSON.stringify(document, null, 2)}\n`, "utf8"); }
function safeSegment(value, label) {
  const normalized = String(value || "").trim().replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "");
  assert(normalized, `${label} is required`);
  return normalized;
}

function readTaskContext(contextPath) {
  const resolved = path.resolve(contextPath);
  assert(fs.existsSync(resolved), `Task context does not exist: ${resolved}`);
  const context = readJson(resolved);
  assert(context.kind === "task_context", "Evidence commands require a task context");
  assert(context.task && context.task.id, "Task context is missing task.id");
  return { contextPath: resolved, context };
}

function fileHash(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function reportPaths(contextPath) {
  const taskRoot = path.dirname(path.resolve(contextPath));
  const reportsRoot = path.join(taskRoot, "reports");
  const evidenceRoot = path.join(reportsRoot, "evidence");
  return {
    reportsRoot,
    evidenceRoot,
    screenshotsRoot: path.join(evidenceRoot, "screenshots"),
    ledgerPath: path.join(evidenceRoot, "design-evidence-ledger.json"),
    bundlePath: path.join(evidenceRoot, "quality-evidence-bundle.json"),
    linksPath: path.join(evidenceRoot, "evidence-links.json")
  };
}

function requireReportRefs(context, paths) {
  const refs = context.reportRefs;
  assert(refs && refs.designEvidenceLedger && refs.qualityEvidenceBundle && refs.evidenceLinks && refs.screenshots, "Task context requires reportRefs; create a new context revision before recording evidence");
  assert(path.resolve(refs.designEvidenceLedger) === paths.ledgerPath, "Task reportRefs designEvidenceLedger does not match task report location");
  assert(path.resolve(refs.qualityEvidenceBundle) === paths.bundlePath, "Task reportRefs qualityEvidenceBundle does not match task report location");
  assert(path.resolve(refs.evidenceLinks) === paths.linksPath, "Task reportRefs evidenceLinks does not match task report location");
}

function requireApprovedPhase(contextPath, phase, options = {}) {
  // Loaded lazily to avoid a module cycle while core imports reportPaths.
  const { validateContext } = require("./core");
  const result = validateContext(contextPath, { requireApproved: true, phase, skipTaskReportGate: true, allowSourceDrift: Boolean(options.allowSourceDrift) });
  assert(result.valid, `Evidence command requires an approved, current context: ${result.errors.join(", ")}`);
  return result.context;
}

function createLedger(contextPath, context) {
  return {
    schemaVersion: "1.0.0",
    kind: "design_evidence_ledger",
    status: "current",
    taskId: context.task.id,
    contextRef: { path: contextPath, status: context.status },
    entries: []
  };
}

function createBundle(contextPath, context) {
  return {
    schemaVersion: "1.0.0",
    kind: "quality_evidence_bundle",
    status: "current",
    revision: 1,
    taskId: context.task.id,
    contextRef: { path: contextPath, status: context.status },
    visualComparisonMatrix: [],
    captureHistory: [],
    refreshRequests: []
  };
}

function initializeEvidence(contextPath, options = {}) {
  const { contextPath: resolved, context: rawContext } = readTaskContext(contextPath);
  const context = options.preparation ? rawContext : requireApprovedPhase(resolved, options.phase || "implementation", { allowSourceDrift: options.allowSourceDrift });
  const paths = reportPaths(resolved);
  // Legacy drafts may be migrated only during preparation; a new revision must add reportRefs before delivery use.
  if (!options.preparation || context.reportRefs) requireReportRefs(context, paths);
  fs.mkdirSync(paths.screenshotsRoot, { recursive: true });
  if (!fs.existsSync(paths.ledgerPath)) writeJson(paths.ledgerPath, createLedger(resolved, context));
  if (!fs.existsSync(paths.bundlePath)) writeJson(paths.bundlePath, createBundle(resolved, context));
  return paths;
}

function parseViewport(value) {
  const match = /^(\d+)x(\d+)$/i.exec(String(value || ""));
  assert(match, "viewport must use WIDTHxHEIGHT, for example 1400x887");
  return { width: Number(match[1]), height: Number(match[2]) };
}

function loadPlaywright(sourcePath) {
  const candidates = ["playwright", "@playwright/test"];
  const requires = [require];
  if (sourcePath) requires.push(Module.createRequire(path.join(sourcePath, "package.json")));
  for (const requireFrom of requires) {
    for (const candidate of candidates) {
      try {
        const loaded = requireFrom(candidate);
        if (loaded.chromium) return loaded;
      } catch (_) { /* Try the next local runtime. */ }
    }
  }
  throw new Error("capture-evidence requires Playwright. Run npm install in context-builder, then npx playwright install chromium.");
}

function sourcePathFor(context) {
  if (!context.projectRef || !context.projectRef.path || !fs.existsSync(context.projectRef.path)) return null;
  const project = readJson(context.projectRef.path);
  return project.project && project.project.sourcePath || null;
}

async function openEvidenceBrowser(contextPath, phase = "qc", options = {}) {
  const context = requireApprovedPhase(contextPath, phase, { allowSourceDrift: options.allowSourceDrift });
  return loadPlaywright(sourcePathFor(context)).chromium.launch({ headless: true });
}

async function runActions(page, actions = []) {
  for (const action of actions) {
    assert(action && ["click", "press", "wait"].includes(action.type), "Unsupported QC action");
    if (action.type === "click") { assert(action.selector, "Click action requires selector"); await page.locator(action.selector).click(); }
    if (action.type === "press") { assert(action.key, "Press action requires key"); await page.keyboard.press(action.key); }
    if (action.type === "wait") { assert(Number.isFinite(Number(action.ms)) && Number(action.ms) >= 0, "Wait action requires non-negative ms"); await page.waitForTimeout(Number(action.ms)); }
  }
}

async function runAssertions(page, assertions = []) {
  return page.evaluate((checks) => checks.map((check) => {
    if (check.type === "document") {
      const actual = { scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight };
      const widthOk = check.scrollWidthAtMost === undefined || actual.scrollWidth <= check.scrollWidthAtMost;
      const heightOk = check.scrollHeightAtLeast === undefined || actual.scrollHeight >= check.scrollHeightAtLeast;
      return { type: "document", status: widthOk && heightOk ? "evidence_ready" : "fail", actual, expected: check };
    }
    if (check.type === "element") {
      const element = document.querySelector(check.selector);
      if (!element) return { type: "element", selector: check.selector, status: "fail", reason: "selector_missing" };
      const box = element.getBoundingClientRect();
      const visible = Boolean(box.width && box.height && getComputedStyle(element).visibility !== "hidden" && getComputedStyle(element).display !== "none");
      const attributeOk = !check.attribute || element.getAttribute(check.attribute.name) === String(check.attribute.equals);
      const visibleOk = check.visible === undefined || visible === check.visible;
      return { type: "element", selector: check.selector, status: visibleOk && attributeOk ? "evidence_ready" : "fail", actual: { visible, attribute: check.attribute ? element.getAttribute(check.attribute.name) : null, box: { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) } }, expected: check };
    }
    return { status: "blocked", reason: "unsupported_assertion", expected: check };
  }), assertions);
}

async function compareScreenshot(page, referenceImage, screenshotPath, options = {}) {
  if (!referenceImage || !fs.existsSync(referenceImage)) return { status: "blocked", reason: "reference_image_missing" };
  const result = await page.evaluate(async ({ reference, render, channelThreshold }) => {
    const load = (data) => new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = data; });
    const [referenceImage, renderImage] = await Promise.all([load(reference), load(render)]);
    if (referenceImage.width !== renderImage.width || referenceImage.height !== renderImage.height) return { status: "blocked", reason: "image_dimensions_mismatch", reference: { width: referenceImage.width, height: referenceImage.height }, render: { width: renderImage.width, height: renderImage.height } };
    const canvas = document.createElement("canvas");
    canvas.width = referenceImage.width;
    canvas.height = referenceImage.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(referenceImage, 0, 0);
    const expected = context.getImageData(0, 0, canvas.width, canvas.height).data;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(renderImage, 0, 0);
    const actual = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let mismatchPixels = 0;
    for (let index = 0; index < expected.length; index += 4) {
      if (Math.max(Math.abs(expected[index] - actual[index]), Math.abs(expected[index + 1] - actual[index + 1]), Math.abs(expected[index + 2] - actual[index + 2]), Math.abs(expected[index + 3] - actual[index + 3])) > channelThreshold) mismatchPixels += 1;
    }
    return { status: "evidence_ready", comparedPixels: canvas.width * canvas.height, mismatchPixels, mismatchPercent: Number((mismatchPixels * 100 / (canvas.width * canvas.height)).toFixed(4)), channelThreshold };
  }, { reference: `data:image/png;base64,${fs.readFileSync(referenceImage).toString("base64")}`, render: `data:image/png;base64,${fs.readFileSync(screenshotPath).toString("base64")}`, channelThreshold: Number(options.channelThreshold || 16) });
  return result;
}

function upsertCapture(contextPath, context, paths, capture) {
  const ledger = readJson(paths.ledgerPath);
  const bundle = readJson(paths.bundlePath);
  const entryId = `${capture.screen}/${capture.state}`;
  const ledgerEntry = {
    id: entryId,
    screenState: entryId,
    viewport: capture.viewport,
    figma: { nodeId: capture.nodeId || null, referenceImage: capture.referenceImage || null },
    codeMapping: capture.codeMapping || [],
    renderedScreenshot: { path: capture.screenshotPath, sha256: capture.screenshotHash, capturedAt: capture.capturedAt, url: capture.url, browser: capture.browser, dpr: capture.dpr, zoom: capture.zoom, readySelector: capture.readySelector, fonts: capture.fonts, assets: capture.assets, dataSeed: capture.dataSeed },
    testCases: capture.testCases || [],
    assertions: capture.assertions || [],
    visualDiff: capture.visualDiff || null,
    amendmentRefs: capture.amendmentRefs || [],
    confidence: "pending_comparison",
    assumptions: capture.assumptions || [],
    deviations: capture.deviations || [],
    acceptance: "pending"
  };
  ledger.entries = (ledger.entries || []).filter((entry) => entry.id !== entryId);
  ledger.entries.push(ledgerEntry);
  ledger.status = "current";
  ledger.contextRef = { path: contextPath, status: context.status };
  writeJson(paths.ledgerPath, ledger);

  const matrix = {
    screenState: entryId,
    reference: capture.referenceImage || null,
    renderTarget: capture.screenshotPath,
    viewport: capture.viewport,
    dpr: capture.dpr,
    browser: capture.browser,
    zoom: capture.zoom,
    readySelector: capture.readySelector,
    fonts: capture.fonts,
    assets: capture.assets,
    dataSeed: capture.dataSeed,
    acceptanceStatus: capture.visualDiff && capture.visualDiff.status === "evidence_ready" ? "captured_with_comparison" : "captured_pending_comparison",
    assertions: capture.assertions || [],
    visualDiff: capture.visualDiff || null,
    amendmentRefs: capture.amendmentRefs || []
  };
  bundle.visualComparisonMatrix = (bundle.visualComparisonMatrix || []).filter((entry) => entry.screenState !== entryId);
  bundle.visualComparisonMatrix.push(matrix);
  bundle.status = "current";
  bundle.revision = Number(bundle.revision || 0) + 1;
  bundle.contextRef = { path: contextPath, status: context.status };
  bundle.captureHistory = [...(bundle.captureHistory || []), { ...matrix, url: capture.url, screenshotSha256: capture.screenshotHash, capturedAt: capture.capturedAt }];
  writeJson(paths.bundlePath, bundle);
  return { ledgerPath: paths.ledgerPath, bundlePath: paths.bundlePath, entry: ledgerEntry };
}

async function captureEvidence(options) {
  assert(options && options.contextPath && options.url && options.screen && options.viewport, "capture-evidence requires --context, --url, --screen, and --viewport");
  const { contextPath } = readTaskContext(options.contextPath);
  const phase = options.phase || "implementation";
  const baseContext = requireApprovedPhase(contextPath, phase, { allowSourceDrift: true });
  const amendment = options.amendmentPath ? require("./amendment").resolveEffectiveContext(contextPath, options.amendmentPath, phase) : null;
  const context = amendment ? amendment.context : baseContext;
  const paths = initializeEvidence(contextPath, { phase, allowSourceDrift: true });
  const viewport = parseViewport(options.viewport);
  const screen = safeSegment(options.screen, "screen");
  const state = safeSegment(options.state || "default", "state");
  const dpr = Number(options.dpr || 1);
  assert(Number.isFinite(dpr) && dpr > 0, "dpr must be a positive number");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const screenshotPath = path.join(paths.screenshotsRoot, `${screen}--${state}--${viewport.width}x${viewport.height}--${timestamp}.png`);
  const ownsBrowser = !options.browser;
  const browser = options.browser || await openEvidenceBrowser(contextPath, phase, { allowSourceDrift: true });
  let page;
  try {
    page = await browser.newPage({ viewport, deviceScaleFactor: dpr });
    await page.goto(options.url, { waitUntil: "networkidle" });
    if (options.readySelector) await page.waitForSelector(options.readySelector);
    if (options.waitMs) await page.waitForTimeout(Number(options.waitMs));
    await runActions(page, options.actions || []);
    const assertions = await runAssertions(page, options.assertions || []);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    const visualDiff = options.visualDiff === false ? null : await compareScreenshot(page, options.referenceImage || context.design && context.design.referenceImages && context.design.referenceImages[0] && context.design.referenceImages[0].path, screenshotPath, options.visualDiff || {});
    return {
      screenshotPath,
      ...upsertCapture(contextPath, context, paths, {
        screen,
        state,
        viewport,
        dpr,
        screenshotPath,
        screenshotHash: fileHash(screenshotPath),
        capturedAt: new Date().toISOString(),
        url: options.url,
        browser: await browser.version(),
        zoom: options.zoom || "100%",
        readySelector: options.readySelector || null,
        fonts: options.fonts || "unconfirmed",
        assets: options.assets || "unconfirmed",
        dataSeed: options.dataSeed || "not_declared",
        testCases: options.testCases || [],
        assertions,
        visualDiff,
        amendmentRefs: options.amendmentRefs || context.amendmentRefs || [],
        nodeId: options.nodeId || context.design && context.design.targetFrame && context.design.targetFrame.nodeId || null,
        referenceImage: options.referenceImage || context.design && context.design.referenceImages && context.design.referenceImages[0] && context.design.referenceImages[0].path || null
      })
    };
  } finally {
    if (page) await page.close();
    if (ownsBrowser) await browser.close();
  }
}

function linkEvidence(contextPath, options = {}) {
  const { contextPath: resolved } = readTaskContext(contextPath);
  const phase = options.phase || "review";
  assert(["review", "qc"].includes(phase), "link-evidence phase must be review or qc");
  const context = requireApprovedPhase(resolved, phase, { allowSourceDrift: true });
  const amendment = options.amendmentPath ? require("./amendment").resolveEffectiveContext(resolved, options.amendmentPath, phase) : null;
  const paths = initializeEvidence(resolved, { phase, allowSourceDrift: true });
  const ledger = readJson(paths.ledgerPath);
  const input = {
    phase,
    amendmentRefs: amendment && amendment.context.amendmentRefs || [],
    targets: (ledger.entries || []).map((entry) => ({
      id: entry.id,
      figma: { nodeId: entry.figma && entry.figma.nodeId || null, state: entry.screenState || null, viewport: entry.viewport || null },
      sourceFiles: entry.codeMapping || [],
      testCases: entry.testCases || [],
      visualEvidence: entry.renderedScreenshot && entry.renderedScreenshot.path ? [entry.renderedScreenshot.path] : []
    }))
  };
  const previous = fs.existsSync(paths.linksPath) ? readJson(paths.linksPath) : null;
  const result = buildEvidenceLinks(input, { previousContext: previous });
  result.context.amendmentRefs = input.amendmentRefs;
  if (!result.cacheHit) writeJson(paths.linksPath, result.context);
  return { linksPath: paths.linksPath, coverage: result.context.coverage, verdict: result.context.verdict };
}

function migrateLegacyEvidence(contextPath, legacyPath, removeSource = false, options = {}) {
  const { contextPath: resolved, context } = readTaskContext(contextPath);
  const source = path.resolve(legacyPath);
  assert(fs.existsSync(source), `Legacy ledger is missing: ${source}`);
  const paths = initializeEvidence(resolved, { preparation: Boolean(options.preparation), phase: options.phase || "implementation" });
  const legacy = readJson(source);
  const ledger = readJson(paths.ledgerPath);
  for (const item of legacy.entries || []) {
    const id = item.id || safeSegment(item.scope || "legacy-entry", "legacy entry");
    ledger.entries = (ledger.entries || []).filter((entry) => entry.id !== id);
    ledger.entries.push({
      id,
      screenState: item.screenState || item.scope || id,
      viewport: item.viewport || null,
      figma: { nodeId: item.figma && item.figma.nodeId || item.figmaNodeId || null, referenceImage: item.figma && item.figma.referenceImage || item.referenceImage || null },
      codeMapping: item.codeMapping || item.code || [],
      renderedScreenshot: item.renderedScreenshot || null,
      testCases: item.testCases || [],
      confidence: item.confidence || "pending_comparison",
      assumptions: item.assumptions || [],
      deviations: item.deviations || [],
      acceptance: item.acceptance || "pending"
    });
  }
  ledger.migratedFrom = source;
  ledger.contextRef = { path: resolved, status: context.status };
  writeJson(paths.ledgerPath, ledger);
  if (removeSource) fs.rmSync(source, { force: true });
  return { ledgerPath: paths.ledgerPath, sourceRemoved: removeSource };
}

module.exports = { reportPaths, initializeEvidence, captureEvidence, linkEvidence, migrateLegacyEvidence, openEvidenceBrowser };
