const assert = require("assert");
const test = require("node:test");
const { normalizeDesignArtifact } = require("../src/core");

test("normalizes one nested target frame and removes hidden, design-only, and vector nodes", () => {
  const collected = {
    kind: "figma_collected_artifact",
    meta: { sourceMode: "imported_json" },
    pages: [{
      id: "0:1",
      title: "Page 1",
      frames: [{
        nodeId: "0:1",
        state: "default",
        viewport: null,
        children: [{
          id: "57:99",
          name: "Products",
          type: "FRAME",
          absoluteBoundingBox: { width: 1400, height: 887 },
          children: [
            { id: "57:100", name: "Visible row", type: "FRAME", effects: [{ type: "DROP_SHADOW", visible: true, offset: { x: 0, y: 4 }, radius: 12, spread: 0, color: { r: 0, g: 0, b: 0, a: 0.16 } }] },
            { id: "57:101", name: "Hidden row", type: "FRAME", visible: false },
            { id: "57:102", name: "Measurement guide", type: "TEXT" },
            { id: "57:103", name: "Export", type: "VECTOR", absoluteBoundingBox: { width: 16, height: 16 } }
          ]
        }]
      }]
    }, {
      id: "9:9",
      title: "Unrelated",
      frames: [{ nodeId: "9:9", children: [{ id: "9:9", name: "Other", type: "FRAME" }] }]
    }]
  };

  const { artifact } = normalizeDesignArtifact(collected, { targetNodeId: "57:99" });
  assert.equal(artifact.kind, "normalized_design_artifact");
  assert.equal(artifact.pages.length, 1);
  assert.equal(artifact.pages[0].id, "57:99");
  assert.equal(artifact.pages[0].frames[0].viewport, "1400x887");
  assert.deepEqual(artifact.pages[0].frames[0].children[0].children.map((node) => node.id), ["57:100"]);
  assert.equal(artifact.pages[0].frames[0].children[0].children[0].effects[0].type, "DROP_SHADOW");
  assert.deepEqual(artifact.assets[0], { nodeId: "57:103", name: "Export", kind: "icon", status: "requires_export_or_library_mapping", source: "figma_node", width: 16, height: 16 });
});

test("keeps a declared sibling visual-state frame alongside the primary target", () => {
  const collected = { pages: [{ id: "page", frames: [{ nodeId: "root", children: [{ id: "root", type: "FRAME", name: "Root", children: [{ id: "base", type: "FRAME", name: "Base" }, { id: "menu-open", type: "FRAME", name: "Menu open", children: [{ id: "menu-surface", type: "RECTANGLE", name: "Surface", effects: [{ type: "DROP_SHADOW", visible: true }] }] }] }] }] }] };
  const { artifact } = normalizeDesignArtifact(collected, { targetNodeId: "base", stateNodeIds: ["menu-open", "menu-surface"] });
  const ids = JSON.stringify(artifact);
  assert(ids.includes("menu-open"));
  assert(ids.includes("menu-surface"));
  assert.equal(artifact.provenance.stateNodeIds.length, 2);
});
