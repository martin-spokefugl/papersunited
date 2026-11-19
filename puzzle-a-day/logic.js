import { CELL_BY_COORD } from "./board.js";

export function normalize(cells) {
  const minX = Math.min(...cells.map(([x]) => x));
  const minY = Math.min(...cells.map(([, y]) => y));
  return cells.map(([x, y]) => [x - minX, y - minY]).sort(([ax, ay], [bx, by]) => ay - by || ax - bx);
}

export function transform(cells, { rotation = 0, flipX = false, flipY = false } = {}) {
  let transformed = cells.map(([x, y]) => [flipX ? -x : x, flipY ? -y : y]);
  for (let turn = 0; turn < ((rotation % 4) + 4) % 4; turn++) {
    transformed = transformed.map(([x, y]) => [-y, x]);
  }
  return normalize(transformed);
}

export function placementCells(piece, origin, orientation = { rotation: 0 }) {
  return transform(piece.cells, orientation).map(([x, y]) => `${origin.x + x},${origin.y + y}`);
}

export function isLegalPlacement(piece, origin, occupied, targets, orientation) {
  const cells = placementCells(piece, origin, orientation);
  return cells.every(key => CELL_BY_COORD.has(key) && !occupied.has(key) && !targets.has(key));
}

export function isConnected(cells) {
  if (!cells.length) return false;
  const keys = new Set(cells.map(([x, y]) => `${x},${y}`));
  const seen = new Set([keys.values().next().value]);
  const stack = [...seen];
  while (stack.length) {
    const [x, y] = stack.pop().split(",").map(Number);
    for (const neighbor of [`${x + 1},${y}`, `${x - 1},${y}`, `${x},${y + 1}`, `${x},${y - 1}`]) {
      if (keys.has(neighbor) && !seen.has(neighbor)) {
        seen.add(neighbor);
        stack.push(neighbor);
      }
    }
  }
  return seen.size === keys.size;
}

export function solve(pieces, targets, existing = []) {
  const expected = CELL_BY_COORD.size - targets.size;
  const usedCells = new Set(existing.flatMap(item => item.cells));
  const remaining = pieces.filter(piece => !existing.some(item => item.id === piece.id));
  const area = existing.reduce((sum, item) => sum + item.cells.length, 0)
    + remaining.reduce((sum, piece) => sum + piece.cells.length, 0);
  if (area !== expected) {
    return { ok: false, reason: `Piece area is ${area}, but ${expected} cells must be covered.` };
  }
  if ([...usedCells].some(key => targets.has(key) || !CELL_BY_COORD.has(key)) || usedCells.size !== existing.reduce((n, item) => n + item.cells.length, 0)) {
    return { ok: false, reason: "The current placement is invalid." };
  }
  const remainingCells = CELL_BY_COORD.size - targets.size - usedCells.size;
  if (remaining.reduce((sum, piece) => sum + piece.cells.length, 0) !== remainingCells) {
    return { ok: false, reason: "The current placement cannot cover every remaining cell." };
  }
  const orientations = piece => {
    const unique = new Map();
    for (let rotation = 0; rotation < 4; rotation++) {
      const cells = transform(piece.cells, { rotation });
      unique.set(cells.map(([x, y]) => `${x},${y}`).join(";"), { rotation, cells });
    }
    return [...unique.values()];
  };
  const variants = new Map(remaining.map(piece => [piece.id, orientations(piece)]));
  const solution = existing.map(item => ({ ...item }));

  function search(covered, left) {
    if (left.length === 0) return covered.size === CELL_BY_COORD.size - targets.size;
    let chosen = null;
    let choices = null;
    for (const cell of CELL_BY_COORD.keys()) {
      if (targets.has(cell) || covered.has(cell)) continue;
      const [x, y] = cell.split(",").map(Number);
      const candidates = [];
      for (const piece of left) for (const orientation of variants.get(piece.id)) {
        for (const [px, py] of orientation.cells) {
          const origin = { x: x - px, y: y - py };
          const placed = orientation.cells.map(([cx, cy]) => `${origin.x + cx},${origin.y + cy}`);
          if (placed.every(key => CELL_BY_COORD.has(key) && !targets.has(key) && !covered.has(key))) {
            candidates.push({ piece, orientation, origin, placed });
          }
        }
      }
      if (choices === null || candidates.length < choices.length) {
        chosen = cell;
        choices = candidates;
        if (!choices.length) return false;
      }
    }
    if (!chosen) return false;
    for (const candidate of choices) {
      candidate.placed.forEach(key => covered.add(key));
      solution.push({ id: candidate.piece.id, origin: candidate.origin, rotation: candidate.orientation.rotation, cells: candidate.placed });
      if (search(covered, left.filter(piece => piece.id !== candidate.piece.id))) return true;
      solution.pop();
      candidate.placed.forEach(key => covered.delete(key));
    }
    return false;
  }

  if (!search(usedCells, remaining)) return { ok: false, reason: "No solution exists for this date and current placement." };
  return { ok: true, placements: solution };
}

export function validateComplete(placements, targets, pieces) {
  const piecesById = new Map(pieces.map(piece => [piece.id, piece]));
  const ids = placements.map(item => item.id);
  const cells = placements.flatMap(item => item.cells);
  const unique = new Set(cells);
  const accuratelyPlaced = placements.every(item => {
    const piece = piecesById.get(item.id);
    if (!piece || !item.origin || !Number.isInteger(item.rotation)) return false;
    const expected = placementCells(piece, item.origin, { rotation: item.rotation }).sort();
    return expected.length === item.cells.length && expected.join(";") === [...item.cells].sort().join(";");
  });
  return placements.length === pieces.length && new Set(ids).size === ids.length && accuratelyPlaced
    && unique.size === cells.length
    && cells.every(key => CELL_BY_COORD.has(key) && !targets.has(key))
    && unique.size + targets.size === CELL_BY_COORD.size;
}
