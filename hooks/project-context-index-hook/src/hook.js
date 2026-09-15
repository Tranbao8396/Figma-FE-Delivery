const crypto = require("crypto");

const VERSION = "1.0.0";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function stableSerialize(value) {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function fingerprint(value) {
  return crypto.createHash("sha256").update(stableSerialize(value)).digest("hex");
}

function artifactIdentity(document) {
  if (!document || typeof document !== "object") return null;
  return {
    kind: document.kind || null,
    schemaVersion: document.schemaVersion || null,
    status: document.provenance && document.provenance.status || null,
    fingerprint: document.provenance && (document.provenance.inputFingerprint || document.provenance.rawFingerprint) || null
  };
}

function normalizeArtifact(artifact, documents) {
  const document = documents[artifact.id];
  const identity = artifactIdentity(document);
  let status = "current";
  let reason = null;
  if (!document) {
    status = "missing";
    reason = "artifact_file_not_available";
  } else if (artifact.kind && document.kind !== artifact.kind) {
    status = "invalid";
    reason = "artifact_kind_mismatch";
  } else if (identity.status && identity.status !== "current") {
    status = "stale";
    reason = "artifact_provenance_not_current";
  }
  return {
    id: artifact.id,
    kind: artifact.kind || identity && identity.kind || "unknown",
    path: artifact.path,
    phases: [...new Set(artifact.phases || [])],
    required: artifact.required !== false,
    status,
    reason,
    fingerprint: identity && identity.fingerprint,
    schemaVersion: identity && identity.schemaVersion
  };
}

function buildProjectContextIndex(input, options = {}) {
  assert(input && typeof input === "object", "Context index input must be an object");
  assert(input.project && typeof input.project.key === "string" && input.project.key.trim(), "project.key is required");
  assert(Array.isArray(input.artifacts), "artifacts must be an array");
  const artifactIds = new Set();
  for (const artifact of input.artifacts) {
    assert(artifact && typeof artifact.id === "string" && artifact.id, "Each artifact requires id");
    assert(!artifactIds.has(artifact.id), `Duplicate artifact id: ${artifact.id}`);
    assert(typeof artifact.path === "string" && artifact.path && !artifact.path.startsWith("/"), `Artifact ${artifact.id} requires a relative path`);
    artifactIds.add(artifact.id);
  }

  const documents = options.artifactDocuments || {};
  const documentIdentities = Object.fromEntries(input.artifacts.map((artifact) => [artifact.id, artifactIdentity(documents[artifact.id])]));
  const inputFingerprint = fingerprint({ input, documentIdentities, version: VERSION });
  if (options.previousContext && options.previousContext.provenance && options.previousContext.provenance.inputFingerprint === inputFingerprint) {
    return { context: options.previousContext, cacheHit: true };
  }

  const artifacts = input.artifacts.map((artifact) => normalizeArtifact(artifact, documents));
  const phases = [...new Set(artifacts.flatMap((artifact) => artifact.phases))];
  const phaseIndex = Object.fromEntries(phases.map((phase) => {
    const requiredArtifacts = artifacts.filter((artifact) => artifact.phases.includes(phase) && artifact.required);
    const blockedBy = requiredArtifacts.filter((artifact) => artifact.status !== "current").map((artifact) => artifact.id);
    return [phase, {
      artifactIds: artifacts.filter((artifact) => artifact.phases.includes(phase)).map((artifact) => artifact.id),
      ready: blockedBy.length === 0,
      blockedBy
    }];
  }));
  const issues = artifacts.filter((artifact) => artifact.status !== "current").map((artifact) => ({ id: artifact.id, status: artifact.status, reason: artifact.reason }));
  const context = {
    schemaVersion: VERSION,
    kind: "project_context_index",
    provenance: { inputFingerprint, status: "current" },
    project: { key: input.project.key, sourceRepository: input.project.sourceRepository || null },
    artifacts,
    phases: phaseIndex,
    retrieval: {
      loadOrder: ["project_context_index", "phase_artifacts_only"],
      artifactById: Object.fromEntries(artifacts.map((artifact, index) => [artifact.id, `artifacts.${index}`]))
    },
    diagnostics: { artifactCount: artifacts.length, issueCount: issues.length, issues },
    status: issues.length ? "attention_required" : "ready"
  };
  return { context, cacheHit: false };
}

module.exports = { VERSION, buildProjectContextIndex, fingerprint };
