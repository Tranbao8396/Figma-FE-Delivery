const crypto = require("crypto");
const VERSION = "1.3.0";
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const stable = (value) => Array.isArray(value) ? `[${value.map(stable).join(",")}]` : value && typeof value === "object" ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}` : JSON.stringify(value);
const hash = (value) => crypto.createHash("sha256").update(stable(value)).digest("hex");

function detectFramework(pkg = {}) {
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  if (deps.next) return "nextjs";
  if (deps["@angular/core"]) return "angular";
  if (deps.vue) return "vue";
  if (deps.react) return "react";
  if (deps.svelte) return "svelte";
  return "html-css-js";
}

function buildSourceContext(inventory, options = {}) {
  assert(inventory && typeof inventory === "object", "Source inventory must be an object");
  const fingerprint = hash({ inventory, version: VERSION });
  if (options.previousContext && options.previousContext.provenance && options.previousContext.provenance.inputFingerprint === fingerprint) return { context: options.previousContext, cacheHit: true };
  const files = [...new Set((inventory.files || []).filter((file) => typeof file === "string"))].sort();
  const pkg = inventory.packageJson || {};
  const has = (pattern) => files.some((file) => pattern.test(file));
  const styling = has(/\.scss$/i) ? "scss" : has(/\.module\.css$|\.css$/i) ? "css" : "unknown";
  const testing = has(/(test|spec)\.[cm]?[jt]sx?$/i) ? "present" : "not_detected";
  const htmlPages = files.filter((file) => /(^|\/)[^/]+\.html?$/i.test(file)).slice(0, 48);
  const htmlEntries = htmlPages.filter((file) => /(^|\/)index\.html?$/i.test(file));
  const routing = detectFramework(pkg) === "html-css-js"
    ? htmlPages.length > 1 ? "static_multi_document" : htmlPages.length === 1 ? "static_single_document" : "not_detected"
    : has(/(^|\/)(routes|pages|app)\//i) ? "framework_file_routing_candidate" : "not_detected";
  const context = {
    schemaVersion: VERSION,
    kind: "source_context",
    provenance: { repository: options.repository || null, inputFingerprint: fingerprint, status: "current" },
    sourceState: inventory.sourceState || "unknown",
    runtime: { framework: detectFramework(pkg), packageManager: inventory.packageManager || "unknown", scripts: pkg.scripts || {} },
    topology: {
      entryCandidates: files.filter((file) => /(^|\/)(src\/)?(main|index|app)\.[cm]?[jt]sx?$/i.test(file)).slice(0, 12),
      htmlEntryCandidates: htmlEntries.slice(0, 12),
      pageCandidates: htmlPages,
      routing,
      configCandidates: files.filter((file) => /(^|\/)(package\.json|vite\.config|next\.config|webpack\.config|tsconfig|eslint|prettier)/i.test(file)).slice(0, 16)
    },
    conventions: { styling, testing, linting: has(/eslint|\.eslintrc/i) ? "present" : "not_detected", componentLayout: has(/(^|\/)components\//i) ? "components_directory" : "not_detected" },
    retrieval: { sections: ["runtime", "topology", "conventions"] },
    diagnostics: { indexedFileCount: files.length, excludedContent: true }
  };
  return { context, cacheHit: false };
}
module.exports = { VERSION, buildSourceContext, detectFramework };
