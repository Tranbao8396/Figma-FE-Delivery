const FOUNDATION_MANIFEST_VERSION = "1.0.0";

function createFoundationManifest() {
  return {
    schemaVersion: FOUNDATION_MANIFEST_VERSION,
    kind: "foundation_manifest",
    status: "pending",
    mode: null,
    viewport_mode: null,
    sourceFingerprint: null,
    sourceState: null,
    scaffoldOwner: null,
    foundationContextPath: null,
    foundationContextHash: null,
    stack: { requested: null, verified: null },
    tree_contract: { required: [], optional: [], generated: [], missing: [] },
    dependency_graph: [],
    foundation_scope: { delivered: [], deferred: [] },
    files: [],
    evidence: { commands: [], viewport: null, screenshot: null },
    handoff: { allowed_next_slice: null, blockers: [] },
    notes: []
  };
}

function normalizeCommand(command) {
  if (!command || typeof command !== "object") return null;
  const statusMap = { passed: "pass", success: "pass", failed: "fail", failure: "fail" };
  const status = statusMap[command.status] || command.status || "not_run";
  return {
    command: command.command || command.name || null,
    status,
    summary: command.summary || command.result || null
  };
}

function normalizeFiles(files) {
  if (!Array.isArray(files)) return [];
  return files.map((file) => {
    if (typeof file === "string") return { path: file, purpose: null };
    if (!file || typeof file !== "object") return null;
    return { path: file.path || null, purpose: file.purpose || null };
  }).filter((file) => file && file.path);
}

// Converts only known pre-1.0 aliases. The returned shape is always canonical.
function normalizeFoundationManifest(input) {
  const source = input && typeof input === "object" ? input : {};
  const base = createFoundationManifest();
  const hasCanonicalFiles = Array.isArray(source.files) && source.files.length > 0;
  const hasCanonicalCommands = Array.isArray(source.evidence && source.evidence.commands) && source.evidence.commands.length > 0;
  const legacyFiles = !hasCanonicalFiles && Array.isArray(source.filesChanged);
  const rawCommands = hasCanonicalCommands
    ? source.evidence.commands
    : (Array.isArray(source.commands) ? source.commands : []);
  const legacyCommands = !hasCanonicalCommands && Array.isArray(source.commands);
  const legacyScreenshot = !source.evidence?.screenshot && source.evidence?.screenshotPath;
  const legacyScope = !source.foundation_scope && Array.isArray(source.delivered);
  const legacyHandoff = source.handoff && source.handoff.allowedNextSlice && !source.handoff.allowed_next_slice;
  const evidence = source.evidence && typeof source.evidence === "object" ? source.evidence : {};
  const handoff = source.handoff && typeof source.handoff === "object" ? source.handoff : {};
  const foundationScope = source.foundation_scope && typeof source.foundation_scope === "object" ? source.foundation_scope : {};

  return {
    manifest: {
      ...base,
      schemaVersion: FOUNDATION_MANIFEST_VERSION,
      kind: source.kind || base.kind,
      status: source.status || base.status,
      mode: source.mode || null,
      viewport_mode: source.viewport_mode || null,
      sourceFingerprint: source.sourceFingerprint || null,
      sourceState: source.sourceState || null,
      scaffoldOwner: source.scaffoldOwner || null,
      foundationContextPath: source.foundationContextPath || null,
      foundationContextHash: source.foundationContextHash || null,
      stack: { ...base.stack, ...(source.stack || {}) },
      tree_contract: { ...base.tree_contract, ...(source.tree_contract || {}) },
      dependency_graph: Array.isArray(source.dependency_graph) ? source.dependency_graph : [],
      foundation_scope: {
        ...base.foundation_scope,
        ...foundationScope,
        delivered: Array.isArray(foundationScope.delivered) ? foundationScope.delivered : (Array.isArray(source.delivered) ? source.delivered : []),
        deferred: Array.isArray(foundationScope.deferred) ? foundationScope.deferred : []
      },
      files: normalizeFiles(hasCanonicalFiles ? source.files : source.filesChanged),
      evidence: {
        ...base.evidence,
        viewport: evidence.viewport || null,
        screenshot: evidence.screenshot || evidence.screenshotPath || null,
        commands: rawCommands.map(normalizeCommand).filter(Boolean)
      },
      handoff: {
        ...base.handoff,
        blockers: Array.isArray(handoff.blockers) ? handoff.blockers : [],
        allowed_next_slice: handoff.allowed_next_slice || handoff.allowedNextSlice || null
      },
      notes: Array.isArray(source.notes) ? source.notes : [],
      ...(source.finalizedAt ? { finalizedAt: source.finalizedAt } : {}),
      ...(source.finalizedBy ? { finalizedBy: source.finalizedBy } : {}),
      ...(source.toolVersion ? { toolVersion: source.toolVersion } : {}),
      ...(source.provenanceMigrated ? { provenanceMigrated: true } : {})
    },
    migrated: source.schemaVersion !== FOUNDATION_MANIFEST_VERSION || legacyFiles || legacyCommands || legacyScreenshot || legacyScope || legacyHandoff
  };
}

module.exports = { FOUNDATION_MANIFEST_VERSION, createFoundationManifest, normalizeFoundationManifest };
