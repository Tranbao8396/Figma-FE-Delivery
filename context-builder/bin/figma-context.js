#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { buildContext, validateContext, approveContext } = require("../src/core");
const { prepareContext } = require("../src/prepare");
const { loadRootEnv } = require("../src/env");
const { importDesign, collectFromFigma } = require("../../design-collector/src/core");
const { normalizeFile } = require("../../normalizers/design-normalizer/src/core");

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? null : process.argv[index + 1];
}

function argumentsList(name) { const raw = argument(name); return raw ? raw.split(",").map((item) => item.trim()).filter(Boolean) : []; }
function number(name, fallback) { const raw = argument(name); return raw ? Number(raw) : fallback; }

function copyTemplate(output) {
  if (fs.existsSync(output)) throw new Error(`Refusing to overwrite existing intake: ${output}`);
  const template = path.join(__dirname, "..", "templates", "intake.template.json");
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.copyFileSync(template, output);
  return { intakePath: output };
}

async function main() {
  const command = process.argv[2];
  const target = argument(command === "init" ? "out" : ["build", "prepare"].includes(command) ? "intake" : ["import", "collect", "normalize"].includes(command) ? "out" : "context");
  const phase = argument("phase");
  if (!command || !target) throw new Error("Usage: figma-context <init|prepare|build|import|collect|normalize|validate|approve|status> --out|--intake|--context <path>");
  if (command === "init") return copyTemplate(path.resolve(target));
  if (command === "build") return buildContext(JSON.parse(fs.readFileSync(path.resolve(target), "utf8")));
  const tokenEnv = argument("token-env") || "FIGMA_ACCESS_TOKEN";
  if (command === "prepare") return prepareContext({
    intakePath: path.resolve(target),
    designJsonPath: argument("design-json"),
    figmaUrl: argument("figma-url"),
    outPath: argument("out"),
    resolvedIntakePath: argument("write-resolved-intake"),
    nodeIds: argumentsList("node-ids"),
    phase,
    depth: number("depth", 10),
    maxDepth: number("max-depth", 10),
    maxChildren: number("max-children", 100),
    refresh: process.argv.includes("--refresh"),
    allowFigmaRest: process.argv.includes("--allow-figma-rest"),
    tokenEnv,
    version: argument("version")
  });
  if (command === "import") {
    const input = argument("input");
    if (!input) throw new Error("import requires --input <figma-json>");
    return importDesign({ inputPath: path.resolve(input), outPath: path.resolve(target), figmaUrl: argument("figma-url"), nodeIds: argumentsList("node-ids"), maxDepth: number("max-depth", 10), maxChildren: number("max-children", 100) });
  }
  if (command === "collect") {
    const figmaUrl = argument("figma-url");
    if (!figmaUrl) throw new Error("collect requires --figma-url <url>");
    if (!process.argv.includes("--allow-figma-rest")) throw new Error("collect requires explicit --allow-figma-rest");
    loadRootEnv([tokenEnv]);
    return collectFromFigma({ figmaUrl, outPath: path.resolve(target), nodeIds: argumentsList("node-ids"), depth: number("depth", 10), maxDepth: number("max-depth", 10), maxChildren: number("max-children", 100), refresh: process.argv.includes("--refresh"), tokenEnv, version: argument("version") });
  }
  if (command === "normalize") {
    const input = argument("input");
    if (!input) throw new Error("normalize requires --input <collected-artifact>");
    return normalizeFile(path.resolve(input), path.resolve(target), { targetNodeId: argument("target-node-id") });
  }
  if (command === "validate") return validateContext(path.resolve(target), { phase });
  if (command === "approve") return approveContext(path.resolve(target));
  if (command === "status") return validateContext(path.resolve(target), { requireApproved: true, phase });
  throw new Error(`Unknown command: ${command}`);
}

main().then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => { console.error(error.message); process.exit(1); });
