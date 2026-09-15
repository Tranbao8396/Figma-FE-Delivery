const test = require("node:test");
const assert = require("assert/strict");
const { buildProjectContextIndex } = require("../src/hook");

function currentDocument(kind, fingerprint) {
  return { kind, schemaVersion: "1.0.0", provenance: { inputFingerprint: fingerprint, status: "current" } };
}

function input() {
  return {
    project: { key: "demo", sourceRepository: "D:/customer/demo" },
    artifacts: [
      { id: "source", kind: "source_context", path: "source/source.json", phases: ["analysis", "implementation"] },
      { id: "rules", kind: "rules_context", path: "rules/rules.json", phases: ["analysis", "review"] },
      { id: "layout", kind: "figma_layout_context", path: "figma/layout.json", phases: ["analysis", "implementation", "qc"] },
      { id: "evidence", kind: "evidence_links", path: "evidence/links.json", phases: ["review", "qc"] }
    ]
  };
}

test("creates a small phase index without embedding child documents", () => {
  const documents = {
    source: currentDocument("source_context", "source-fp"),
    rules: currentDocument("rules_context", "rules-fp"),
    layout: currentDocument("figma_layout_context", "layout-fp"),
    evidence: currentDocument("evidence_links", "evidence-fp")
  };
  const result = buildProjectContextIndex(input(), { artifactDocuments: documents });
  assert.equal(result.context.status, "ready");
  assert.equal(result.context.phases.analysis.ready, true);
  assert.deepEqual(result.context.phases.qc.artifactIds, ["layout", "evidence"]);
  assert.equal(JSON.stringify(result.context).includes("source-fp"), true);
  assert.equal(JSON.stringify(result.context).includes("sourceRepository"), true);
  assert.equal(JSON.stringify(result.context).includes("inputFingerprint\":\"source-fp"), false);
  assert.equal(buildProjectContextIndex(input(), { artifactDocuments: documents, previousContext: result.context }).cacheHit, true);
});

test("blocks only the phase that depends on a missing or invalid artifact", () => {
  const result = buildProjectContextIndex(input(), {
    artifactDocuments: {
      source: currentDocument("source_context", "source-fp"),
      rules: currentDocument("wrong_kind", "rules-fp"),
      layout: currentDocument("figma_layout_context", "layout-fp")
    }
  });
  assert.equal(result.context.status, "attention_required");
  assert.equal(result.context.phases.analysis.ready, false);
  assert.equal(result.context.phases.implementation.ready, true);
  assert.deepEqual(result.context.phases.review.blockedBy, ["rules", "evidence"]);
});
