#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { buildLayoutContext } = require("./hook");

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key || !key.startsWith("--") || !value) {
      throw new Error("Usage: node src/cli.js --raw <raw.json> --intake <intake.json> --out <layout-context.json>");
    }
    parsed[key.slice(2)] = value;
  }
  return parsed;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8"));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.raw || !args.intake || !args.out) {
    throw new Error("Arguments --raw, --intake and --out are required");
  }

  const outPath = path.resolve(args.out);
  const previousContext = fs.existsSync(outPath) ? readJson(outPath) : null;
  const result = buildLayoutContext(readJson(args.raw), readJson(args.intake), {
    previousContext,
    rawArtifact: path.resolve(args.raw)
  });

  if (!result.cacheHit) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(result.context), "utf8");
  }

  console.log(JSON.stringify({
    cacheHit: result.cacheHit,
    outPath,
    inputBytes: result.report.inputBytes,
    outputBytes: result.report.outputBytes,
    reductionPercent: result.report.reductionPercent,
    optimizationStatus: result.report.optimizationStatus,
    suppressedByReason: result.report.suppressedByReason
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
