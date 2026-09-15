const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const VERSION = "1.0.0";
const NON_UI_TYPES = new Set(["DOCUMENT", "PAGE", "SECTION", "SLICE", "CONNECTOR", "WIDGET", "EMBED", "LINK_UNFURL", "STAMP"]);
const VECTOR_TYPES = new Set(["VECTOR", "BOOLEAN_OPERATION", "STAR", "LINE", "ELLIPSE", "POLYGON"]);
const DESIGN_ONLY_NAME = /\b(annotation|note|spec|guide|redline|measurement|draft|template|archive|do not use)\b/i;

function assert(condition, message) { if (!condition) throw new Error(message); }
function stableSerialize(value) {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function fingerprint(value) { return crypto.createHash("sha256").update(stableSerialize(value)).digest("hex"); }
function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, "utf8")); }
function writeJson(filePath, document) { fs.mkdirSync(path.dirname(filePath), { recursive: true }); fs.writeFileSync(filePath, `${JSON.stringify(document, null, 2)}\n`, "utf8"); }
function nodeChildren(node) { return Array.isArray(node && node.children) ? node.children : []; }
function nodeBounds(node) { return node && (node.absoluteBoundingBox || node.absoluteRenderBounds) || null; }
function viewport(node) {
  const box = nodeBounds(node);
  return box && Number.isFinite(box.width) && Number.isFinite(box.height) ? `${Math.round(box.width)}x${Math.round(box.height)}` : null;
}

function findNode(node, nodeId) {
  if (!node || typeof node !== "object") return null;
  if (node.id === nodeId) return node;
  for (const child of nodeChildren(node)) {
    const match = findNode(child, nodeId);
    if (match) return match;
  }
  return null;
}

function findTargetFrame(pages, nodeId) {
  for (const page of pages || []) {
    if (page.id === nodeId) {
      for (const frame of page.frames || []) {
        for (const child of frame.children || []) {
          const node = findNode(child, nodeId);
          if (node) return { page, frame, node };
        }
      }
    }
    for (const frame of page.frames || []) {
      if (frame.nodeId === nodeId) return { page, frame, node: (frame.children || [])[0] || null };
      for (const child of frame.children || []) {
        const node = findNode(child, nodeId);
        if (node) return { page, frame, node };
      }
    }
  }
  return null;
}

function isExcluded(node) {
  return !node || node.visible === false || node.opacity === 0 || NON_UI_TYPES.has(node.type) || node.designOnly === true || DESIGN_ONLY_NAME.test(node.name || "");
}

function vectorAsset(node) {
  const box = nodeBounds(node) || {};
  const area = (box.width || 0) * (box.height || 0);
  return {
    nodeId: node.id || null,
    name: node.name || null,
    kind: area <= 4096 ? "icon" : "illustration",
    status: "requires_export_or_library_mapping",
    source: "figma_node",
    width: box.width || null,
    height: box.height || null
  };
}

function normalizeNode(node, diagnostics, assets) {
  if (isExcluded(node)) {
    diagnostics.excludedNodes += 1;
    return null;
  }
  if (VECTOR_TYPES.has(node.type)) {
    assets.push(vectorAsset(node));
    diagnostics.summarizedVectors += 1;
    return null;
  }
  const copy = { ...node };
  const children = nodeChildren(node).map((child) => normalizeNode(child, diagnostics, assets)).filter(Boolean);
  delete copy.vectorPaths;
  delete copy.pluginData;
  if (children.length) copy.children = children;
  else delete copy.children;
  return copy;
}

function normalizeDesignArtifact(collected, options = {}) {
  assert(collected && Array.isArray(collected.pages), "Collected design artifact must contain pages");
  const targetNodeId = options.targetNodeId || null;
  const inputFingerprint = fingerprint(collected);
  const provenance = { normalizer: "design-normalizer", version: VERSION, inputFingerprint, targetNodeId, status: "current" };
  if (options.previousArtifact && options.previousArtifact.provenance && options.previousArtifact.provenance.inputFingerprint === inputFingerprint && options.previousArtifact.provenance.targetNodeId === targetNodeId && options.previousArtifact.provenance.version === VERSION) return { artifact: options.previousArtifact, cacheHit: true };

  const diagnostics = { excludedNodes: 0, summarizedVectors: 0, targetFound: false, sourceKind: collected.kind || "unknown" };
  const assets = [];
  let pages = collected.pages;
  if (targetNodeId) {
    const target = findTargetFrame(collected.pages, targetNodeId);
    if (!target || !target.node) {
      pages = [];
    } else {
      diagnostics.targetFound = true;
      pages = [{
        id: targetNodeId,
        title: target.node.name || targetNodeId,
        category: "target_frame",
        frames: [{ nodeId: targetNodeId, state: target.frame && target.frame.state || "default", viewport: viewport(target.node) || target.frame && target.frame.viewport || null, children: [target.node] }]
      }];
    }
  }
  const normalizedPages = pages.map((page) => ({
    id: page.id,
    title: page.title || page.id,
    category: page.category || "unknown",
    frames: (page.frames || []).map((frame) => ({
      nodeId: frame.nodeId,
      state: frame.state || "default",
      viewport: frame.viewport || null,
      children: (frame.children || []).map((node) => normalizeNode(node, diagnostics, assets)).filter(Boolean)
    })).filter((frame) => frame.children.length)
  })).filter((page) => page.frames.length);
  return {
    artifact: {
      schemaVersion: VERSION,
      kind: "normalized_design_artifact",
      meta: {
        sourceMode: collected.meta && collected.meta.sourceMode || "unknown",
        collectedArtifact: options.collectedArtifactPath || null,
        collector: collected.meta && collected.meta.collector || null,
        targetFrame: targetNodeId || null
      },
      pages: normalizedPages,
      assets,
      designSystem: collected.designSystem || { colors: { confirmedVariables: {} }, typography: { localTextStyles: [] } },
      routingModel: collected.routingModel || { sharedShell: [] },
      ambiguities: [
        ...(collected.ambiguities || []),
        ...(targetNodeId && !diagnostics.targetFound ? [{ id: `target-frame-not-found-${targetNodeId}`, topic: "Target frame", impact: "Selected target is absent from collected artifact", decision: "blocker" }] : [])
      ],
      provenance,
      diagnostics
    },
    cacheHit: false
  };
}

function normalizeFile(inputPath, outputPath, options = {}) {
  const previousArtifact = fs.existsSync(outputPath) ? readJson(outputPath) : null;
  const result = normalizeDesignArtifact(readJson(inputPath), { ...options, collectedArtifactPath: path.resolve(inputPath), previousArtifact });
  if (!result.cacheHit) writeJson(outputPath, result.artifact);
  return { ...result, outPath: outputPath };
}

module.exports = { VERSION, normalizeDesignArtifact, normalizeFile };
