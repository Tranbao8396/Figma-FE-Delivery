const crypto = require("crypto");

const HOOK_VERSION = "1.3.0";
const LAYOUT_NOTE_PATTERN = /layout|grid|column|card|table|form|sidebar|header|viewport|responsive|scroll|panel|width|height|stack|two-column|full-screen/i;
const NON_UI_NODE_TYPES = new Set(["DOCUMENT", "PAGE", "SECTION", "SLICE", "CONNECTOR", "WIDGET", "EMBED", "LINK_UNFURL", "STAMP"]);
const DESIGN_ONLY_NAME_PATTERN = /\b(annotation|note|spec|guide|redline|measurement|draft|template|archive|do not use)\b/i;
const GENERIC_WRAPPER_PATTERN = /^(frame|group|container|wrapper|layer)(\s+\d+)?$/i;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function stableSerialize(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function fingerprint(value) {
  return crypto.createHash("sha256").update(stableSerialize(value)).digest("hex");
}

function byteLength(value) {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

function parseViewport(viewport) {
  const match = typeof viewport === "string" && viewport.match(/^(\d+)x(\d+)$/);
  if (!match) {
    return null;
  }

  return { width: Number(match[1]), height: Number(match[2]) };
}

function toCssPx(value) {
  return typeof value === "number" && Number.isFinite(value) ? `${Number(value.toFixed(2))}px` : undefined;
}

function kebabCase(value) {
  return String(value || "token")
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "token";
}

function colorRole(name, value) {
  const hint = `${name} ${value}`.toLowerCase();
  if (/main|primary|brand|blue/.test(hint)) return "primary";
  if (/black|text|font|foreground/.test(hint)) return "text";
  if (/red|error|danger|invalid/.test(hint)) return "danger";
  if (/stroke|border|divider|outline/.test(hint)) return "border";
  if (/white|surface|background|bg/.test(hint)) return "surface";
  return "decorative";
}

function normalizeColorTokens(colors = {}) {
  const usedNames = new Set();
  return Object.entries(colors).map(([sourceName, value]) => {
    const role = colorRole(sourceName, value);
    let cssCustomProperty = `--color-${role === "decorative" ? kebabCase(sourceName) : role}`;
    if (usedNames.has(cssCustomProperty)) cssCustomProperty = `--color-${kebabCase(sourceName)}`;
    usedNames.add(cssCustomProperty);
    return { css: cssCustomProperty, value, role };
  });
}

function normalizeTypographyTokens(styles = []) {
  return styles.map((style, index) => {
    const token = { css: `--font-${kebabCase(style.name || `text-${index + 1}`)}` };
    if (style.fontFamily) token.family = style.fontFamily;
    if (toCssPx(style.fontSize)) token.size = toCssPx(style.fontSize);
    if (style.fontWeight) token.weight = style.fontWeight;
    if (toCssPx(style.lineHeightPx || style.lineHeight)) token.lineHeight = toCssPx(style.lineHeightPx || style.lineHeight);
    return token;
  });
}

function readNodeChildren(node) {
  for (const key of ["children", "nodes", "layers"]) {
    if (Array.isArray(node && node[key])) return node[key];
  }
  return [];
}

function nodeBounds(node) {
  const box = node && (node.absoluteBoundingBox || node.absoluteRenderBounds || node.boundingBox);
  if (box && typeof box === "object") return { x: box.x, y: box.y, width: box.width, height: box.height };
  if (typeof node?.width === "number" || typeof node?.height === "number") return { width: node.width, height: node.height };
  return null;
}

function nodeGeometry(node) {
  const bounds = nodeBounds(node);
  if (!bounds || !Number.isFinite(bounds.x) || !Number.isFinite(bounds.y)) return undefined;
  const geometry = { x: toCssPx(bounds.x), y: toCssPx(bounds.y) };
  if (Number.isFinite(bounds.width)) geometry.width = toCssPx(bounds.width);
  if (Number.isFinite(bounds.height)) geometry.height = toCssPx(bounds.height);
  return geometry;
}

function isDesignOnlyNode(node, policy) {
  const name = node && node.name || "";
  if (!node || node.visible === false || node.opacity === 0 || NON_UI_NODE_TYPES.has(node.type)) return true;
  if (node.designOnly === true || DESIGN_ONLY_NAME_PATTERN.test(name)) return true;
  if (policy.excludeComponentDefinitions !== false && ["COMPONENT", "COMPONENT_SET"].includes(node.type)) return true;
  return false;
}

function isVector(node) {
  return ["VECTOR", "BOOLEAN_OPERATION", "STAR", "LINE", "ELLIPSE", "POLYGON"].includes(node && node.type);
}

function vectorSummary(node) {
  const bounds = nodeBounds(node) || {};
  const area = (bounds.width || 0) * (bounds.height || 0);
  return {
    kind: area <= 4096 ? "icon" : "illustration",
    hasFill: Array.isArray(node.fills) ? node.fills.some((fill) => fill && fill.visible !== false) : Boolean(node.fill),
    hasStroke: Array.isArray(node.strokes) ? node.strokes.some((stroke) => stroke && stroke.visible !== false) : Boolean(node.strokeWeight || node.stroke),
    size: bounds.width && bounds.height ? { width: toCssPx(bounds.width), height: toCssPx(bounds.height) } : undefined
  };
}

function nodeRole(node) {
  const name = `${node.name || ""} ${node.type || ""}`.toLowerCase();
  if (node.type === "TEXT") return "text";
  if (/button|submit|save|add|delete|edit/.test(name)) return "button";
  if (/input|search|field|select|form/.test(name)) return "form-control";
  if (/header|nav|menu/.test(name)) return "navigation";
  if (/table|list|row/.test(name)) return "collection";
  if (isVector(node)) return "graphic";
  return "container";
}

function nodeLayout(node) {
  const bounds = nodeBounds(node);
  const padding = {
    top: toCssPx(node.paddingTop), right: toCssPx(node.paddingRight), bottom: toCssPx(node.paddingBottom), left: toCssPx(node.paddingLeft)
  };
  const compactPadding = Object.fromEntries(Object.entries(padding).filter(([, value]) => value));
  const layout = {};
  if (node.layoutMode === "HORIZONTAL" || node.layoutMode === "VERTICAL") {
    layout.display = "flex";
    layout.flexDirection = node.layoutMode === "HORIZONTAL" ? "row" : "column";
  } else if (node.layoutMode === "GRID") {
    layout.display = "grid";
  }
  if (typeof node.itemSpacing === "number") layout.gap = toCssPx(node.itemSpacing);
  if (Object.keys(compactPadding).length) layout.padding = compactPadding;
  if (bounds && typeof bounds.width === "number") layout.width = toCssPx(bounds.width);
  if (bounds && typeof bounds.height === "number") layout.height = toCssPx(bounds.height);
  return layout;
}

function nodeStyle(node) {
  const style = {};
  if (typeof node.cornerRadius === "number") style.borderRadius = toCssPx(node.cornerRadius);
  if (typeof node.strokeWeight === "number") style.borderWidth = toCssPx(node.strokeWeight);
  if (node.type === "TEXT") {
    if (typeof node.fontSize === "number") style.fontSize = toCssPx(node.fontSize);
    if (typeof node.fontWeight === "number") style.fontWeight = node.fontWeight;
    if (node.fontName && node.fontName.family) style.fontFamily = node.fontName.family;
  }
  return style;
}

function isFlattenableWrapper(node, children) {
  const layout = nodeLayout(node);
  const style = nodeStyle(node);
  const genericName = !node.name || GENERIC_WRAPPER_PATTERN.test(node.name);
  return children.length === 1
    && ["FRAME", "GROUP"].includes(node.type)
    && genericName
    && Object.keys(layout).length === 0
    && Object.keys(style).length === 0
    && !(Array.isArray(node.fills) && node.fills.length)
    && !(Array.isArray(node.strokes) && node.strokes.length)
    && !node.clipContent;
}

function compactNode(node, policy, diagnostics, depth = 0) {
  if (!node || isDesignOnlyNode(node, policy)) {
    diagnostics.suppressedByReason.non_ui_or_design_node += 1;
    return null;
  }
  if (depth >= policy.maxComponentDepth) {
    diagnostics.suppressedByReason.component_depth_limit += readNodeChildren(node).length;
    return { nodeId: node.id || null, name: node.name || null, role: nodeRole(node), truncated: true };
  }

  const children = readNodeChildren(node)
    .map((child) => compactNode(child, policy, diagnostics, depth + 1))
    .filter(Boolean);
  if (isFlattenableWrapper(node, children)) {
    diagnostics.suppressedByReason.flattened_single_child_wrapper += 1;
    return children[0];
  }

  const compact = {
    nodeId: node.id || null,
    name: node.name || null,
    role: nodeRole(node)
  };
  const geometry = nodeGeometry(node);
  if (geometry) compact.geometry = geometry;
  const layout = nodeLayout(node);
  const style = nodeStyle(node);
  if (Object.keys(layout).length) compact.layout = layout;
  if (Object.keys(style).length) compact.style = style;
  if (node.type === "TEXT" && typeof node.characters === "string" && node.characters.trim()) compact.text = node.characters.trim().slice(0, policy.maxTextLength);
  if (isVector(node)) compact.vector = vectorSummary(node);
  if (children.length) compact.children = children.slice(0, policy.maxChildrenPerNode);
  if (children.length > policy.maxChildrenPerNode) {
    compact.childrenTruncated = children.length - policy.maxChildrenPerNode;
    diagnostics.suppressedByReason.component_child_limit += compact.childrenTruncated;
  }
  return compact;
}

function getFrameRoots(frame) {
  if (Array.isArray(frame && frame.children)) return frame.children;
  if (Array.isArray(frame && frame.nodes)) return frame.nodes;
  if (frame && frame.document) return [frame.document];
  return [];
}

function buildInitialComponents(frames, policy, diagnostics) {
  const byState = [];
  for (const frame of frames) {
    const roots = getFrameRoots(frame)
      .map((node) => compactNode(node, policy, diagnostics))
      .filter(Boolean);
    if (roots.length) byState.push({ state: frame.state || "default", roots: roots.slice(0, policy.maxRootsPerState) });
    if (roots.length > policy.maxRootsPerState) diagnostics.suppressedByReason.component_root_limit += roots.length - policy.maxRootsPerState;
  }
  return byState;
}

function collectLayoutValues(componentStates) {
  const values = { gap: new Map(), padding: new Map(), radius: new Map() };
  function visit(node) {
    if (node.layout && node.layout.gap) values.gap.set(node.layout.gap, (values.gap.get(node.layout.gap) || 0) + 1);
    if (node.layout && node.layout.padding) {
      for (const value of Object.values(node.layout.padding)) values.padding.set(value, (values.padding.get(value) || 0) + 1);
    }
    if (node.style && node.style.borderRadius) values.radius.set(node.style.borderRadius, (values.radius.get(node.style.borderRadius) || 0) + 1);
    for (const child of node.children || []) visit(child);
  }
  for (const state of componentStates) for (const root of state.roots) visit(root);
  return Object.fromEntries(Object.entries(values).map(([kind, occurrences]) => [kind, [...occurrences.entries()]
    .filter(([, count]) => count >= 2)
    .sort(([left], [right]) => Number.parseFloat(left) - Number.parseFloat(right))
    .map(([value], index) => ({ css: `--${kind}-${index + 1}`, value }))])
    .filter(([, tokens]) => tokens.length));
}

function normalizeRules(rules = []) {
  const seen = new Set();
  return rules
    .filter((rule) => rule && typeof rule.directive === "string" && rule.directive.trim())
    .map((rule, index) => ({
      id: rule.id || `rule-${index + 1}`,
      directive: rule.directive.trim(),
      priority: rule.priority || "required"
    }))
    .filter((rule) => {
      const key = `${rule.priority}:${rule.directive}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function longestSamples(values = [], limit = 3) {
  return values
    .filter((value) => typeof value === "string" && value.trim())
    .map((value) => value.trim())
    .sort((left, right) => right.length - left.length || left.localeCompare(right))
    .slice(0, limit);
}

function readLayoutNotes(page) {
  const sources = ["layoutNotes", "implementationNotes", "validationNotes"];
  const constraints = [];
  let suppressed = 0;

  for (const source of sources) {
    for (const note of page[source] || []) {
      if (LAYOUT_NOTE_PATTERN.test(note)) {
        constraints.push({
          description: note,
          source: `page.${source}`,
          confidence: "inferred"
        });
      } else {
        suppressed += 1;
      }
    }
  }

  return { constraints, suppressed };
}

function selectPages(raw, targets) {
  const pages = Array.isArray(raw.pages) ? raw.pages : [];
  if (!targets || targets.length === 0) {
    return pages.map((page) => ({ page, requestedStates: null }));
  }

  return targets.map((target) => {
    const page = pages.find((candidate) => candidate.id === target.screenId);
    assert(page, `Unknown target screen: ${target.screenId}`);
    return { page, requestedStates: target.states || null };
  });
}

function normalizeScreen(selection, diagnostics) {
  const { page, requestedStates } = selection;
  const allFrames = Array.isArray(page.frames) ? page.frames : [];
  const frames = requestedStates && requestedStates.length > 0
    ? allFrames.filter((frame) => requestedStates.includes(frame.state))
    : allFrames;

  if (requestedStates && requestedStates.length > 0) {
    diagnostics.suppressedByReason.unrequested_frame += allFrames.length - frames.length;
  }

  const notes = readLayoutNotes(page);
  diagnostics.suppressedByReason.non_layout_note += notes.suppressed;
  const contentSamples = longestSamples(page.keyContent, diagnostics.contentSampleLimit);
  diagnostics.suppressedByReason.non_constraint_content += Math.max(0, (page.keyContent || []).length - contentSamples.length);
  diagnostics.suppressedByReason.behavior_excluded += (page.interactions || []).length;
  const componentPolicy = diagnostics.componentPolicy;
  const initialComponents = buildInitialComponents(frames, componentPolicy, diagnostics);

  return {
    id: page.id,
    title: page.title || page.id,
    category: page.category || "unknown",
    layoutSummary: page.summary || null,
    frameEvidence: {
      source: "raw.pages.frames",
      confidence: "confirmed"
    },
    canonicalFrames: frames.map((frame) => ({
      nodeId: frame.nodeId,
      state: frame.state || "default",
      viewport: parseViewport(frame.viewport)
    })),
    regions: Array.isArray(page.layoutRegions) ? page.layoutRegions : undefined,
    ...(initialComponents.length ? { initialComponents: { byState: initialComponents } } : {}),
    inferredLayoutNotes: notes.constraints.map((constraint) => constraint.description),
    longestLabelSamples: contentSamples,
    responsive: {
      notInScope: []
    }
  };
}

function validateInput(raw, intake) {
  assert(raw && typeof raw === "object", "Raw design context must be an object");
  assert(Array.isArray(raw.pages), "Raw design context must contain pages");
  assert(intake && typeof intake === "object", "Intake must be an object");
  assert(intake.scope && intake.scope.mode === "static_layout", "Only scope.mode static_layout is supported");
}

function validateLayoutContext(context) {
  const required = ["schemaVersion", "kind", "provenance", "scope", "engineering", "design", "boundaries", "retrieval", "diagnostics"];
  for (const key of required) {
    assert(Object.prototype.hasOwnProperty.call(context, key), `Missing layout context field: ${key}`);
  }
  assert(context.schemaVersion === HOOK_VERSION, "Unexpected layout context schema version");
  assert(context.kind === "figma_layout_context", "Unexpected layout context kind");
  assert(Array.isArray(context.design.screens), "design.screens must be an array");
  return context;
}

function buildLayoutContext(raw, intake, options = {}) {
  validateInput(raw, intake);

  const inputFingerprint = fingerprint({ raw, intake, hookVersion: HOOK_VERSION });
  const previous = options.previousContext;
  if (previous && previous.provenance && previous.provenance.inputFingerprint === inputFingerprint && previous.provenance.status === "current") {
    return { context: previous, cacheHit: true, report: previous.diagnostics };
  }

  const diagnostics = {
    inputBytes: byteLength(raw),
    outputBytes: 0,
    contentSampleLimit: (intake.filterPolicy && intake.filterPolicy.maxContentSamples) || 3,
    componentPolicy: {
      excludeComponentDefinitions: !(intake.filterPolicy && intake.filterPolicy.excludeComponentDefinitions === false),
      maxComponentDepth: (intake.filterPolicy && intake.filterPolicy.maxComponentDepth) || 5,
      maxChildrenPerNode: (intake.filterPolicy && intake.filterPolicy.maxChildrenPerNode) || 12,
      maxRootsPerState: (intake.filterPolicy && intake.filterPolicy.maxRootsPerState) || 8,
      maxTextLength: (intake.filterPolicy && intake.filterPolicy.maxTextLength) || 80
    },
    suppressedByReason: {
      unselected_page: 0,
      unrequested_frame: 0,
      non_layout_note: 0,
      non_constraint_content: 0,
      behavior_excluded: 0,
      inferred_responsive_default: raw.responsiveFindings && raw.responsiveFindings.recommendedDefault ? 1 : 0,
      non_ui_or_design_node: 0,
      flattened_single_child_wrapper: 0,
      component_depth_limit: 0,
      component_child_limit: 0,
      component_root_limit: 0
    },
    unclassifiedCount: 0
  };

  const selected = selectPages(raw, intake.scope.targets || []);
  diagnostics.suppressedByReason.unselected_page = raw.pages.length - selected.length;
  const screens = selected.map((selection) => normalizeScreen(selection, diagnostics));
  delete diagnostics.componentPolicy;
  const confirmedColors = raw.designSystem && raw.designSystem.colors && raw.designSystem.colors.confirmedVariables || {};
  const textStyles = raw.designSystem && raw.designSystem.typography && raw.designSystem.typography.localTextStyles || [];
  const explicitBreakpoints = raw.responsiveFindings && raw.responsiveFindings.explicitBreakpoints || [];
  const componentStates = screens.flatMap((screen) => screen.initialComponents && screen.initialComponents.byState || []);

  const context = {
    schemaVersion: HOOK_VERSION,
    kind: "figma_layout_context",
    provenance: {
      rawArtifact: options.rawArtifact || null,
      rawFingerprint: fingerprint(raw),
      intakeFingerprint: fingerprint(intake),
      inputFingerprint,
      sourceMode: raw.meta && raw.meta.sourceMode || "unknown",
      capturedAt: raw.meta && raw.meta.capturedAt || null,
      status: "current"
    },
    scope: {
      mode: "static_layout",
      targets: screens.map((screen) => screen.id),
      viewportPolicy: intake.scope.viewportPolicy || "design_frames_only",
      outOfScope: ["interaction_behavior", "api_contract", "production_data_flow", "unapproved_responsive_defaults"]
    },
    engineering: {
      framework: intake.framework || {},
      codingRules: normalizeRules(intake.codingRules),
      sourceConventions: intake.sourceConventions || []
    },
    design: {
      shell: {
        components: raw.routingModel && raw.routingModel.sharedShell || [],
        source: "raw.routingModel.sharedShell",
        confidence: raw.routingModel && raw.routingModel.sharedShell ? "inferred" : "missing"
      },
      tokens: {
        evidence: "confirmed",
        web: {
          colors: normalizeColorTokens(confirmedColors),
          typography: normalizeTypographyTokens(textStyles),
          layout: collectLayoutValues(componentStates)
        }
      },
      assets: Array.isArray(raw.assets) ? raw.assets.map((asset) => ({ nodeId: asset.nodeId, name: asset.name || null, kind: asset.kind || "graphic", status: asset.status || "unknown", source: asset.source || "raw.assets" })) : [],
      responsiveEvidence: explicitBreakpoints.map((item) => ({ ...item, source: "raw.responsiveFindings.explicitBreakpoints", confidence: "confirmed" })),
      screens
    },
    boundaries: {
      assumptions: [],
      blockers: (raw.ambiguities || [])
        .filter((item) => /blocker/.test(item.decision || ""))
        .map((item) => ({ id: item.id, fact: item.topic, impact: item.impact, decision: item.decision, confidence: "confirmed" })),
      outOfScope: [
        ...(raw.responsiveFindings && raw.responsiveFindings.notShown || []).map((item) => ({ type: "viewport_not_shown", value: item })),
        ...(raw.responsiveFindings && raw.responsiveFindings.recommendedDefault ? [{ type: "inferred_default_excluded", value: raw.responsiveFindings.recommendedDefault }] : [])
      ]
    },
    retrieval: {
      sections: ["engineering", "design.shell", "design.tokens", "design.responsiveEvidence", "boundaries"],
      screenIndex: Object.fromEntries(screens.map((screen, index) => [screen.id, `design.screens.${index}`]))
    },
    diagnostics
  };

  for (const screen of screens) {
    context.retrieval.sections.push(context.retrieval.screenIndex[screen.id]);
  }

  for (let iteration = 0; iteration < 3; iteration += 1) {
    context.diagnostics.outputBytes = byteLength(context);
    context.diagnostics.payloadRatio = Number((context.diagnostics.outputBytes / context.diagnostics.inputBytes).toFixed(4));
    context.diagnostics.reductionPercent = Number(((1 - context.diagnostics.payloadRatio) * 100).toFixed(2));
    context.diagnostics.optimizationStatus = context.diagnostics.outputBytes < context.diagnostics.inputBytes
      ? "reduced"
      : "needs_target_narrowing";
  }
  validateLayoutContext(context);
  return { context, cacheHit: false, report: context.diagnostics };
}

module.exports = {
  HOOK_VERSION,
  buildLayoutContext,
  fingerprint,
  validateLayoutContext
};
