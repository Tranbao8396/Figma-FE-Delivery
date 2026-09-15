#!/usr/bin/env node
const path = require("path");
const { normalizeFile } = require("../src/core");

function value(name) { const index = process.argv.indexOf(`--${name}`); return index === -1 ? null : process.argv[index + 1]; }

const input = value("input");
const out = value("out");
if (!input || !out) {
  console.error("Usage: figma-normalize --input <collected-artifact.json> --out <normalized-artifact.json> [--target-node-id <id>]");
  process.exit(1);
}

try {
  const result = normalizeFile(path.resolve(input), path.resolve(out), { targetNodeId: value("target-node-id") });
  console.log(JSON.stringify({ cacheHit: result.cacheHit, outPath: result.outPath, pages: result.artifact.pages.length, diagnostics: result.artifact.diagnostics }, null, 2));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
