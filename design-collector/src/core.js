const crypto = require("crypto");
const fs = require("fs");
const https = require("https");
const path = require("path");

const VERSION = "1.2.0";
const CONTEXT_ROOT = process.env.FIGMA_CONTEXT_ROOT || "D:\\agents\\figma-frontend-agent\\contexts";
const NODE_FIELDS = ["id", "name", "type", "visible", "opacity", "layoutMode", "itemSpacing", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "absoluteBoundingBox", "absoluteRenderBounds", "cornerRadius", "strokeWeight", "clipContent", "characters", "fontSize", "fontWeight", "fontName"];

function assert(condition, message) { if (!condition) throw new Error(message); }
function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, "utf8")); }
function writeJson(filePath, value) { fs.mkdirSync(path.dirname(filePath), { recursive: true }); fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8"); }
function hash(value) { return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function isWithin(root, candidate) { const relative = path.relative(path.resolve(root), path.resolve(candidate)); return relative && !relative.startsWith("..") && !path.isAbsolute(relative); }
function assertContextOutput(outputPath) { assert(isWithin(CONTEXT_ROOT, outputPath), `Collector output must stay under ${CONTEXT_ROOT}: ${outputPath}`); }

function normalizeNodeId(value) {
  assert(typeof value === "string" && value.trim(), "Figma node id must be a non-empty string");
  const decoded = decodeURIComponent(value.trim());
  return /^\d+-\d+$/.test(decoded) ? decoded.replace("-", ":") : decoded;
}

function parseFigmaUrl(value) {
  const url = new URL(value);
  assert(/(^|\.)figma\.com$/i.test(url.hostname), "Figma URL must use a figma.com hostname");
  const match = url.pathname.match(/\/(?:design|file|proto)\/([^/?#]+)/i);
  assert(match, "Figma URL does not contain a supported file key");
  const nodeId = url.searchParams.get("node-id");
  return { fileKey: match[1], nodeIds: nodeId ? [normalizeNodeId(nodeId)] : [], canonicalUrl: `${url.origin}${url.pathname}` };
}

function compactPaint(paint) {
  if (!paint || typeof paint !== "object") return null;
  const result = {};
  for (const key of ["type", "visible", "opacity", "blendMode", "color"]) if (paint[key] !== undefined) result[key] = paint[key];
  return result;
}

// Figma effects are retained as bounded visual facts; raw node payloads stay excluded.
function compactEffect(effect) {
  if (!effect || typeof effect !== "object") return null;
  const result = {};
  for (const key of ["type", "visible", "radius", "spread", "blendMode"]) if (effect[key] !== undefined) result[key] = effect[key];
  if (effect.offset && typeof effect.offset === "object") {
    const offset = {};
    for (const key of ["x", "y"]) if (Number.isFinite(effect.offset[key])) offset[key] = effect.offset[key];
    if (Object.keys(offset).length) result.offset = offset;
  }
  if (effect.color && typeof effect.color === "object") {
    const color = {};
    for (const key of ["r", "g", "b", "a"]) if (Number.isFinite(effect.color[key])) color[key] = effect.color[key];
    if (Object.keys(color).length) result.color = color;
  }
  return result.type ? result : null;
}

// Adapter projection is transport-safe only. Semantic pruning belongs to Design Normalizer.
function adaptNode(node, options, diagnostics, depth = 0) {
  if (!node || typeof node !== "object") return null;
  const output = {};
  for (const field of NODE_FIELDS) if (node[field] !== undefined) output[field] = node[field];
  if (Array.isArray(node.fills)) output.fills = node.fills.map(compactPaint).filter(Boolean);
  if (Array.isArray(node.strokes)) output.strokes = node.strokes.map(compactPaint).filter(Boolean);
  if (Array.isArray(node.effects)) output.effects = node.effects.map(compactEffect).filter(Boolean);
  const children = Array.isArray(node.children) ? node.children : [];
  if (depth >= options.maxDepth) {
    if (children.length) diagnostics.truncatedDepthNodes += children.length;
    return output;
  }
  const accepted = children.slice(0, options.maxChildren).map((child) => adaptNode(child, options, diagnostics, depth + 1)).filter(Boolean);
  if (accepted.length) output.children = accepted;
  if (children.length > options.maxChildren) diagnostics.truncatedChildNodes += children.length - options.maxChildren;
  return output;
}

function nodeViewport(node) {
  const box = node && (node.absoluteBoundingBox || node.absoluteRenderBounds);
  if (!box || !Number.isFinite(box.width) || !Number.isFinite(box.height)) return null;
  return `${Math.round(box.width)}x${Math.round(box.height)}`;
}

function rawFromFigmaResponse(response, metadata, options = {}) {
  assert(response && response.nodes && typeof response.nodes === "object", "Figma response must contain nodes");
  const diagnostics = { requestedNodeCount: metadata.nodeIds.length, missingNodeIds: [], truncatedDepthNodes: 0, truncatedChildNodes: 0 };
  const pages = [];
  for (const nodeId of metadata.nodeIds) {
    const result = response.nodes[nodeId];
    if (!result || !result.document) { diagnostics.missingNodeIds.push(nodeId); continue; }
    const document = adaptNode(result.document, options, diagnostics);
    pages.push({
      id: nodeId,
      title: document.name || nodeId,
      category: "figma_node",
      frames: [{ nodeId: document.id || nodeId, state: "default", viewport: nodeViewport(document), children: [document] }]
    });
  }
  return {
    schemaVersion: VERSION,
    kind: "figma_collected_artifact",
    meta: {
      sourceMode: metadata.sourceMode,
      capturedAt: metadata.capturedAt || new Date().toISOString(),
      figmaFile: { fileKey: metadata.fileKey, rootNodeId: null },
      collector: {
        version: VERSION,
        canonicalUrl: metadata.canonicalUrl || null,
        nodeIds: metadata.nodeIds,
        queryFingerprint: metadata.queryFingerprint || null,
        endpoint: metadata.endpoint || null,
        requestCount: metadata.requestCount || 0,
        lastModified: response.lastModified || null,
        version: response.version || null
      }
    },
    pages,
    designSystem: { colors: { confirmedVariables: {} }, typography: { localTextStyles: [] } },
    routingModel: { sharedShell: [] },
    ambiguities: diagnostics.missingNodeIds.map((nodeId) => ({ id: `missing-node-${nodeId}`, topic: `Figma node ${nodeId}`, impact: "Target node was unavailable", decision: "blocker" })),
    collectorDiagnostics: diagnostics
  };
}

function rawFromExistingArtifact(input, metadata, options = {}) {
  if (input && input.nodes) return rawFromFigmaResponse(input, metadata, options);
  assert(input && Array.isArray(input.pages), "Imported design JSON must be a Figma nodes response or a raw artifact with pages");
  const diagnostics = { requestedNodeCount: 0, missingNodeIds: [], truncatedDepthNodes: 0, truncatedChildNodes: 0 };
  const pages = input.pages.map((page) => ({
    id: page.id,
    title: page.title || page.id,
    category: page.category || "imported",
    frames: (page.frames || []).map((frame) => ({
      nodeId: frame.nodeId,
      state: frame.state || "default",
      viewport: frame.viewport || null,
      children: (frame.children || []).map((node) => adaptNode(node, options, diagnostics)).filter(Boolean)
    }))
  }));
  return {
    ...input,
    schemaVersion: VERSION,
    kind: "figma_collected_artifact",
    meta: { ...(input.meta || {}), sourceMode: metadata.sourceMode, capturedAt: metadata.capturedAt || new Date().toISOString(), collector: { version: VERSION, canonicalUrl: metadata.canonicalUrl || null, nodeIds: metadata.nodeIds || [], queryFingerprint: metadata.queryFingerprint || null, endpoint: null, requestCount: 0 } },
    pages,
    collectorDiagnostics: diagnostics
  };
}

function httpJson(url, token) {
  return new Promise((resolve, reject) => {
    const request = https.request(url, { headers: { "X-Figma-Token": token, "User-Agent": "figma-frontend-agent-design-collector" } }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => {
        let parsed;
        try { parsed = body ? JSON.parse(body) : {}; } catch { return reject(new Error("Figma returned invalid JSON")); }
        if (response.statusCode < 200 || response.statusCode >= 300) {
          const retryAfter = response.headers["retry-after"];
          return reject(new Error(`Figma request failed (${response.statusCode}): ${parsed.err || parsed.message || "unknown error"}${retryAfter ? `; retry after ${retryAfter}s` : ""}`));
        }
        resolve({ body: parsed, headers: response.headers });
      });
    });
    request.on("error", reject);
    request.end();
  });
}

async function collectFromFigma(options) {
  const parsed = parseFigmaUrl(options.figmaUrl);
  const nodeIds = options.nodeIds && options.nodeIds.length ? options.nodeIds.map(normalizeNodeId) : parsed.nodeIds;
  assert(nodeIds.length, "Provide --node-ids or a Figma URL with node-id");
  assertContextOutput(options.outPath);
  const query = { fileKey: parsed.fileKey, nodeIds: [...new Set(nodeIds)].sort(), depth: options.depth, version: options.version || null };
  const queryFingerprint = hash(query);
  if (fs.existsSync(options.outPath) && !options.refresh) {
    const previous = readJson(options.outPath);
    if (previous.meta && previous.meta.collector && previous.meta.collector.queryFingerprint === queryFingerprint) return { artifact: previous, cacheHit: true, outPath: options.outPath };
  }
  const token = process.env[options.tokenEnv];
  assert(token, `Missing Figma access token in environment variable ${options.tokenEnv}`);
  const params = new URLSearchParams({ ids: query.nodeIds.join(","), depth: String(options.depth) });
  if (query.version) params.set("version", query.version);
  const endpoint = `https://api.figma.com/v1/files/${encodeURIComponent(query.fileKey)}/nodes?${params}`;
  const response = await httpJson(endpoint, token);
  const artifact = rawFromFigmaResponse(response.body, { sourceMode: "figma_rest", capturedAt: new Date().toISOString(), fileKey: query.fileKey, nodeIds: query.nodeIds, canonicalUrl: parsed.canonicalUrl, queryFingerprint, endpoint: "GET /v1/files/:key/nodes", requestCount: 1 }, options);
  artifact.meta.collector.rateLimit = { planTier: response.headers["x-figma-plan-tier"] || null, rateLimitType: response.headers["x-figma-rate-limit-type"] || null };
  writeJson(options.outPath, artifact);
  return { artifact, cacheHit: false, outPath: options.outPath };
}

function importDesign(options) {
  assertContextOutput(options.outPath);
  const input = readJson(options.inputPath);
  const parsed = options.figmaUrl ? parseFigmaUrl(options.figmaUrl) : { fileKey: null, nodeIds: [] };
  const metadata = { sourceMode: "imported_json", capturedAt: new Date().toISOString(), fileKey: parsed.fileKey || input.meta && input.meta.figmaFile && input.meta.figmaFile.fileKey || null, nodeIds: options.nodeIds && options.nodeIds.length ? options.nodeIds.map(normalizeNodeId) : parsed.nodeIds, canonicalUrl: parsed.canonicalUrl || null, queryFingerprint: hash({ input: hash(input), fileKey: parsed.fileKey, nodeIds: options.nodeIds || parsed.nodeIds }) };
  const artifact = rawFromExistingArtifact(input, metadata, options);
  writeJson(options.outPath, artifact);
  return { artifact, cacheHit: false, outPath: options.outPath };
}

module.exports = { CONTEXT_ROOT, VERSION, parseFigmaUrl, normalizeNodeId, rawFromFigmaResponse, rawFromExistingArtifact, collectFromFigma, importDesign };
