const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
process.env.FIGMA_CONTEXT_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "figma-collector-store-"));
const crypto = require("crypto");
const { parseFigmaUrl, rawFromFigmaResponse, importDesign, collectFromFigma } = require("../src/core");

test("parses a Figma URL and normalizes node-id", () => {
  const result = parseFigmaUrl("https://www.figma.com/design/file-key-123/Checkout?node-id=12-34");
  assert.equal(result.fileKey, "file-key-123");
  assert.deepEqual(result.nodeIds, ["12:34"]);
});

test("adapts only requested Figma nodes into a bounded collected artifact", () => {
  const response = { lastModified: "2026-01-01T00:00:00Z", nodes: { "1:2": { document: { id: "1:2", name: "Checkout", type: "FRAME", absoluteBoundingBox: { width: 1440, height: 900 }, pluginData: { ignored: true }, children: [{ id: "1:3", name: "Pay", type: "TEXT", characters: "Pay now", children: [] }] } }, "9:9": null } };
  const artifact = rawFromFigmaResponse(response, { sourceMode: "figma_rest", fileKey: "file", nodeIds: ["1:2", "9:9"], requestCount: 1 }, { maxDepth: 4, maxChildren: 10 });
  assert.equal(artifact.pages.length, 1);
  assert.equal(artifact.pages[0].frames[0].viewport, "1440x900");
  assert.equal(artifact.pages[0].frames[0].children[0].pluginData, undefined);
  assert.deepEqual(artifact.collectorDiagnostics.missingNodeIds, ["9:9"]);
  assert.equal(artifact.kind, "figma_collected_artifact");
});

test("keeps vector identity but removes vector paths in the transport-safe projection", () => {
  const artifact = rawFromFigmaResponse({ nodes: { "5:6": { document: { id: "5:6", name: "Export", type: "VECTOR", absoluteBoundingBox: { width: 16, height: 16 }, vectorPaths: [{ data: "discarded" }] } } } }, { sourceMode: "figma_rest", fileKey: "file", nodeIds: ["5:6"], requestCount: 1 }, { maxDepth: 4, maxChildren: 10 });
  assert.equal(artifact.pages[0].frames[0].children[0].vectorPaths, undefined);
  assert.equal(artifact.pages[0].frames[0].children[0].type, "VECTOR");
});

test("imports local JSON without requiring a token", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "figma-collector-input-"));
  const input = path.join(root, "input.json");
  const out = path.join(process.env.FIGMA_CONTEXT_ROOT, "projects", "test", "figma", "raw.json");
  fs.writeFileSync(input, JSON.stringify({ nodes: { "3:4": { document: { id: "3:4", name: "Card", type: "FRAME", absoluteBoundingBox: { width: 320, height: 200 } } } } }));
  const result = importDesign({ inputPath: input, outPath: out, nodeIds: ["3:4"], maxDepth: 4, maxChildren: 10 });
  assert.equal(result.artifact.meta.sourceMode, "imported_json");
  assert.equal(result.artifact.pages[0].id, "3:4");
});

test("uses a matching REST cache before requiring a token or network", async () => {
  const out = path.join(process.env.FIGMA_CONTEXT_ROOT, "projects", "cache-test", "figma", "raw.json");
  const query = { fileKey: "cache-file", nodeIds: ["1:2"], depth: 10, version: null };
  const queryFingerprint = crypto.createHash("sha256").update(JSON.stringify(query)).digest("hex");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({ meta: { collector: { queryFingerprint } }, pages: [] }));
  const result = await collectFromFigma({ figmaUrl: "https://www.figma.com/design/cache-file/Cache?node-id=1-2", nodeIds: [], depth: 10, outPath: out, refresh: false, tokenEnv: "TOKEN_THAT_DOES_NOT_EXIST" });
  assert.equal(result.cacheHit, true);
});
