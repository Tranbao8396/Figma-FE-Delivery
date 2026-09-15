const fs = require("fs");
const path = require("path");

const IGNORED_DIRECTORIES = new Set(["node_modules", ".git", "dist", "build", "coverage", ".next"]);

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
  return {
    kind: "collected_source_inventory",
    repository: path.resolve(root),
    files,
    fileFacts,
    packageJson: fs.existsSync(packagePath) ? JSON.parse(fs.readFileSync(packagePath, "utf8")) : {},
    packageManager: fs.existsSync(path.join(root, "pnpm-lock.yaml")) ? "pnpm" : fs.existsSync(path.join(root, "yarn.lock")) ? "yarn" : fs.existsSync(path.join(root, "package-lock.json")) ? "npm" : "unknown"
  };
}

module.exports = { collectSourceInventory };
