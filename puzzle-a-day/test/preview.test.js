import test from "node:test";
import assert from "node:assert/strict";
import { PIECES } from "../pieces.js";
import { placementCells, solve } from "../logic.js";
import { targetForDate } from "../board.js";
import { placementPreview, renderGhost } from "../preview.js";

function svgLayer() {
  const document = {
    createElementNS(namespace, tag) {
      return {
        namespace, tag, attributes: {},
        setAttribute(name, value) { this.attributes[name] = value; },
      };
    },
  };
  return {
    ownerDocument: document, children: [], attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    replaceChildren() { this.children = []; },
    append(node) { this.children.push(node); },
  };
}

const grid = { width: 344, height: 394, stepX: 49.4, stepY: 49.4, cellWidth: 47.4, cellHeight: 47.4 };
const targets = targetForDate(new Date(2026, 0, 1));

test("preview uses the same footprint and legality for every orientation", () => {
  for (const piece of PIECES) for (const flipX of [false, true]) for (let rotation = 0; rotation < 4; rotation++) {
    const origin = { x: 2, y: 2 };
    const preview = placementPreview(piece, origin, { rotation, flipX }, [], targets);
    assert.deepEqual(preview.cells, placementCells(piece, origin, { rotation, flipX }));
    assert.equal(preview.valid, true);
    assert.equal(placementPreview(piece, origin, { rotation, flipX },
      [{ id: "other", cells: [preview.cells[0]] }], targets).valid, false);
  }
});

test("SVG renders all five T ghost cells with explicit translucent fill and matching grid coordinates", () => {
  const origin = { x: 0, y: 1 };
  const preview = placementPreview(PIECES[0], origin, { rotation: 0 }, [], targets);
  const layer = svgLayer();
  renderGhost(layer, preview, origin, [1, 0], grid);
  assert.equal(layer.attributes.viewBox, "0 0 344 394");
  const rectangles = layer.children.filter(node => node.tag === "rect");
  assert.equal(rectangles.length, 5);
  for (const [index, node] of rectangles.entries()) {
    const [x, y] = preview.cells[index].split(",").map(Number);
    assert.equal(node.namespace, "http://www.w3.org/2000/svg");
    assert.equal(node.attributes["data-key"], preview.cells[index]);
    assert.equal(Number(node.attributes.x), x * grid.stepX + 1.5);
    assert.equal(Number(node.attributes.y), y * grid.stepY + 1.5);
    assert.ok(Number(node.attributes.width) > 40);
    assert.ok(Number(node.attributes.height) > 40);
    assert.equal(node.attributes.fill, "#36a46b");
    assert.equal(node.attributes["fill-opacity"], "0.65");
    assert.equal(node.attributes["stroke-width"], "3");
  }
  assert.equal(layer.children.at(-1).textContent, "⊕");
  assert.equal(Number(layer.children.at(-1).attributes.x), grid.stepX + grid.cellWidth / 2);
});

test("invalid off-board ghost stays complete, red and dashed; rerender replaces all prior cells", () => {
  const origin = { x: 6, y: 6 };
  const preview = placementPreview(PIECES[0], origin, { rotation: 0 }, [], targets);
  assert.equal(preview.valid, false);
  const layer = svgLayer();
  renderGhost(layer, preview, origin, [0, 0], grid);
  const rectangles = layer.children.filter(node => node.tag === "rect");
  assert.equal(rectangles.length, 5);
  assert.ok(rectangles.some(node => Number(node.attributes.x) > grid.width));
  assert.ok(rectangles.every(node => node.attributes.fill === "#e24b3e" && node.attributes["stroke-dasharray"] === "6 3"));
  const flipped = placementPreview(PIECES[1], { x: 1, y: 2 }, { rotation: 1, flipX: true }, [], targets);
  renderGhost(layer, flipped, { x: 1, y: 2 }, [0, 0], grid);
  assert.equal(layer.children.filter(node => node.tag === "rect").length, 4);
});

test("moving a piece previews without self-collision and never changes committed state", () => {
  const solution = solve(PIECES, targets);
  assert.equal(solution.ok, true);
  const item = solution.placements[0];
  const piece = PIECES.find(piece => piece.id === item.id);
  const before = JSON.stringify(solution.placements);
  const preview = placementPreview(piece, item.origin, item, solution.placements, targets);
  assert.equal(preview.valid, true);
  assert.deepEqual(preview.cells, item.cells);
  assert.equal(JSON.stringify(solution.placements), before);
});
