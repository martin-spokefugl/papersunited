import test from "node:test";
import assert from "node:assert/strict";
import { CELLS, ROWS, targetForDate } from "../board.js";
import { PIECES } from "../pieces.js";
import { isConnected, isLegalPlacement, normalize, orientations, placementCells, solve, transform, validateComplete } from "../logic.js";

test("board has 50 playable month, date, and weekday cells", () => {
  assert.equal(CELLS.length, 50);
  assert.equal(CELLS.filter(cell => cell.y < 2).length, 12);
  assert.equal(CELLS.filter(cell => cell.y >= 2 && cell.y <= 6 && cell.x < 7).filter(cell => /^\d+$/.test(cell.label)).length, 31);
  assert.equal(CELLS.filter(cell => ["Sun", "Mon", "Tues", "Wed", "Thu", "Fri", "Sat"].includes(cell.label)).length, 7);
  assert.deepEqual(ROWS[0], ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]);
  assert.deepEqual(ROWS[1], ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]);
  assert.deepEqual(ROWS[6], ["29", "30", "31", "Sun", "Mon", "Tues", "Wed"]);
  assert.deepEqual(ROWS[7], [null, null, null, null, "Thu", "Fri", "Sat"]);
  assert.deepEqual(CELLS.filter(cell => !cell.label).map(cell => `${cell.x},${cell.y}`), []);
  assert.equal(CELLS.some(cell => cell.x === 6 && cell.y < 2), false);
  assert.equal(CELLS.some(cell => cell.y === 7 && cell.x < 4), false);
});

test("date markers identify one month, date, and weekday including leap day", () => {
  for (const date of [new Date(2026, 0, 1), new Date(2026, 1, 28), new Date(2028, 1, 29), new Date(2026, 11, 31)]) {
    const targets = targetForDate(date);
    assert.equal(targets.size, 3);
    assert.ok(targets.has(`${date.getMonth() % 6},${Math.floor(date.getMonth() / 6)}`));
    assert.ok(targets.has(`${(date.getDate() - 1) % 7},${2 + Math.floor((date.getDate() - 1) / 7)}`));
  }
  const weekdays = Array.from({ length: 7 }, (_, day) => targetForDate(new Date(2026, 0, 4 + day)));
  const weekdayCells = weekdays.map(targets => [...targets].find(key => Number(key.split(",")[1]) >= 6));
  assert.equal(new Set(weekdayCells).size, 7);
});

test("ten supplied pieces are connected, unique, and total 47 cells", () => {
  const expectedShapes = [
    ["XXX", ".X.", ".X."],
    ["XX.", ".XX"],
    ["XXX", "X.X"],
    ["..XX", "XXX."],
    ["XXX", "..X", "..X"],
    [".X", ".X", "XX"],
    [".XX", ".X.", "XX."],
    ["XX", ".X", ".X", ".X"],
    ["X", "X", "X", "X"],
    [".X", "XX", "XX"],
  ];
  assert.equal(PIECES.length, 10);
  assert.equal(new Set(PIECES.map(piece => piece.id)).size, 10);
  assert.equal(PIECES.reduce((sum, piece) => sum + piece.cells.length, 0), 47);
  for (const [index, piece] of PIECES.entries()) {
    assert.equal(new Set(piece.cells.map(cell => cell.join(","))).size, piece.cells.length, piece.id);
    assert.ok(isConnected(piece.cells), piece.id);
    assert.deepEqual(normalize(piece.cells), normalize(transform(piece.cells, { rotation: 4 })));
    const shape = normalize(piece.cells);
    const width = Math.max(...shape.map(([x]) => x)) + 1;
    const height = Math.max(...shape.map(([, y]) => y)) + 1;
    assert.deepEqual(
      Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) =>
        shape.some(([cellX, cellY]) => cellX === x && cellY === y) ? "X" : ".",
      ).join("")),
      expectedShapes[index],
      piece.id,
    );
  }
});

test("rotations and reflections normalize and remove duplicate orientations", () => {
  for (const piece of PIECES) {
    const variants = orientations(piece.cells);
    const signatures = variants.map(variant => variant.cells.map(cell => cell.join(",")).join(";"));
    assert.equal(new Set(signatures).size, variants.length, `${piece.id} duplicate orientation`);
    assert.ok(variants.length >= 1 && variants.length <= 8);
    assert.deepEqual(transform(piece.cells, { rotation: 1 }), transform(piece.cells, { rotation: 5 }));
    assert.deepEqual(transform(piece.cells, { flipX: true, rotation: 4 }), transform(piece.cells, { flipX: true }));
  }
  assert.notDeepEqual(transform(PIECES[1].cells), transform(PIECES[1].cells, { flipX: true }));
});

test("placements reject targets, overlaps, and off-board cells", () => {
  const piece = PIECES[0];
  const target = new Set(["3,2"]);
  assert.equal(isLegalPlacement(piece, { x: 2, y: 2 }, new Set(), target, { rotation: 0 }), false);
  assert.equal(isLegalPlacement(piece, { x: 2, y: 2 }, new Set(["2,2"]), new Set(), { rotation: 0 }), false);
  assert.equal(isLegalPlacement(piece, { x: 5, y: 7 }, new Set(), new Set(), { rotation: 0 }), false);
  assert.equal(isLegalPlacement(piece, { x: 2, y: 2 }, new Set(), new Set(), { rotation: 0 }), true);
  assert.equal(placementCells(piece, { x: 2, y: 2 }, { rotation: 1 }).length, 5);
});

const representativeDates = [
  new Date(2026, 0, 1),
  new Date(2026, 1, 28),
  new Date(2028, 1, 29),
  new Date(2026, 5, 15),
  new Date(2026, 10, 20),
  new Date(2026, 11, 31),
  ...Array.from({ length: 7 }, (_, day) => new Date(2026, 0, 4 + day)),
];

test("solver finds independently validated solutions for required dates and each weekday", () => {
  for (const date of representativeDates) {
    const targets = targetForDate(date);
    const result = solve(PIECES, targets);
    assert.equal(result.ok, true, `${date.toDateString()}: ${result.reason}`);
    assert.equal(result.placements.length, 10);
    assert.ok(validateComplete(result.placements, targets, PIECES));
  }
});

test("solver supports valid partial placements and rejects invalid current states", () => {
  const targets = targetForDate(new Date(2026, 10, 20));
  const full = solve(PIECES, targets);
  assert.equal(full.ok, true);
  const partial = solve(PIECES, targets, [full.placements[0]]);
  assert.equal(partial.ok, true);
  assert.ok(validateComplete(partial.placements, targets, PIECES));
  assert.equal(solve(PIECES, targets, [full.placements[0], full.placements[0]]).ok, false);
  assert.equal(validateComplete([...full.placements, full.placements[0]], targets, PIECES), false);
  const overlap = full.placements.map(item => ({ ...item, cells: [...item.cells] }));
  overlap[1] = { ...overlap[1], cells: overlap[0].cells };
  assert.equal(validateComplete(overlap, targets, PIECES), false);
  assert.equal(validateComplete([], targets, PIECES), false);
});

test("solver finds verified tilings for every date in 2026 and leap-year 2028", () => {
  for (const year of [2026, 2028]) {
    const days = new Date(year, 1, 29).getMonth() === 1 ? 366 : 365;
    for (let day = 0; day < days; day++) {
      const date = new Date(year, 0, 1 + day);
      const targets = targetForDate(date);
      const result = solve(PIECES, targets);
      assert.equal(result.ok, true, `${date.toISOString().slice(0, 10)}: ${result.reason}`);
      assert.ok(validateComplete(result.placements, targets, PIECES), date.toISOString());
    }
  }
});
