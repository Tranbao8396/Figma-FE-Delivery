const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

function assert(condition, message) { if (!condition) throw new Error(message); }
function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, "utf8")); }
function writeJson(filePath, document) { fs.mkdirSync(path.dirname(filePath), { recursive: true }); fs.writeFileSync(filePath, `${JSON.stringify(document, null, 2)}\n`, "utf8"); }
function hashFile(filePath) { return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex"); }
function stable(value) { return Array.isArray(value) ? `[${value.map(stable).join(",")}]` : value && typeof value === "object" ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}` : JSON.stringify(value); }
function hash(value) { return crypto.createHash("sha256").update(stable(value)).digest("hex"); }

function reportPaths(contextPath) {
  const root = path.join(path.dirname(path.resolve(contextPath)), "reports", "review");
  return { root, manifestPath: path.join(root, "change-manifest.json"), reportPath: path.join(root, "review-report.json") };
}

function sourceRoot(context) {
  assert(context.projectRef && context.projectRef.path && fs.existsSync(context.projectRef.path), "Review requires a current project context");
  const project = readJson(context.projectRef.path);
  const root = project.project && project.project.sourcePath;
  assert(root && fs.existsSync(root), "Review requires an existing source root");
  return path.resolve(root);
}

function safeProjectPath(root, relativePath) {
  assert(typeof relativePath === "string" && relativePath.trim(), "Review file paths must be non-empty strings");
  const candidate = path.resolve(root, relativePath);
  const relation = path.relative(root, candidate);
  assert(relation && !relation.startsWith("..") && !path.isAbsolute(relation), `Review file escapes source root: ${relativePath}`);
  return candidate;
}

function contractFiles(context) {
  const plan = context.implementationContract && context.implementationContract.filePlan;
  assert(plan, "Review requires an implementation file plan");
  const byRole = [["primary", plan.primary || []], ["create", plan.create || []], ["modify", plan.modify || []], ["forbid", plan.forbid || []]];
  const records = new Map();
  for (const [role, files] of byRole) for (const file of files) {
    if (!records.has(file)) records.set(file, { path: file, roles: [] });
    records.get(file).roles.push(role);
  }
  return [...records.values()].sort((left, right) => left.path.localeCompare(right.path));
}

function buildChangeManifest(contextPath, options = {}) {
  const { validateContext } = require("./core");
  const validation = validateContext(contextPath, { requireApproved: true, phase: "review", allowSourceDrift: true });
  assert(validation.valid, `Review input requires approved, current review context: ${validation.errors.join(", ")}`);
  const resolved = options.amendmentPath ? require("./amendment").resolveEffectiveContext(contextPath, options.amendmentPath, "review") : null;
  const context = resolved ? resolved.context : validation.context;
  const root = sourceRoot(context);
  const paths = reportPaths(contextPath);
  const previous = fs.existsSync(paths.manifestPath) ? readJson(paths.manifestPath) : null;
  const declaredChanges = new Set((options.changedFiles || []).map((file) => String(file).replace(/\\/g, "/")));
  const files = contractFiles(context).map((record) => {
    const filePath = safeProjectPath(root, record.path);
    const exists = fs.existsSync(filePath) && fs.statSync(filePath).isFile();
    const previousFile = previous && (previous.files || []).find((item) => item.path === record.path);
    const sha256 = exists ? hashFile(filePath) : null;
    const state = !exists ? "missing" : !previousFile ? "observed" : previousFile.sha256 === sha256 ? "unchanged" : "changed";
    return { ...record, exists, sha256, bytes: exists ? fs.statSync(filePath).size : null, state, declaredChanged: declaredChanges.has(record.path) };
  });
  const missingRequired = files.filter((file) => file.roles.some((role) => ["primary", "create"].includes(role)) && !file.exists).map((file) => file.path);
  const forbiddenPresent = files.filter((file) => file.roles.includes("forbid") && file.exists).map((file) => file.path);
  const undeclaredChanges = [...declaredChanges].filter((file) => !files.some((item) => item.path === file));
  const findings = [
    ...missingRequired.map((file) => ({ severity: "high", code: "required_file_missing", path: file })),
    ...forbiddenPresent.map((file) => ({ severity: "high", code: "forbidden_file_present", path: file })),
    ...undeclaredChanges.map((file) => ({ severity: "medium", code: "changed_file_outside_contract", path: file }))
  ];
  const manifest = {
    schemaVersion: "1.0.0",
    kind: "review_change_manifest",
    status: "current",
    taskId: context.task.id,
    contextRef: { path: path.resolve(contextPath), status: context.status },
    amendmentRefs: context.amendmentRefs || [],
    sourceFingerprint: context.projectRef.sourceFingerprint,
    files,
    declaredChanges: [...declaredChanges].sort(),
    findings,
    verdict: findings.length ? "findings_required" : "evidence_ready_only",
    provenance: { inputFingerprint: hash({ sourceFingerprint: context.projectRef.sourceFingerprint, files, declaredChanges: [...declaredChanges].sort() }), generatedAt: new Date().toISOString() }
  };
  writeJson(paths.manifestPath, manifest);
  return { manifestPath: paths.manifestPath, findingCount: findings.length, verdict: manifest.verdict };
}

module.exports = { reportPaths, buildChangeManifest };
