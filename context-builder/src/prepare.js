const fs = require("fs");
const path = require("path");
const { CONTEXT_ROOT, buildContext, validateContext } = require("./core");
const { importDesign, collectFromFigma } = require("../../design-collector/src/core");

function assert(condition, message) { if (!condition) throw new Error(message); }
function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, "utf8")); }
function writeJson(filePath, document) { fs.mkdirSync(path.dirname(filePath), { recursive: true }); fs.writeFileSync(filePath, `${JSON.stringify(document, null, 2)}\n`, "utf8"); }
function safeSegment(value, field) {
  assert(typeof value === "string" && /^[a-z0-9][a-z0-9-]*$/i.test(value), `${field} must contain letters, digits, or hyphens only`);
  return value;
}
function designOutputPath(intake) {
  return path.join(CONTEXT_ROOT, "projects", safeSegment(intake.project && intake.project.key, "project.key"), "figma", safeSegment(intake.task && intake.task.id, "task.id"), "design.collected.json");
}
function nodeIds(options, intake) {
  if (options.nodeIds && options.nodeIds.length) return options.nodeIds;
  if (intake.design && Array.isArray(intake.design.nodes) && intake.design.nodes.length) return intake.design.nodes;
  if (intake.design && intake.design.targetFrame && intake.design.targetFrame.nodeId) return [intake.design.targetFrame.nodeId];
  return [];
}

async function prepareContext(options) {
  assert(options && options.intakePath, "prepare requires --intake <path>");
  const intakePath = path.resolve(options.intakePath);
  const intake = readJson(intakePath);
  const effectiveIntake = { ...intake, design: { ...(intake.design || {}) } };
  const requestedNodeIds = nodeIds(options, effectiveIntake);
  let collection = { mode: "existing", cacheHit: null, artifactPath: effectiveIntake.design.collectedArtifactPath || effectiveIntake.design.rawArtifactPath || null };

  if (options.designJsonPath) {
    assert(!options.figmaUrl, "Use either --design-json or --figma-url, not both");
    const result = importDesign({
      inputPath: path.resolve(options.designJsonPath),
      outPath: options.outPath ? path.resolve(options.outPath) : designOutputPath(effectiveIntake),
      figmaUrl: effectiveIntake.design.figmaUrl || null,
      nodeIds: requestedNodeIds,
      maxDepth: options.maxDepth || 10,
      maxChildren: options.maxChildren || 100
    });
    effectiveIntake.design.collectedArtifactPath = result.outPath;
    collection = { mode: "import", cacheHit: result.cacheHit, artifactPath: result.outPath, pages: result.artifact.pages.length };
  } else if (options.figmaUrl) {
    assert(options.allowFigmaRest, "Figma REST collection requires explicit --allow-figma-rest");
    const result = await collectFromFigma({
      figmaUrl: options.figmaUrl,
      outPath: options.outPath ? path.resolve(options.outPath) : designOutputPath(effectiveIntake),
      nodeIds: requestedNodeIds,
      depth: options.depth || 10,
      maxDepth: options.maxDepth || 10,
      maxChildren: options.maxChildren || 100,
      refresh: Boolean(options.refresh),
      tokenEnv: options.tokenEnv || "FIGMA_ACCESS_TOKEN",
      version: options.version || null
    });
    effectiveIntake.design.figmaUrl = options.figmaUrl;
    effectiveIntake.design.collectedArtifactPath = result.outPath;
    collection = { mode: "figma_rest", cacheHit: result.cacheHit, artifactPath: result.outPath, pages: result.artifact.pages.length };
  }

  if (options.resolvedIntakePath) writeJson(path.resolve(options.resolvedIntakePath), effectiveIntake);
  const build = buildContext(effectiveIntake);
  const context = validateContext(build.taskPath, { phase: options.phase || effectiveIntake.task && effectiveIntake.task.requestedPhase });
  return { mode: "prepare", intakePath, resolvedIntakePath: options.resolvedIntakePath ? path.resolve(options.resolvedIntakePath) : null, collection, build, validation: { valid: context.valid, errors: context.errors, taskPath: build.taskPath } };
}

module.exports = { prepareContext };
