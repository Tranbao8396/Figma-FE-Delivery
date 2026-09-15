#!/usr/bin/env node
const path = require("path");
const { collectFromFigma, importDesign } = require("../src/core");

function value(name) { const index = process.argv.indexOf(`--${name}`); return index === -1 ? null : process.argv[index + 1]; }
function values(name) { const raw = value(name); return raw ? raw.split(",").map((item) => item.trim()).filter(Boolean) : []; }
function number(name, fallback) { const raw = value(name); return raw ? Number(raw) : fallback; }

async function main() {
  const command = process.argv[2];
  const out = value("out");
  if (!out || !["collect", "import"].includes(command)) throw new Error("Usage: figma-design <collect|import> --out <collected-artifact.json> [options]");
  const options = { outPath: path.resolve(out), figmaUrl: value("figma-url"), nodeIds: values("node-ids"), depth: number("depth", 10), maxDepth: number("max-depth", 10), maxChildren: number("max-children", 100), refresh: process.argv.includes("--refresh"), tokenEnv: value("token-env") || "FIGMA_ACCESS_TOKEN", version: value("version") };
  if (!Number.isInteger(options.depth) || options.depth < 1) throw new Error("--depth must be a positive integer");
  if (!Number.isInteger(options.maxDepth) || options.maxDepth < 1) throw new Error("--max-depth must be a positive integer");
  if (!Number.isInteger(options.maxChildren) || options.maxChildren < 1) throw new Error("--max-children must be a positive integer");
  if (command === "collect") {
    if (!options.figmaUrl) throw new Error("collect requires --figma-url");
    return collectFromFigma(options);
  }
  const input = value("input");
  if (!input) throw new Error("import requires --input");
  return importDesign({ ...options, inputPath: path.resolve(input) });
}

main().then((result) => console.log(JSON.stringify({ cacheHit: result.cacheHit, outPath: result.outPath, sourceMode: result.artifact.meta.sourceMode, pages: result.artifact.pages.length, diagnostics: result.artifact.collectorDiagnostics }, null, 2))).catch((error) => { console.error(error.message); process.exit(1); });
