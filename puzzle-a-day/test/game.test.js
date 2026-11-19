import test from "node:test";
import assert from "node:assert/strict";
import { CELLS, ROWS, targetForDate } from "../board.js";
import { PIECES } from "../pieces.js";
import { isConnected, isLegalPlacement, normalize, transform, validateComplete, solve } from "../logic.js";

test("board labels and coordinates follow the supplied calendar layout", () => {
  assert.equal(CELLS.length, 50);
  assert.deepEqual(ROWS[0], ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]);
  assert.deepEqual(ROWS[1], ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]);
  assert.deepEqual(ROWS[6], ["29", "30", "31", "Sun", "Mon", "Tues", "Wed"]);
  assert.deepEqual(ROWS[7], [null, null, null, null, "Thu", "Fri", "Sat"]);
  assert.equal(CELLS.some(cell => cell.x === 0 && cell.y === 7), false);
});

test("calendar dates map to three distinct marker cells", () => {
  for (const date of [new Date(2026, 0, 1), new Date(2024, 1, 29), new Date(2026, 11, 31)]) {
    assert.equal(targetForDate(date).size, 3);
  }
  const weekdays = Array.from({ length: 7 }, (_, day) => targetForDate(new Date(2026, 0, 4 + day)));
  assert.equal(new Set(weekdays.map(targets => [...targets].find(key => Number(key.split(",")[1]) >= 6))).size, 7);
});

test("photo-traced pieces are connected, normalized, and rotate in four orientations", () => {
  assert.equal(PIECES.length, 8);
  for (const piece of PIECES) {
    assert.equal(new Set(piece.cells.map(cell => cell.join(","))).size, piece.cells.length);
    assert.ok(isConnected(piece.cells), `${piece.id} should be connected`);
    assert.deepEqual(normalize(transform(piece.cells, { rotation: 4 })), normalize(piece.cells));
  }
  assert.equal(PIECES.reduce((total, piece) => total + piece.cells.length, 0), 41);
});

test("placement rejects targets, invalid cells, and collisions", () => {
  const piece = PIECES[0];
  const occupied = new Set(["0,0"]);
  const target = new Set(["1,0"]);
  assert.equal(isLegalPlacement(piece, { x: 0, y: 0 }, new Set(), target), false);
  assert.equal(isLegalPlacement(piece, { x: 0, y: 0 }, occupied, new Set()), false);
  assert.equal(isLegalPlacement(piece, { x: 5, y: 0 }, new Set(), new Set()), false);
  assert.equal(isLegalPlacement(piece, { x: 2, y: 2 }, new Set(), new Set()), true);
});

test("solver reports the source-data area mismatch rather than inventing a solution", () => {
  const result = solve(PIECES, targetForDate(new Date(2026, 0, 1)));
  assert.equal(result.ok, false);
  assert.match(result.reason, /area is 41.*47 cells must be covered/);
  assert.equal(validateComplete([], new Set(), PIECES), false);
});
