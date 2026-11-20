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

export function orientations(cells) {
  const unique = new Map();
  for (const flipX of [false, true]) {
    for (let rotation = 0; rotation < 4; rotation++) {
      const transformed = transform(cells, { rotation, flipX });
      const key = transformed.map(([x, y]) => `${x},${y}`).join(";");
      if (!unique.has(key)) unique.set(key, { rotation, flipX, cells: transformed });
    }
  }
  return [...unique.values()];
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

function makePlacements(pieces, targets) {
  const cells = [...CELL_BY_COORD.keys()];
  const cellIndex = new Map(cells.map((key, index) => [key, index]));
  const byCell = cells.map(() => []);
  const placements = [];
  pieces.forEach((piece, pieceIndex) => {
    for (const orientation of orientations(piece.cells)) {
      const width = Math.max(...orientation.cells.map(([x]) => x)) + 1;
      const height = Math.max(...orientation.cells.map(([, y]) => y)) + 1;
      for (let y = 0; y <= 8 - height; y++) {
        for (let x = 0; x <= 7 - width; x++) {
          const keys = orientation.cells.map(([dx, dy]) => `${x + dx},${y + dy}`);
          if (!keys.every(key => cellIndex.has(key) && !targets.has(key))) continue;
          let mask = 0n;
          for (const key of keys) mask |= 1n << BigInt(cellIndex.get(key));
          const placement = { id: piece.id, pieceIndex, origin: { x, y }, rotation: orientation.rotation, flipX: orientation.flipX, cells: keys, mask };
          placements.push(placement);
          for (const key of keys) byCell[cellIndex.get(key)].push(placement);
        }
      }
    }
  });
  return { cells, cellIndex, byCell, placements };
}

export function solve(pieces, targets, existing = []) {
  const targetSet = new Set(targets);
  if (targetSet.size !== 3 || [...targetSet].some(key => !CELL_BY_COORD.has(key))) {
    return { ok: false, reason: "Exactly three playable date cells are required." };
  }
  const totalArea = pieces.reduce((sum, piece) => sum + piece.cells.length, 0);
  if (totalArea !== CELL_BY_COORD.size - targetSet.size) {
    return { ok: false, reason: `Piece area is ${totalArea}, but ${CELL_BY_COORD.size - targetSet.size} cells must be covered.` };
  }

  const { cells, cellIndex, byCell } = makePlacements(pieces, targetSet);
  let occupied = 0n;
  let usedPieces = 0;
  const fixedPlacements = [];
  for (const item of existing) {
    const pieceIndex = pieces.findIndex(piece => piece.id === item.id);
    if (pieceIndex < 0 || (usedPieces & (1 << pieceIndex))) return { ok: false, reason: "The current placement uses an unknown or duplicate piece." };
    const keys = placementCells(pieces[pieceIndex], item.origin, { rotation: item.rotation, flipX: item.flipX });
    if (keys.some(key => !cellIndex.has(key) || targetSet.has(key))) return { ok: false, reason: "The current placement covers a target or invalid cell." };
    let mask = 0n;
    for (const key of keys) mask |= 1n << BigInt(cellIndex.get(key));
    if ((mask & occupied) !== 0n || (item.cells && (keys.length !== item.cells.length || keys.some(key => !item.cells.includes(key))))) {
      return { ok: false, reason: "The current placement overlaps or has invalid geometry." };
    }
    occupied |= mask;
    usedPieces |= 1 << pieceIndex;
    fixedPlacements.push({ ...item, cells: keys });
  }

  const solution = [...fixedPlacements];
  const memo = new Set();
  function search(covered, used) {
    if (used === (1 << pieces.length) - 1) return true;
    const memoKey = `${covered.toString(36)}:${used}`;
    if (memo.has(memoKey)) return false;
    let choices = null;
    for (let index = 0; index < cells.length; index++) {
      const bit = 1n << BigInt(index);
      if ((covered & bit) || targetSet.has(cells[index])) continue;
      const candidates = byCell[index].filter(item =>
        !(used & (1 << item.pieceIndex)) && (item.mask & covered) === 0n,
      );
      if (choices === null || candidates.length < choices.length) {
        choices = candidates;
        if (!choices.length) break;
      }
    }
    if (!choices?.length) {
      memo.add(memoKey);
      return false;
    }
    for (const item of choices) {
      solution.push({
        id: item.id,
        origin: item.origin,
        rotation: item.rotation,
        flipX: item.flipX,
        cells: item.cells,
      });
      if (search(covered | item.mask, used | (1 << item.pieceIndex))) return true;
      solution.pop();
    }
    memo.add(memoKey);
    return false;
  }

  if (!search(occupied, usedPieces)) return { ok: false, reason: "No solution exists for this date and current placement." };
  return { ok: true, placements: solution };
}

export function validateComplete(placements, targets, pieces) {
  const targetSet = new Set(targets);
  if (targetSet.size !== 3 || targetSet.size + pieces.reduce((sum, piece) => sum + piece.cells.length, 0) !== CELL_BY_COORD.size) return false;
  const piecesById = new Map(pieces.map(piece => [piece.id, piece]));
  if (placements.length !== pieces.length || new Set(placements.map(item => item.id)).size !== pieces.length) return false;
  const occupied = new Set();
  for (const item of placements) {
    const piece = piecesById.get(item.id);
    if (!piece || !Number.isInteger(item.rotation) || !item.origin) return false;
    const cells = placementCells(piece, item.origin, { rotation: item.rotation, flipX: item.flipX });
    if (cells.length !== piece.cells.length || (item.cells && (item.cells.length !== cells.length || cells.some(key => !item.cells.includes(key))))) return false;
    for (const key of cells) {
      if (!CELL_BY_COORD.has(key) || targetSet.has(key) || occupied.has(key)) return false;
      occupied.add(key);
    }
  }
  return occupied.size === CELL_BY_COORD.size - targetSet.size;
}
