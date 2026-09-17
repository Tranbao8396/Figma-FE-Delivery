const fs = require("fs");
const path = require("path");

// Runtime reports belong in the task context and must not invalidate source baselines.
const IGNORED_DIRECTORIES = new Set(["node_modules", ".git", "dist", "build", "coverage", ".next", "reports"]);
const WORKSPACE_ONLY_FILES = new Set([".gitignore", "readme.md", "license", "license.md", ".editorconfig"]);

function classifySourceState(files, packageJson) {
  if (files.length === 0) return "empty_directory";
  const normalized = files.map((file) => file.toLowerCase());
  const meaningful = normalized.filter((file) => !WORKSPACE_ONLY_FILES.has(file));
  if (meaningful.length === 0) return "workspace_only";
  const hasPackage = Boolean(packageJson && Object.keys(packageJson).length);
  const hasEntry = normalized.some((file) => /(^|\/)(index\.html?|src\/(main|index|app)\.[cm]?[jt]sx?)$/.test(file));
  const hasSourceDirectory = normalized.some((file) => file.startsWith("src/"));
  const hasConfig = normalized.some((file) => /(^|\/)(vite|next|webpack|tsconfig|angular|svelte)\.config|package\.json$/.test(file));
  if (hasEntry && (hasPackage || hasSourceDirectory || normalized.includes("index.html"))) return "existing_project";
  if (hasPackage || hasSourceDirectory || hasConfig) return "partial_scaffold";
  return "workspace_only";
}

// Reads filesystem facts only. Framework/convention inference belongs to Source Context Compiler.
function collectSourceInventory(root) {
  const files = [];
  const fileFacts = [];
  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) {
        const relative = path.relative(root, full).replace(/\\/g, "/");
        const stat = fs.statSync(full);
        files.push(relative);
        fileFacts.push({ path: relative, size: stat.size, modifiedMs: Math.trunc(stat.mtimeMs) });
      }
    }
  }
  walk(root);
  const packagePath = path.join(root, "package.json");
  const packageJson = fs.existsSync(packagePath) ? JSON.parse(fs.readFileSync(packagePath, "utf8")) : {};
  return {
    kind: "collected_source_inventory",
    repository: path.resolve(root),
    files,
    fileFacts,
    sourceState: classifySourceState(files, packageJson),
    packageJson,
    packageManager: fs.existsSync(path.join(root, "pnpm-lock.yaml")) ? "pnpm" : fs.existsSync(path.join(root, "yarn.lock")) ? "yarn" : fs.existsSync(path.join(root, "package-lock.json")) ? "npm" : "unknown"
  };
}

module.exports = { collectSourceInventory, classifySourceState };
