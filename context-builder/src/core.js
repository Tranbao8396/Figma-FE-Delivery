const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const { buildSourceContext } = require("../../hooks/source-context-hook/src/hook");
const { buildRulesContext } = require("../../hooks/rules-context-hook/src/hook");
const { buildDesignIndex } = require("../../hooks/design-index-hook/src/hook");
const { buildLayoutContext } = require("../../hooks/figma-layout-context-hook/src/hook");
const { buildProjectContextIndex } = require("../../hooks/project-context-index-hook/src/hook");
const { normalizeFile } = require("../../normalizers/design-normalizer/src/core");
const { collectSourceInventory } = require("../../collectors/source-adapter/src/core");
const { collectRulesInput } = require("../../collectors/rules-adapter/src/core");

const VERSION = "1.1.0";
const CONTEXT_ROOT = process.env.FIGMA_CONTEXT_ROOT || "D:\\agents\\figma-frontend-agent\\contexts";
const PHASES = ["analysis", "foundation", "implementation", "review", "qc"];
const SECRET_KEY = /^(?:password|secret|token|cookie|authorization|personalAccessToken|figmaPat)$/i;

function stableSerialize(value) {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function fingerprint(value) {
  return crypto.createHash("sha256").update(stableSerialize(value)).digest("hex");
}

function documentHash(document) {
  return crypto.createHash("sha256").update(JSON.stringify(document)).digest("hex");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, document) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
}

function normalizeKey(value, field) {
  assert(typeof value === "string" && /^[a-z0-9][a-z0-9-]*$/i.test(value), `${field} must contain letters, digits, or hyphens only`);
  return value;
}

function isWithin(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function assertWithinContextRoot(candidate) {
  assert(isWithin(CONTEXT_ROOT, candidate), `Path must stay under ${CONTEXT_ROOT}: ${candidate}`);
}

function profilePath(intake) {
  const customer = normalizeKey(intake.profile.customer, "profile.customer");
  const name = normalizeKey(intake.profile.name, "profile.name");
  return path.join(CONTEXT_ROOT, "profiles", customer, `${name}.json`);
}

function projectDirectory(intake) {
  return path.join(CONTEXT_ROOT, "projects", normalizeKey(intake.project.key, "project.key"));
}

function taskDirectory(intake) {
  return path.join(CONTEXT_ROOT, "tasks", normalizeKey(intake.project.key, "project.key"), normalizeKey(intake.task.id, "task.id"));
}

function requireIntake(intake) {
  assert(intake && typeof intake === "object", "Intake must be a JSON object");
  assert(intake.project && intake.task && intake.profile, "Intake requires project, task, and profile");
  normalizeKey(intake.project.key, "project.key");
  normalizeKey(intake.task.id, "task.id");
  normalizeKey(intake.profile.customer, "profile.customer");
  normalizeKey(intake.profile.name, "profile.name");
  assert(typeof intake.project.sourcePath === "string" && intake.project.sourcePath, "project.sourcePath is required");
  assert(fs.existsSync(intake.project.sourcePath), `Source path does not exist: ${intake.project.sourcePath}`);
  const requestedPhase = intake.task.requestedPhase || "analysis";
  assert(PHASES.includes(requestedPhase), `task.requestedPhase must be one of: ${PHASES.join(", ")}`);
  if (intake.task.allowedPhases !== undefined) {
    assert(Array.isArray(intake.task.allowedPhases) && intake.task.allowedPhases.length, "task.allowedPhases must be a non-empty array");
    for (const phase of intake.task.allowedPhases) assert(PHASES.includes(phase), `task.allowedPhases contains an unsupported phase: ${phase}`);
  }
}

function visualReadiness(intake, normalizedDesign) {
  const target = intake.design && intake.design.targetFrame || null;
  const viewport = intake.viewportContract || null;
  const references = (intake.design && intake.design.referenceImages || []).map((item) => ({ path: item && item.path || null, role: item && item.role || "unknown", measurementAuthority: item && item.measurementAuthority || "unknown", available: Boolean(item && item.path && fs.existsSync(item.path)) }));
  const targetFrameConfirmed = Boolean(target && target.nodeId && normalizedDesign && Array.isArray(normalizedDesign.pages) && normalizedDesign.pages.some((page) => page.id === target.nodeId));
  const viewportContractConfirmed = Boolean(viewport && viewport.referenceViewport && Number.isFinite(viewport.referenceViewport.width) && Number.isFinite(viewport.referenceViewport.height) && ["pc_only", "responsive"].includes(viewport.deviceScope) && ["min_width", "fixed_canvas", "fluid", "max_width"].includes(viewport.layoutBehavior) && (viewport.layoutBehavior !== "min_width" || Number.isFinite(viewport.minWidth)));
  return { targetFrame: target ? { nodeId: target.nodeId || null, name: target.name || null, presentInRawArtifact: targetFrameConfirmed } : null, viewportContract: viewport, referenceImages: references, readiness: { targetFrameConfirmed, viewportContractConfirmed, visualReferenceConfirmed: references.some((item) => item.role === "visual_comparison" && item.available) } };
}

function hasSecret(value, trail = "") {
  if (Array.isArray(value)) return value.flatMap((item, index) => hasSecret(item, `${trail}[${index}]`));
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, item]) => {
    const next = trail ? `${trail}.${key}` : key;
    return SECRET_KEY.test(key) ? [next] : hasSecret(item, next);
  });
}

function cacheDocument(outputPath, build) {
  const previous = fs.existsSync(outputPath) ? readJson(outputPath) : null;
  const result = build(previous);
  if (!result.cacheHit) writeJson(outputPath, result.context);
  return { path: outputPath, context: result.context, cacheHit: result.cacheHit };
}

function buildContext(intake) {
  requireIntake(intake);
  const profileOutput = profilePath(intake);
  const projectRoot = projectDirectory(intake);
  const taskRoot = taskDirectory(intake);
  [profileOutput, projectRoot, taskRoot].forEach(assertWithinContextRoot);

  const profilePayload = {
    schemaVersion: VERSION,
    kind: "profile_context",
    id: `${intake.profile.customer}/${intake.profile.name}`,
    version: String(intake.profile.version || "1"),
    framework: intake.profile.framework || null,
    codingRules: intake.profile.codingRules || [],
    lintRules: intake.profile.lintRules || [],
    formatRules: intake.profile.formatRules || [],
    reportFormat: intake.profile.reportFormat || null
  };
  const profileFingerprint = fingerprint(profilePayload);
  const existingProfile = fs.existsSync(profileOutput) ? readJson(profileOutput) : null;
  const profile = existingProfile && existingProfile.provenance && existingProfile.provenance.inputFingerprint === profileFingerprint
    ? existingProfile
    : { ...profilePayload, provenance: { inputFingerprint: profileFingerprint, status: "current" } };
  if (profile !== existingProfile) writeJson(profileOutput, profile);

  const sourceOutput = path.join(projectRoot, "source", "source-context.json");
  const source = cacheDocument(sourceOutput, (previous) => buildSourceContext(collectSourceInventory(path.resolve(intake.project.sourcePath)), { repository: path.resolve(intake.project.sourcePath), previousContext: previous }));
  const rulesOutput = path.join(projectRoot, "rules", "rules-context.json");
  const rules = cacheDocument(rulesOutput, (previous) => buildRulesContext(collectRulesInput(profile), { previousContext: previous }));

  const taskDesignDirectory = path.join("figma", normalizeKey(intake.task.id, "task.id"));
  const normalizedDesignRelative = path.join(taskDesignDirectory, "normalized-design.json");
  const designIndexRelative = path.join(taskDesignDirectory, "design-index.json");
  const layoutRelative = path.join(taskDesignDirectory, "layout-context.json");
  const artifacts = [
    { id: "source", kind: "source_context", path: "source/source-context.json", phases: ["analysis", "foundation", "implementation"] },
    { id: "rules", kind: "rules_context", path: "rules/rules-context.json", phases: ["analysis", "implementation", "review"] },
    { id: "normalized-design", kind: "normalized_design_artifact", path: normalizedDesignRelative, phases: ["foundation", "implementation", "review", "qc"] },
    { id: "design-index", kind: "design_index", path: designIndexRelative, phases: ["implementation", "qc"] },
    { id: "layout", kind: "figma_layout_context", path: layoutRelative, phases: ["foundation", "implementation", "review", "qc"] },
    { id: "evidence-links", kind: "evidence_links", path: "evidence/evidence-links.json", phases: ["review", "qc"] }
  ];
  const declaredNormalizedArtifact = intake.design && intake.design.normalizedArtifactPath;
  const collectedArtifact = intake.design && (intake.design.collectedArtifactPath || intake.design.rawArtifactPath);
  const buildWarnings = [];
  let normalizedDesign = null;
  let normalizedArtifactPath = null;
  if (declaredNormalizedArtifact && fs.existsSync(declaredNormalizedArtifact)) {
    try {
      normalizedDesign = readJson(declaredNormalizedArtifact);
      normalizedArtifactPath = path.resolve(declaredNormalizedArtifact);
      if (normalizedDesign.kind !== "normalized_design_artifact") throw new Error("Declared normalizedArtifactPath is not a normalized_design_artifact");
    } catch (error) {
      buildWarnings.push({ code: "normalized_design_artifact_invalid", message: error.message });
    }
  } else if (declaredNormalizedArtifact) {
    buildWarnings.push({ code: "normalized_design_artifact_missing", message: `Normalized design artifact is unavailable: ${declaredNormalizedArtifact}` });
  }
  if (!normalizedDesign && collectedArtifact && fs.existsSync(collectedArtifact)) {
    try {
      const targetNodeId = intake.design && intake.design.targetFrame && intake.design.targetFrame.nodeId;
      const normalizedOutput = path.join(projectRoot, normalizedDesignRelative);
      const normalized = normalizeFile(collectedArtifact, normalizedOutput, { targetNodeId });
      normalizedDesign = normalized.artifact;
      normalizedArtifactPath = normalized.outPath;
    } catch (error) {
      buildWarnings.push({ code: "design_normalization_failed", message: error.message });
    }
  } else if (!normalizedDesign && collectedArtifact) {
    buildWarnings.push({ code: "collected_design_artifact_missing", message: `Collected design artifact is unavailable: ${collectedArtifact}` });
  }
  if (normalizedDesign) {
    try {
      const designOutput = path.join(projectRoot, designIndexRelative);
      cacheDocument(designOutput, (previous) => buildDesignIndex(normalizedDesign, { rawArtifact: normalizedArtifactPath, previousContext: previous }));
      const layoutOutput = path.join(projectRoot, layoutRelative);
      const layoutIntake = {
        scope: {
          mode: "static_layout",
          targets: normalizedDesign.pages.map((page) => ({ screenId: page.id })),
          viewportPolicy: "design_frames_only"
        },
        framework: profile.framework || {},
        codingRules: rules.context.rules,
        sourceConventions: [source.context.conventions]
      };
      cacheDocument(layoutOutput, (previous) => buildLayoutContext(normalizedDesign, layoutIntake, { rawArtifact: normalizedArtifactPath, previousContext: previous }));
    } catch (error) {
      buildWarnings.push({ code: "normalized_design_compilation_failed", message: error.message });
    }
  }

  const projectContextOutput = path.join(projectRoot, "project-context.json");
  const projectPayload = {
    schemaVersion: VERSION,
    kind: "project_context",
    project: { key: intake.project.key, sourcePath: path.resolve(intake.project.sourcePath) },
    profileRef: { path: profileOutput, id: profile.id, version: profile.version, hash: documentHash(profile) },
    sourceRef: { path: source.path, fingerprint: source.context.provenance.inputFingerprint },
    rulesRef: { path: rules.path, fingerprint: rules.context.provenance.inputFingerprint },
    runtime: source.context.runtime,
    provenance: { inputFingerprint: fingerprint({ profile: documentHash(profile), source: source.context.provenance.inputFingerprint, rules: rules.context.provenance.inputFingerprint, version: VERSION }), status: "current" }
  };
  const existingProject = fs.existsSync(projectContextOutput) ? readJson(projectContextOutput) : null;
  const project = existingProject && existingProject.provenance.inputFingerprint === projectPayload.provenance.inputFingerprint ? existingProject : projectPayload;
  if (project !== existingProject) writeJson(projectContextOutput, project);

  const indexInput = { project: { key: intake.project.key, sourceRepository: path.resolve(intake.project.sourcePath) }, artifacts };
  const documents = {};
  for (const artifact of artifacts) {
    const artifactPath = path.join(projectRoot, artifact.path);
    if (fs.existsSync(artifactPath)) documents[artifact.id] = readJson(artifactPath);
  }
  const indexOutput = path.join(projectRoot, "project-context-index.json");
  const projectIndex = cacheDocument(indexOutput, (previous) => buildProjectContextIndex(indexInput, { artifactDocuments: documents, previousContext: previous }));

  const taskDraftOutput = path.join(taskRoot, "task-context.draft.json");
  const visual = visualReadiness(intake, normalizedDesign);
  const taskPayload = {
    schemaVersion: VERSION,
    kind: "task_context",
    status: "draft",
    project: { key: intake.project.key },
    task: { id: intake.task.id, title: intake.task.title || null, requestedPhase: intake.task.requestedPhase || "analysis", allowedPhases: [...new Set(intake.task.allowedPhases || PHASES)] },
    profileRef: { path: profileOutput, id: profile.id, version: profile.version, hash: documentHash(profile) },
    projectRef: { path: projectContextOutput, hash: documentHash(project), sourceFingerprint: project.sourceRef.fingerprint },
    contextIndexRef: { path: indexOutput, kind: "project_context_index" },
    design: {
      figmaUrl: intake.design && intake.design.figmaUrl || null,
      nodes: intake.design && intake.design.nodes || [],
      targetFrame: visual.targetFrame,
      referenceImages: visual.referenceImages,
      collectedArtifactPath: collectedArtifact ? path.resolve(collectedArtifact) : null,
      collectedArtifactFingerprint: collectedArtifact && fs.existsSync(collectedArtifact) ? documentHash(readJson(collectedArtifact)) : null,
      normalizedArtifactPath,
      normalizedArtifactFingerprint: normalizedArtifactPath && fs.existsSync(normalizedArtifactPath) ? documentHash(readJson(normalizedArtifactPath)) : null,
      rawArtifactPath: collectedArtifact ? path.resolve(collectedArtifact) : null,
      rawArtifactFingerprint: collectedArtifact && fs.existsSync(collectedArtifact) ? documentHash(readJson(collectedArtifact)) : null
    },
    viewportContract: visual.viewportContract,
    assetPolicy: intake.assetPolicy || { icons: "figma_asset_or_approved_library_only", forbidCssRecreationWithoutEvidence: true },
    visualReadiness: visual.readiness,
    acceptanceCriteria: intake.acceptanceCriteria || [],
    assumptions: intake.assumptions || [],
    phasePermissions: Object.fromEntries(PHASES.map((phase) => [phase, projectIndex.context.phases[phase] || { ready: false, blockedBy: ["phase_not_configured"] }])),
    evidenceRefreshPolicy: "human_or_cache_owner_authorized_only",
    provenance: { inputFingerprint: fingerprint({ intake, profile: documentHash(profile), project: documentHash(project), index: documentHash(projectIndex.context), version: VERSION }), status: "current" },
    diagnostics: { warnings: buildWarnings, secretKeyPaths: hasSecret(intake) }
  };
  const existingDraft = fs.existsSync(taskDraftOutput) ? readJson(taskDraftOutput) : null;
  const taskContext = existingDraft && existingDraft.provenance.inputFingerprint === taskPayload.provenance.inputFingerprint ? existingDraft : taskPayload;
  if (taskContext !== existingDraft) writeJson(taskDraftOutput, taskContext);
  return { profilePath: profileOutput, projectPath: projectContextOutput, indexPath: indexOutput, taskPath: taskDraftOutput, cacheHit: taskContext === existingDraft, warnings: buildWarnings };
}

function validationErrors(context, contextPath, options = {}) {
  const errors = [];
  if (!context || context.kind !== "task_context") errors.push("context_kind_invalid");
  const allowedStatus = options.requireApproved ? ["approved"] : ["draft", "approved"];
  if (!allowedStatus.includes(context.status)) errors.push("context_status_invalid");
  if (!context.schemaVersion || !context.provenance || context.provenance.status !== "current") errors.push("context_provenance_invalid");
  for (const refName of ["profileRef", "projectRef", "contextIndexRef"]) {
    const ref = context[refName];
    if (!ref || !ref.path || !fs.existsSync(ref.path)) { errors.push(`${refName}_missing`); continue; }
    if (!isWithin(CONTEXT_ROOT, ref.path)) errors.push(`${refName}_escapes_context_root`);
    else if (ref.hash && documentHash(readJson(ref.path)) !== ref.hash) errors.push(`${refName}_hash_mismatch`);
  }
  if (context.projectRef && context.projectRef.path && fs.existsSync(context.projectRef.path)) {
    const project = readJson(context.projectRef.path);
    if (project.project && project.project.sourcePath && fs.existsSync(project.project.sourcePath)) {
      const currentSource = buildSourceContext(collectSourceInventory(project.project.sourcePath), { repository: project.project.sourcePath });
      if (currentSource.context.provenance.inputFingerprint !== context.projectRef.sourceFingerprint) errors.push("source_context_stale");
    } else errors.push("source_repository_missing");
  }
  if (context.design && (context.design.normalizedArtifactPath || context.design.rawArtifactPath)) {
    const artifactPath = context.design.normalizedArtifactPath || context.design.rawArtifactPath;
    const artifactFingerprint = context.design.normalizedArtifactFingerprint || context.design.rawArtifactFingerprint;
    if (!fs.existsSync(artifactPath)) errors.push("design_artifact_missing");
    else if (documentHash(readJson(artifactPath)) !== artifactFingerprint) errors.push("design_artifact_stale");
  }
  if (context.design && context.design.collectedArtifactPath && context.design.collectedArtifactFingerprint) {
    if (!fs.existsSync(context.design.collectedArtifactPath)) errors.push("collected_design_artifact_missing");
    else if (documentHash(readJson(context.design.collectedArtifactPath)) !== context.design.collectedArtifactFingerprint) errors.push("collected_design_artifact_stale");
  }
  if (context.diagnostics && context.diagnostics.secretKeyPaths && context.diagnostics.secretKeyPaths.length) errors.push("intake_contains_sensitive_key");
  const requested = options.phase || context.task && context.task.requestedPhase;
  if (!PHASES.includes(requested)) errors.push("requested_phase_invalid");
  else {
    if (!context.task || !Array.isArray(context.task.allowedPhases) || !context.task.allowedPhases.includes(requested)) errors.push(`requested_phase_not_allowed:${requested}`);
    const index = context.contextIndexRef && context.contextIndexRef.path && fs.existsSync(context.contextIndexRef.path) ? readJson(context.contextIndexRef.path) : null;
    const phase = index && index.phases && index.phases[requested];
    if (!phase || !phase.ready) errors.push(`requested_phase_blocked:${requested}`);
    if (["foundation", "implementation"].includes(requested)) {
      if (!context.visualReadiness || !context.visualReadiness.targetFrameConfirmed) errors.push("target_frame_not_confirmed");
      if (!context.visualReadiness || !context.visualReadiness.viewportContractConfirmed) errors.push("viewport_contract_not_confirmed");
      if (!context.visualReadiness || !context.visualReadiness.visualReferenceConfirmed) errors.push("visual_reference_not_confirmed");
    }
  }
  if (options.requireApproved) {
    const checksumPath = `${contextPath}.sha256`;
    if (!fs.existsSync(checksumPath)) errors.push("approved_checksum_missing");
    else if (fs.readFileSync(checksumPath, "utf8").trim() !== documentHash(context)) errors.push("approved_checksum_mismatch");
  }
  return errors;
}

function validateContext(contextPath, options = {}) {
  assert(fs.existsSync(contextPath), `Context file does not exist: ${contextPath}`);
  assertWithinContextRoot(contextPath);
  const context = readJson(contextPath);
  const errors = validationErrors(context, contextPath, options);
  return { valid: errors.length === 0, errors, context };
}

function approveContext(draftPath) {
  const draft = validateContext(draftPath);
  if (!draft.valid) throw new Error(`Context cannot be approved: ${draft.errors.join(", ")}`);
  assert(draft.context.status === "draft", "Only a draft context can be approved");
  const approvedPath = draftPath.replace(/\.draft\.json$/i, ".approved.json");
  assert(approvedPath !== draftPath, "Draft context filename must end in .draft.json");
  assert(!fs.existsSync(approvedPath), `Approved context already exists: ${approvedPath}`);
  const approved = { ...draft.context, status: "approved", approval: { approvedAt: new Date().toISOString(), approvedBy: process.env.USERNAME || process.env.USER || "unknown", toolVersion: VERSION } };
  writeJson(approvedPath, approved);
  fs.writeFileSync(`${approvedPath}.sha256`, `${documentHash(approved)}\n`, "utf8");
  fs.chmodSync(approvedPath, 0o444);
  fs.chmodSync(`${approvedPath}.sha256`, 0o444);
  return { approvedPath, checksumPath: `${approvedPath}.sha256`, hash: documentHash(approved) };
}

module.exports = { CONTEXT_ROOT, VERSION, buildContext, validateContext, approveContext, documentHash, sourceInventory: collectSourceInventory };
