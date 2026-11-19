import { CELLS, ROWS, targetForDate } from "./board.js";
import { PIECES, PIECE_GEOMETRY_VERIFIED } from "./pieces.js";
import { isLegalPlacement, placementCells, solve, transform, validateComplete } from "./logic.js";
import { loadGame, loadStats, saveGame, saveStats } from "./storage.js";

const board = document.querySelector("#board");
const tray = document.querySelector("#tray");
const dateInput = document.querySelector("#challenge-date");
const challengeLabel = document.querySelector("#challenge-label");
const message = document.querySelector("#message");
const pieceById = new Map(PIECES.map(piece => [piece.id, piece]));
const today = new Date();
const localDate = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const saved = loadGame();
function isValidDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}
const state = {
  date: isValidDateString(saved?.date) ? saved.date : localDate(today),
  placements: Array.isArray(saved?.placements) ? saved.placements.filter(item =>
    item && typeof item === "object" && pieceById.has(item.id)
      && Array.isArray(item.cells) && item.cells.every(key => typeof key === "string")
      && Number.isInteger(item.rotation) && item.rotation >= 0 && item.rotation < 4
      && item.origin && Number.isInteger(item.origin.x) && Number.isInteger(item.origin.y),
  ) : [],
  selected: null,
  elapsed: Math.max(0, saved?.elapsed || 0),
  paused: saved?.paused ?? false,
  started: saved?.started ?? false,
  history: [],
  hints: 0,
};
const stats = loadStats();
let tick = Date.now();
let dragId = null;
const restoredTargets = targetForDate(currentDate());
const restoredIds = new Set();
const validRestored = [];
for (const item of state.placements) {
  const piece = pieceById.get(item.id);
  const expected = placementCells(piece, item.origin, { rotation: item.rotation });
  const cells = item.cells || expected;
  const occupied = new Set(validRestored.flatMap(placement => placement.cells));
  if (restoredIds.has(item.id) || expected.length !== cells.length
    || expected.some(key => !cells.includes(key))
    || !isLegalPlacement(piece, item.origin, occupied, restoredTargets, { rotation: item.rotation })) continue;
  restoredIds.add(item.id);
  validRestored.push({ id: item.id, origin: item.origin, rotation: item.rotation, cells: expected });
}
state.placements = validRestored;

function currentDate() {
  const [year, month, day] = state.date.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day ? today : date;
}

function snapshot() {
  state.history.push(JSON.stringify(state.placements));
  if (state.history.length > 50) state.history.shift();
}

function persist() {
  saveGame({ date: state.date, placements: state.placements, elapsed: state.elapsed, paused: state.paused, started: state.started });
  document.querySelector("#progress").textContent = `${state.placements.length} / 8 placed`;
}

function updateTimer() {
  document.querySelector("#timer").textContent = `${String(Math.floor(state.elapsed / 60)).padStart(2, "0")}:${String(Math.floor(state.elapsed % 60)).padStart(2, "0")}`;
}

function setMessage(text, kind = "") {
  message.textContent = text;
  message.className = kind;
}

function tile(className, label, key, target, occupied) {
  const cell = document.createElement("button");
  cell.type = "button";
  cell.className = `cell ${className}${target ? " target" : ""}${occupied ? " occupied" : ""}`;
  cell.dataset.key = key || "";
  cell.setAttribute("aria-label", `${label || "Unavailable"}${target ? ", date marker" : ""}${occupied ? ", piece placed" : ""}`);
  cell.textContent = label || "";
  if (!key) { cell.disabled = true; cell.setAttribute("aria-hidden", "true"); }
  return cell;
}

function renderBoard() {
  const targets = targetForDate(currentDate());
  const occupied = new Map(state.placements.flatMap(item => item.cells.map(key => [key, item.id])));
  board.replaceChildren();
  for (let y = 0; y < ROWS.length; y++) {
    for (let x = 0; x < 7; x++) {
      const cell = CELLS.find(item => item.x === x && item.y === y);
      const key = `${x},${y}`;
      const button = tile(cell ? "" : "blank", cell?.label, cell ? key : "", targets.has(key), occupied.has(key));
      if (occupied.has(key)) {
        const piece = pieceById.get(occupied.get(key));
        button.style.setProperty("--piece-color", piece.color);
        button.title = `${piece.name}; activate to return it to the tray`;
      }
      board.append(button);
    }
  }
}

function renderPiece(piece, rotation = 0) {
  const cells = transform(piece.cells, { rotation });
  const width = Math.max(...cells.map(([x]) => x)) + 1;
  const height = Math.max(...cells.map(([, y]) => y)) + 1;
  const preview = document.createElement("span");
  preview.className = "piece-preview";
  preview.style.gridTemplateColumns = `repeat(${width}, 18px)`;
  preview.style.gridTemplateRows = `repeat(${height}, 18px)`;
  cells.forEach(([x, y]) => {
    const square = document.createElement("i");
    square.style.gridColumn = String(x + 1);
    square.style.gridRow = String(y + 1);
    square.style.backgroundColor = piece.color;
    preview.append(square);
  });
  return preview;
}

function renderTray() {
  const placed = new Set(state.placements.map(item => item.id));
  tray.replaceChildren();
  for (const piece of PIECES) {
    if (placed.has(piece.id)) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `piece${state.selected === piece.id ? " selected" : ""}`;
    button.dataset.piece = piece.id;
    button.setAttribute("aria-pressed", String(state.selected === piece.id));
    button.setAttribute("aria-label", `${piece.name}, ${piece.cells.length} squares`);
    button.draggable = true;
    button.append(renderPiece(piece, state.selected === piece.id ? selectedRotation : 0));
    const label = document.createElement("span");
    label.textContent = piece.name;
    button.append(label);
    tray.append(button);
  }
}

let selectedRotation = 0;
function render() {
  const date = currentDate();
  dateInput.value = state.date;
  challengeLabel.textContent = date.toLocaleDateString("en", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  renderBoard();
  renderTray();
  document.querySelector("#progress").textContent = `${state.placements.length} / 8 placed`;
  updateTimer();
  document.querySelector("#pause").textContent = state.paused ? "Resume timer" : "Pause timer";
  document.querySelector("#stats").textContent = `${stats.completedDates.length} completed · Best: ${stats.bestSeconds == null ? "—" : `${Math.floor(stats.bestSeconds / 60)}:${String(stats.bestSeconds % 60).padStart(2, "0")}`}`;
  persist();
}

function tryPlace(pieceId, key) {
  const [x, y] = key.split(",").map(Number);
  const piece = pieceById.get(pieceId);
  const targets = targetForDate(currentDate());
  const occupied = new Set(state.placements.flatMap(item => item.cells));
  const orientation = { rotation: selectedRotation };
  if (!isLegalPlacement(piece, { x, y }, occupied, targets, orientation)) {
    setMessage("That placement is not valid. Choose an uncovered, non-target square.", "error");
    return;
  }
  snapshot();
  const cells = placementCells(piece, { x, y }, orientation);
  state.placements.push({ id: pieceId, origin: { x, y }, rotation: selectedRotation, cells });
  state.selected = null;
  selectedRotation = 0;
  state.started = true;
  render();
  const totalArea = PIECES.reduce((sum, item) => sum + item.cells.length, 0);
  if (state.placements.length === PIECES.length && validateComplete(state.placements, targets, PIECES)) {
    state.paused = true;
    tick = Date.now();
    render();
    setMessage("Puzzle complete! Great work.", "success");
    if (!stats.completedDates.includes(state.date)) stats.completedDates.push(state.date);
    stats.bestSeconds = stats.bestSeconds == null ? state.elapsed : Math.min(stats.bestSeconds, state.elapsed);
    saveStats(stats);
    document.querySelector("#stats").textContent = `${stats.completedDates.length} completed · Best: ${Math.floor(stats.bestSeconds / 60)}:${String(stats.bestSeconds % 60).padStart(2, "0")}`;
  } else if (state.placements.length === PIECES.length) {
    setMessage(`All pieces placed, but the board cannot be complete: the traced pieces cover ${totalArea} cells.`, "error");
  } else {
    setMessage(`${piece.name} placed. Select a piece and choose its top-left board square.`);
  }
}

function returnPiece(id) {
  snapshot();
  state.placements = state.placements.filter(item => item.id !== id);
  state.selected = id;
  selectedRotation = 0;
  render();
  setMessage(`${pieceById.get(id).name} returned to the tray.`);
}

function rotate(direction) {
  if (!state.selected) { setMessage("Select a piece in the tray first."); return; }
  selectedRotation = (selectedRotation + direction + 4) % 4;
  renderTray();
}

dateInput.addEventListener("change", () => {
  const value = dateInput.value;
  if (!value) return;
  const [year, month, day] = value.split("-").map(Number);
  const check = new Date(year, month - 1, day);
  if (check.getFullYear() !== year || check.getMonth() !== month - 1 || check.getDate() !== day) {
    setMessage("Choose a valid calendar date.", "error");
    return;
  }
  state.date = value;
  state.placements = [];
  state.history = [];
  state.elapsed = 0;
  state.paused = false;
  state.started = false;
  state.selected = null;
  selectedRotation = 0;
  setMessage("New date selected. Arrange the pieces around its three markers.");
  render();
});

tray.addEventListener("click", event => {
  const button = event.target.closest("[data-piece]");
  if (!button) return;
  state.selected = button.dataset.piece;
  selectedRotation = 0;
  state.started = true;
  tick = Date.now();
  persist();
  renderTray();
  setMessage(`${pieceById.get(state.selected).name} selected. Tap a board square to place it.`);
});

board.addEventListener("click", event => {
  const cell = event.target.closest("[data-key]");
  if (!cell?.dataset.key) return;
  const placed = state.placements.find(item => item.cells.includes(cell.dataset.key));
  if (placed) { returnPiece(placed.id); return; }
  if (state.selected) tryPlace(state.selected, cell.dataset.key);
});

tray.addEventListener("dragstart", event => {
  const button = event.target.closest("[data-piece]");
  if (!button) return;
  dragId = button.dataset.piece;
  state.selected = dragId;
  selectedRotation = 0;
  event.dataTransfer.setData("text/plain", dragId);
  event.dataTransfer.effectAllowed = "move";
});
board.addEventListener("dragover", event => { if (dragId) event.preventDefault(); });
board.addEventListener("drop", event => {
  event.preventDefault();
  const cell = event.target.closest("[data-key]");
  if (dragId && cell?.dataset.key) tryPlace(dragId, cell.dataset.key);
  dragId = null;
});

document.querySelector("#rotate-cw").addEventListener("click", () => rotate(1));
document.querySelector("#rotate-ccw").addEventListener("click", () => rotate(3));
document.querySelector("#undo").addEventListener("click", () => {
  const previous = state.history.pop();
  if (!previous) { setMessage("Nothing to undo."); return; }
  state.placements = JSON.parse(previous);
  render();
  setMessage("Last placement undone.");
});
document.querySelector("#reset").addEventListener("click", () => {
  snapshot();
  state.placements = [];
  state.selected = null;
  state.history = [];
  state.elapsed = 0;
  state.started = false;
  state.paused = false;
  state.hints = 0;
  render();
  setMessage("Puzzle reset.");
});
document.querySelector("#hint").addEventListener("click", () => {
  state.hints++;
  const result = solve(PIECES, targetForDate(currentDate()), state.placements);
  if (!result.ok) {
    setMessage(`No verified hint is available: ${result.reason}`, "error");
    return;
  }
  const next = result.placements.find(item => !state.placements.some(placed => placed.id === item.id));
  if (state.hints === 1) setMessage(`Hint: ${pieceById.get(next.id).name} fits somewhere near ${next.cells[0]}.`);
  else if (state.hints === 2) {
    board.querySelectorAll(".hint").forEach(cell => cell.classList.remove("hint"));
    next.cells.forEach(key => board.querySelector(`[data-key="${key}"]`)?.classList.add("hint"));
    setMessage(`Try placing ${pieceById.get(next.id).name} in the highlighted area.`);
  } else {
    board.querySelectorAll(".hint").forEach(cell => cell.classList.remove("hint"));
    next.cells.forEach(key => board.querySelector(`[data-key="${key}"]`)?.classList.add("hint", "hint-solution"));
    setMessage(`Place ${pieceById.get(next.id).name} at ${next.origin.x + 1}, ${next.origin.y + 1}; orientation ${next.rotation * 90}°.`);
  }
});
document.querySelector("#solution").addEventListener("click", () => {
  if (!window.confirm("Showing a solution ends this attempt. Continue?")) return;
  const result = solve(PIECES, targetForDate(currentDate()), []);
  if (!result.ok || !validateComplete(result.placements, targetForDate(currentDate()), PIECES)) {
    setMessage(`No verified solution is available: ${result.reason || "The solver result failed validation."}`, "error");
    return;
  }
  state.placements = result.placements;
  state.selected = null;
  state.hints++;
  state.paused = true;
  tick = Date.now();
  render();
  setMessage("Verified solution shown. This attempt was solved with assistance.", "success");
});
document.querySelector("#pause").addEventListener("click", () => {
  state.paused = !state.paused;
  tick = Date.now();
  render();
});
document.addEventListener("keydown", event => {
  if (event.target.matches("input")) return;
  if (event.key.toLowerCase() === "r") { rotate(event.shiftKey ? 3 : 1); }
  if (event.key === "Escape" && state.selected) {
    state.selected = null;
    selectedRotation = 0;
    renderTray();
    setMessage("Piece selection cleared.");
  }
});

setInterval(() => {
  if (!state.paused && state.started) {
    const now = Date.now();
    state.elapsed += Math.max(0, (now - tick) / 1000);
    tick = now;
    updateTimer();
    persist();
  }
}, 1000);
document.addEventListener("visibilitychange", () => { tick = Date.now(); });

document.querySelector("#geometry-warning").textContent = PIECE_GEOMETRY_VERIFIED
  ? ""
  : `Geometry check needed: the supplied photo can only be traced to ${PIECES.reduce((sum, piece) => sum + piece.cells.length, 0)} squares, but the brief requires 49 piece cells. The provided board rows list ${CELLS.length} cells, not 52. Rotation and placement controls work, but completion, hints and solutions are blocked by this mismatch.`;

render();
if (saved) setMessage("Saved puzzle restored. Check placements or reset to start over.");
