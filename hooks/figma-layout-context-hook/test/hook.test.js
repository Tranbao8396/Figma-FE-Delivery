const assert = require("assert/strict");
const test = require("node:test");
const { buildLayoutContext, validateLayoutContext } = require("../src/hook");

function rawFixture() {
  return {
    meta: { sourceMode: "web_plus_mcp", capturedAt: "2026-09-14T00:00:00.000Z" },
    designSystem: {
      colors: { confirmedVariables: { primary: "#0063F2" } },
      typography: { localTextStyles: [{ name: "body", fontFamily: "Arial", fontSize: 14 }] }
    },
    routingModel: { sharedShell: ["Header", "Navigation"] },
    responsiveFindings: {
      explicitBreakpoints: [{ width: 1440, usage: "desktop" }],
      notShown: ["mobile"],
      recommendedDefault: "Stack the layout on mobile."
    },
    ambiguities: [{ id: "AMB-1", topic: "API data", impact: "data_shape", decision: "blocker_for_backend" }],
    pages: [
      {
        id: "members",
        title: "Members",
        category: "directory",
        summary: "Member table and cards.",
        frames: [
          { nodeId: "1:1", name: "Members desktop", viewport: "1440x1000", state: "default" },
          { nodeId: "1:2", name: "Members selected", viewport: "1440x1100", state: "selected" }
        ],
        keyContent: ["Short", "A long member name used to test overflow", "Medium label", "Another label"],
        interactions: ["Click profile", "Toggle status"],
        layoutNotes: ["Desktop uses a two-column card grid.", "Calls API after submit."],
        implementationNotes: ["Use a grid that collapses at the documented viewport."]
      },
      {
        id: "projects",
        title: "Projects",
        category: "projects",
        summary: "Project list.",
        frames: [{ nodeId: "2:1", name: "Projects", viewport: "1440x900", state: "default" }],
        keyContent: ["Project"],
        interactions: ["Delete project"]
      }
    ]
  };
}

function intake(targets = []) {
  return {
    scope: { mode: "static_layout", targets, viewportPolicy: "design_frames_only" },
    framework: { name: "react", version: "19", styling: "scss" },
    codingRules: [
      { id: "semantic", directive: "Use semantic landmarks.", priority: "required" },
      { id: "semantic-duplicate", directive: "Use semantic landmarks.", priority: "required" }
    ],
    filterPolicy: { maxContentSamples: 2 }
  };
}

test("build compacts a selected static screen and suppresses behavior", () => {
  const result = buildLayoutContext(rawFixture(), intake([{ screenId: "members", states: ["default"] }]));
  const context = result.context;

  assert.equal(result.cacheHit, false);
  assert.deepEqual(context.scope.targets, ["members"]);
  assert.equal(context.design.screens.length, 1);
  assert.equal(context.design.screens[0].canonicalFrames.length, 1);
  assert.equal(context.design.screens[0].longestLabelSamples.length, 2);
  assert.equal(context.design.screens[0].interactions, undefined);
  assert.equal(context.diagnostics.suppressedByReason.behavior_excluded, 2);
  assert.equal(context.diagnostics.suppressedByReason.unselected_page, 1);
  assert.equal(context.engineering.codingRules.length, 1);
  validateLayoutContext(context);
  assert.equal(typeof context.diagnostics.outputBytes, "number");
  assert.equal(typeof context.diagnostics.reductionPercent, "number");
  assert.equal(["reduced", "needs_target_narrowing"].includes(context.diagnostics.optimizationStatus), true);
});

test("build normalizes confirmed tokens for CSS and marks responsive defaults out of scope", () => {
  const context = buildLayoutContext(rawFixture(), intake()).context;

  assert.deepEqual(context.design.tokens.web.colors[0], {
    css: "--color-primary",
    value: "#0063F2",
    role: "primary"
  });
  assert.equal(context.design.tokens.web.typography[0].size, "14px");
  assert.equal(context.boundaries.outOfScope.some((item) => item.type === "inferred_default_excluded"), true);
  assert.equal(context.design.responsiveEvidence[0].width, 1440);
});

test("build strips design-only nodes, flattens neutral wrappers and summarizes visible vectors", () => {
  const raw = rawFixture();
  raw.pages[0].frames[0].children = [
    {
      id: "wrapper",
      name: "Group 1",
      type: "GROUP",
      children: [{
        id: "card",
        name: "Member card",
        type: "FRAME",
        layoutMode: "VERTICAL",
        itemSpacing: 16,
        paddingTop: 24,
        paddingRight: 24,
        paddingBottom: 24,
        paddingLeft: 24,
        cornerRadius: 8,
        children: [
          { id: "title", name: "Name", type: "TEXT", characters: "Member profile", fontSize: 16, fontWeight: 700 },
          { id: "icon", name: "Edit", type: "VECTOR", absoluteBoundingBox: { x: 48, y: 72, width: 20, height: 20 }, fills: [{ visible: true }] },
          { id: "hidden", name: "Hidden", type: "TEXT", visible: false, characters: "discard" },
          { id: "draft", name: "Spec annotation", type: "TEXT", characters: "discard" },
          { id: "library", name: "Design System Button", type: "COMPONENT", children: [] }
        ]
      }]
    }
  ];

  const context = buildLayoutContext(raw, intake([{ screenId: "members", states: ["default"] }])).context;
  const components = context.design.screens[0].initialComponents;
  const card = components.byState[0].roots[0];

  assert.equal(card.nodeId, "card");
  assert.equal(card.layout.display, "flex");
  assert.equal(card.layout.gap, "16px");
  assert.equal(card.children[1].vector.kind, "icon");
  assert.deepEqual(card.children[1].geometry, { x: "48px", y: "72px", width: "20px", height: "20px" });
  assert.equal(card.children.some((child) => child.nodeId === "hidden"), false);
  assert.equal(context.diagnostics.suppressedByReason.flattened_single_child_wrapper, 1);
  assert.equal(context.diagnostics.suppressedByReason.non_ui_or_design_node, 3);
  assert.equal(context.design.tokens.web.layout.gap, undefined);
});

test("missing raw node trees do not become inferred components", () => {
  const context = buildLayoutContext(rawFixture(), intake([{ screenId: "members", states: ["default"] }])).context;
  assert.equal(context.design.screens[0].initialComponents, undefined);
});

test("matching fingerprint returns a cache hit without rebuilding", () => {
  const first = buildLayoutContext(rawFixture(), intake());
  const second = buildLayoutContext(rawFixture(), intake(), { previousContext: first.context });

  assert.equal(second.cacheHit, true);
  assert.strictEqual(second.context, first.context);
});

test("unknown target screen fails before a context is emitted", () => {
  assert.throws(
    () => buildLayoutContext(rawFixture(), intake([{ screenId: "missing" }])),
    /Unknown target screen: missing/
  );
});

test("only static layout mode is accepted", () => {
  const invalid = intake();
  invalid.scope.mode = "interactive";
  assert.throws(() => buildLayoutContext(rawFixture(), invalid), /Only scope.mode static_layout is supported/);
});
