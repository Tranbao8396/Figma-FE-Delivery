const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const VERSION = "1.0.0";
const CHANGE_TYPES = new Set(["evidence_backed_correction", "evidence_backed_scope_extension", "user_directed_deviation"]);
const PHASES = new Set(["implementation", "review", "qc"]);

function assert(condition, message) { if (!condition) throw new Error(message); }
function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, "utf8")); }
function writeJson(filePath, document) { fs.mkdirSync(path.dirname(filePath), { recursive: true }); fs.writeFileSync(filePath, `${JSON.stringify(document, null, 2)}\n`, "utf8"); }
function documentHash(value) { return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function safeId(value, label = "amendment id") { const result = String(value || "").trim(); assert(/^[a-z0-9][a-z0-9-]*$/i.test(result), `${label} must contain letters, digits, or hyphens only`); return result; }
function projectPath(value, label) { const result = typeof value === "string" ? value.trim().replace(/\\/g, "/") : ""; assert(result && !result.startsWith("/") && !/^[a-z]:\//i.test(result) && !result.split("/").includes(".."), `${label} must be a project-relative path`); return result; }

function amendmentPaths(baseContextPath, id) {
  const taskRoot = path.dirname(path.resolve(baseContextPath));
  const root = path.join(taskRoot, "amendments", safeId(id));
  return { root, draftPath: path.join(root, "amendment.draft.json"), approvedPath: path.join(root, "amendment.approved.json") };
}

function readApprovedBase(baseContextPath, options = {}) {
  const resolved = path.resolve(baseContextPath);
  const { validateContext } = require("./core");
  const validation = validateContext(resolved, { requireApproved: true, allowSourceDrift: Boolean(options.allowSourceDrift) });
  assert(validation.valid, `Amendment requires approved, current base context: ${validation.errors.join(", ")}`);
  return { path: resolved, context: validation.context, hash: documentHash(validation.context) };
}

function initializeAmendment(baseContextPath, id) {
  const base = readApprovedBase(baseContextPath, { allowSourceDrift: true });
  const paths = amendmentPaths(base.path, id);
  assert(!fs.existsSync(paths.draftPath), `Refusing to overwrite amendment draft: ${paths.draftPath}`);
  const draft = {
    schemaVersion: VERSION,
    kind: "context_amendment",
    status: "draft",
    id: safeId(id),
    baseContext: { path: base.path, sha256: base.hash, taskId: base.context.task.id },
    changeType: null,
    allowedPhases: ["implementation", "review", "qc"],
    reason: "",
    designEvidence: { nodes: [], referenceImages: [] },
    contractDelta: { visualStates: [], filePlan: { create: [], modify: [] } },
    qualityPlanDelta: { cases: [] }
  };
  writeJson(paths.draftPath, draft);
  return { draftPath: paths.draftPath };
}

function normalizeEvidence(input, type) {
  const design = input && input.designEvidence || {};
  const nodes = [...new Set((design.nodes || []).filter((node) => typeof node === "string" && node.trim()).map((node) => node.trim()))];
  const referenceImages = (design.referenceImages || []).map((image, index) => {
    assert(image && typeof image.path === "string" && image.path.trim(), `designEvidence.referenceImages[${index}].path is required`);
    assert(fs.existsSync(image.path), `Design evidence image does not exist: ${image.path}`);
    return { path: path.resolve(image.path), role: image.role || "visual_comparison" };
  });
  if (type !== "user_directed_deviation") assert(nodes.length && referenceImages.length, "Evidence-backed amendment requires at least one node and reference image");
  return { nodes, referenceImages };
}

function nodeIdsInArtifact(value, ids = new Set()) {
  if (!value || typeof value !== "object") return ids;
  if (typeof value.id === "string") ids.add(value.id);
  if (typeof value.nodeId === "string") ids.add(value.nodeId);
  for (const child of Array.isArray(value) ? value : Object.values(value)) nodeIdsInArtifact(child, ids);
  return ids;
}

function verifyEvidenceNodes(baseContext, evidence, type) {
  if (type === "user_directed_deviation" || !evidence.nodes.length) return;
  const design = baseContext.design || {};
  const artifactPath = design.normalizedArtifactPath || design.collectedArtifactPath || design.rawArtifactPath;
  assert(artifactPath && fs.existsSync(artifactPath), "Evidence-backed amendment requires a current normalized or collected design artifact");
  const ids = nodeIdsInArtifact(readJson(artifactPath));
  for (const nodeId of evidence.nodes) assert(ids.has(nodeId), `Amendment evidence node is not present in the base design artifact: ${nodeId}`);
}

function normalizeFilePlan(input) {
  const plan = input && input.contractDelta && input.contractDelta.filePlan || {};
  const create = [...new Set((plan.create || []).map((item) => projectPath(item, "contractDelta.filePlan.create")))];
  const modify = [...new Set((plan.modify || []).map((item) => projectPath(item, "contractDelta.filePlan.modify")))];
  assert(!create.some((item) => modify.includes(item)), "Amendment filePlan cannot create and modify the same path");
  return { create, modify };
}

function normalizeVisualStates(input, evidence) {
  const states = input && input.contractDelta && input.contractDelta.visualStates || [];
  return states.map((state, index) => {
    assert(state && typeof state.id === "string" && state.id.trim(), `contractDelta.visualStates[${index}].id is required`);
    assert(typeof state.state === "string" && state.state.trim(), `contractDelta.visualStates[${index}].state is required`);
    assert(typeof state.trigger === "string" && state.trigger.trim(), `contractDelta.visualStates[${index}].trigger is required`);
    const stateFrameNodeId = typeof state.stateFrameNodeId === "string" && state.stateFrameNodeId.trim() ? state.stateFrameNodeId.trim() : typeof state.targetNodeId === "string" && state.targetNodeId.trim() ? state.targetNodeId.trim() : null;
    assert(stateFrameNodeId, `contractDelta.visualStates[${index}].stateFrameNodeId is required`);
    const effectNodeIds = [...new Set((state.effectNodeIds || []).filter((nodeId) => typeof nodeId === "string" && nodeId.trim()))];
    assert(evidence.nodes.includes(stateFrameNodeId), `Visual state ${state.id} stateFrameNodeId must be in designEvidence.nodes`);
    assert(effectNodeIds.every((nodeId) => evidence.nodes.includes(nodeId)), `Visual state ${state.id} effectNodeIds must be in designEvidence.nodes`);
    return { id: state.id.trim(), state: state.state.trim(), trigger: state.trigger.trim(), targetNodeId: stateFrameNodeId, stateFrameNodeId, effectNodeIds, required: Boolean(state.required), requiredEffects: [...new Set((state.requiredEffects || []).filter((effect) => typeof effect === "string" && effect.trim()))], referenceImage: evidence.referenceImages[0] || null };
  });
}

function normalizeQualityDelta(input, baseContext, evidence) {
  const quality = input && input.qualityPlanDelta || {};
  const cases = (quality.cases || []).map((item, index) => {
    assert(item && typeof item.id === "string" && item.id.trim(), `qualityPlanDelta.cases[${index}].id is required`);
    assert(item.viewport && Number(item.viewport.width) > 0 && Number(item.viewport.height) > 0, `qualityPlanDelta.cases[${index}].viewport is required`);
    const testViewport = { width: Number(item.viewport.width), height: Number(item.viewport.height) };
    if (baseContext.viewportContract && baseContext.viewportContract.deviceScope === "pc_only" && baseContext.viewportContract.minWidth) assert(testViewport.width >= Number(baseContext.viewportContract.minWidth), `qualityPlanDelta.cases[${index}] viewport is narrower than base pc_only minWidth`);
    const referenceImagePath = typeof item.referenceImagePath === "string" ? path.resolve(item.referenceImagePath) : evidence.referenceImages[0] && evidence.referenceImages[0].path || null;
    if (referenceImagePath) assert(fs.existsSync(referenceImagePath), `qualityPlanDelta.cases[${index}] reference image does not exist: ${referenceImagePath}`);
    return { id: item.id.trim(), screen: typeof item.screen === "string" ? item.screen.trim() : null, state: typeof item.state === "string" ? item.state.trim() : null, viewport: testViewport, referenceImagePath, testCases: [...new Set((item.testCases || []).filter((testCase) => typeof testCase === "string" && testCase.trim()))], actions: Array.isArray(item.actions) ? item.actions : [], assertions: Array.isArray(item.assertions) ? item.assertions : [], visualDiff: item.visualDiff && typeof item.visualDiff === "object" ? item.visualDiff : null };
  });
  return { cases, visualDiff: quality.visualDiff && typeof quality.visualDiff === "object" ? quality.visualDiff : null };
}

function buildAmendment(input) {
  assert(input && typeof input === "object", "Amendment input must be an object");
  assert(input.baseContext && input.baseContext.path, "Amendment input requires baseContext.path");
  const base = readApprovedBase(input.baseContext.path, { allowSourceDrift: true });
  const id = safeId(input.id);
  const type = input.changeType;
  assert(CHANGE_TYPES.has(type), `changeType must be one of: ${[...CHANGE_TYPES].join(", ")}`);
  const allowedPhases = [...new Set((input.allowedPhases || []).filter((phase) => PHASES.has(phase)))];
  assert(allowedPhases.length, "Amendment requires at least one allowed phase");
  assert(typeof input.reason === "string" && input.reason.trim(), "Amendment reason is required");
  const designEvidence = normalizeEvidence(input, type);
  verifyEvidenceNodes(base.context, designEvidence, type);
  const contractDelta = { visualStates: normalizeVisualStates(input, designEvidence), filePlan: normalizeFilePlan(input) };
  const qualityPlanDelta = normalizeQualityDelta(input, base.context, designEvidence);
  const paths = amendmentPaths(base.path, id);
  const document = {
    schemaVersion: VERSION,
    kind: "context_amendment",
    status: "draft",
    id,
    baseContext: { path: base.path, sha256: base.hash, taskId: base.context.task.id },
    changeType: type,
    allowedPhases,
    reason: input.reason.trim(),
    designEvidence,
    contractDelta,
    qualityPlanDelta,
    provenance: { inputFingerprint: documentHash({ input, baseHash: base.hash, version: VERSION }), status: "current" }
  };
  writeJson(paths.draftPath, document);
  return { draftPath: paths.draftPath, cacheHit: false };
}

function validateAmendment(amendmentPath, options = {}) {
  const resolved = path.resolve(amendmentPath);
  assert(fs.existsSync(resolved), `Amendment does not exist: ${resolved}`);
  const document = readJson(resolved);
  const errors = [];
  if (document.kind !== "context_amendment") errors.push("amendment_kind_invalid");
  if (!document.baseContext || !document.baseContext.path || !document.baseContext.sha256) errors.push("amendment_base_missing");
  let base = null;
  try {
    base = readApprovedBase(document.baseContext.path, { allowSourceDrift: true });
    if (base.hash !== document.baseContext.sha256) errors.push("amendment_base_hash_mismatch");
    if (document.baseContext.taskId !== base.context.task.id) errors.push("amendment_base_task_mismatch");
  } catch (error) { errors.push(`amendment_base_invalid:${error.message}`); }
  if (!CHANGE_TYPES.has(document.changeType)) errors.push("amendment_change_type_invalid");
  if (!Array.isArray(document.allowedPhases) || !document.allowedPhases.length || document.allowedPhases.some((phase) => !PHASES.has(phase))) errors.push("amendment_phase_invalid");
  if (typeof document.reason !== "string" || !document.reason.trim()) errors.push("amendment_reason_missing");
  if (base && CHANGE_TYPES.has(document.changeType)) {
    try {
      const evidence = normalizeEvidence(document, document.changeType);
      verifyEvidenceNodes(base.context, evidence, document.changeType);
      normalizeVisualStates(document, evidence);
      normalizeFilePlan(document);
      normalizeQualityDelta(document, base.context, evidence);
    } catch (error) { errors.push(`amendment_contract_invalid:${error.message}`); }
  }
  if (options.phase && (!document.allowedPhases || !document.allowedPhases.includes(options.phase))) errors.push(`amendment_phase_not_allowed:${options.phase}`);
  if (options.requireApproved && document.status !== "approved") errors.push("amendment_not_approved");
  if (options.requireApproved) {
    const checksum = `${resolved}.sha256`;
    if (!fs.existsSync(checksum)) errors.push("amendment_checksum_missing");
    else if (fs.readFileSync(checksum, "utf8").trim() !== documentHash(document)) errors.push("amendment_checksum_mismatch");
  }
  return { valid: errors.length === 0, errors, document, base };
}

function approveAmendment(draftPath) {
  const validation = validateAmendment(draftPath);
  assert(validation.valid, `Amendment cannot be approved: ${validation.errors.join(", ")}`);
  assert(validation.document.status === "draft", "Only a draft amendment can be approved");
  const approvedPath = path.resolve(draftPath).replace(/\.draft\.json$/i, ".approved.json");
  assert(approvedPath !== path.resolve(draftPath), "Amendment draft filename must end in .draft.json");
  assert(!fs.existsSync(approvedPath), `Approved amendment already exists: ${approvedPath}`);
  const approved = { ...validation.document, status: "approved", approval: { approvedAt: new Date().toISOString(), approvedBy: process.env.USERNAME || process.env.USER || "unknown", toolVersion: VERSION } };
  writeJson(approvedPath, approved);
  fs.writeFileSync(`${approvedPath}.sha256`, `${documentHash(approved)}\n`, "utf8");
  return { approvedPath, checksumPath: `${approvedPath}.sha256` };
}

function mergeFilePlan(basePlan, delta) {
  const result = { primary: [...(basePlan.primary || [])], create: [...(basePlan.create || [])], modify: [...(basePlan.modify || [])], forbid: [...(basePlan.forbid || [])] };
  for (const [role, files] of [["create", delta.create], ["modify", delta.modify]]) for (const file of files) {
    assert(!result.forbid.includes(file), `Amendment file is forbidden by base context: ${file}`);
    const otherRole = role === "create" ? "modify" : "create";
    assert(!result[otherRole].includes(file), `Amendment file conflicts with base file plan: ${file}`);
    if (!result[role].includes(file)) result[role].push(file);
  }
  return result;
}

function resolveEffectiveContext(baseContextPath, amendmentPath, phase) {
  const base = readApprovedBase(baseContextPath, { allowSourceDrift: true });
  const validation = validateAmendment(amendmentPath, { requireApproved: true, phase });
  assert(validation.valid, `Approved amendment is invalid: ${validation.errors.join(", ")}`);
  assert(path.resolve(validation.document.baseContext.path) === base.path, "Amendment does not belong to this base context");
  const amendment = validation.document;
  const effective = JSON.parse(JSON.stringify(base.context));
  const baseStates = effective.design && Array.isArray(effective.design.visualStates) ? effective.design.visualStates : [];
  effective.design = effective.design || {};
  effective.design.visualStates = [...baseStates, ...amendment.contractDelta.visualStates];
  effective.qualityPlan = effective.qualityPlan || { cases: [], visualDiff: null };
  effective.qualityPlan = { cases: [...(effective.qualityPlan.cases || []), ...(amendment.qualityPlanDelta.cases || [])], visualDiff: amendment.qualityPlanDelta.visualDiff || effective.qualityPlan.visualDiff || null };
  effective.implementationContract = { ...effective.implementationContract, filePlan: mergeFilePlan(effective.implementationContract.filePlan, amendment.contractDelta.filePlan) };
  effective.amendmentRefs = [{ id: amendment.id, path: path.resolve(amendmentPath), hash: documentHash(amendment), changeType: amendment.changeType }];
  return { context: effective, amendment, base };
}

module.exports = { VERSION, amendmentPaths, initializeAmendment, buildAmendment, validateAmendment, approveAmendment, resolveEffectiveContext };
