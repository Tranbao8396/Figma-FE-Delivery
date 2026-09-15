const fs = require("fs");
const path = require("path");
const { buildProjectContextIndex } = require("./hook");

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 2) parsed[args[index].replace(/^--/, "")] = args[index + 1];
  return parsed;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function resolveArtifact(root, relativePath) {
  const target = path.resolve(root, relativePath);
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`Artifact path escapes context root: ${relativePath}`);
  return target;
}

const args = parseArgs(process.argv.slice(2));
if (!args.input || !args.out) throw new Error("Usage: --input <context-index-input.json> --out <project-context-index.json> [--context-root <directory>]");
const inputPath = path.resolve(args.input);
const outputPath = path.resolve(args.out);
const input = readJson(inputPath);
const contextRoot = args["context-root"] ? path.resolve(args["context-root"]) : path.dirname(inputPath);
const artifactDocuments = {};
for (const artifact of input.artifacts || []) {
  const filePath = resolveArtifact(contextRoot, artifact.path);
  if (fs.existsSync(filePath)) artifactDocuments[artifact.id] = readJson(filePath);
}
const previousContext = fs.existsSync(outputPath) ? readJson(outputPath) : null;
const result = buildProjectContextIndex(input, { artifactDocuments, previousContext });
if (!result.cacheHit) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(result.context), "utf8");
}
console.log(JSON.stringify({ cacheHit: result.cacheHit, outPath: outputPath, status: result.context.status, issues: result.context.diagnostics.issues }, null, 2));
