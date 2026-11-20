import { CELLS, ROWS, targetForDate } from "./board.js";
import { PIECES } from "./pieces.js";
import { isLegalPlacement, placementCells, solve, transform, validateComplete } from "./logic.js";
import { loadGame, loadStats, saveGame, saveStats } from "./storage.js";

const board = document.querySelector("#board");
const tray = document.querySelector("#tray");
const dateInput = document.querySelector("#challenge-date");
const message = document.querySelector("#message");
const pieceById = new Map(PIECES.map(piece => [piece.id, piece]));
const today = new Date();
const localDate = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const saved = loadGame();
const stats = loadStats();

function isValidDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function currentDate() {
  const [year, month, day] = state.date.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return isValidDateString(state.date) ? date : today;
}

const state = {
  date: isValidDateString(saved?.date) ? saved.date : localDate(today),
  placements: Array.isArray(saved?.placements) ? saved.placements.filter(item =>
    item && typeof item === "object" && pieceById.has(item.id)
      && Array.isArray(item.cells) && item.cells.every(key => typeof key === "string")
      && Number.isInteger(item.rotation) && item.rotation >= 0 && item.rotation < 4
      && typeof item.flipX === "boolean"
      && item.origin && Number.isInteger(item.origin.x) && Number.isInteger(item.origin.y),
  ) : [],
  selected: null,
  rotation: 0,
  flipX: false,
  elapsed: Number.isFinite(saved?.elapsed) ? Math.max(0, saved.elapsed) : 0,
  paused: saved?.paused === true,
  started: saved?.started === true,
  hintsUsed: Number.isInteger(saved?.hintsUsed) ? Math.max(0, saved.hintsUsed) : 0,
  assisted: saved?.assisted === true,
  completed: saved?.completed === true,
  history: [],
};
let tick = Date.now();
let previewOrigin = null;
let previewAnchor = [0, 0];
let touchPreview = false;
let drag = null;
let suppressClick = false;
let lastPointerType = "mouse";
const previewLayer = document.querySelector("#placement-preview");
const previewStatus = document.querySelector("#preview-status");
const restoredTargets = targetForDate(currentDate());
const restoredIds = new Set();
const restored = [];
for (const item of state.placements) {
  const piece = pieceById.get(item.id);
  const expected = placementCells(piece, item.origin, { rotation: item.rotation, flipX: item.flipX });
  const occupied = new Set(restored.flatMap(placement => placement.cells));
  if (restoredIds.has(item.id) || expected.length !== item.cells.length
    || expected.some(key => !item.cells.includes(key))
    || !isLegalPlacement(piece, item.origin, occupied, restoredTargets, { rotation: item.rotation, flipX: item.flipX })) continue;
  restoredIds.add(item.id);
  restored.push({ ...item, cells: expected });
}
state.placements = restored;
if (state.completed && !validateComplete(state.placements, restoredTargets, PIECES)) {
  state.completed = false;
  state.assisted = false;
}

function snapshot() {
  state.history.push(JSON.stringify(state.placements));
  if (state.history.length > 50) state.history.shift();
}

function persist() {
  saveGame({
    date: state.date,
    placements: state.placements,
    elapsed: state.elapsed,
    paused: state.paused,
    started: state.started,
    hintsUsed: state.hintsUsed,
    assisted: state.assisted,
    completed: state.completed,
  });
  document.querySelector("#progress").textContent = `${state.placements.length} / ${PIECES.length} brikker`;
}

function timeText(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function updateTimer() {
  document.querySelector("#timer").textContent = timeText(state.elapsed);
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
  cell.setAttribute("aria-label", `${label || "Ikke spillbar"}${target ? ", dagens synlige dato" : ""}${occupied ? ", brikke plassert" : ""}`);
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
        button.title = `${piece.name}; trykk for å ta brikken tilbake`;
      }
      board.append(button);
    }
  }
}

function renderPiece(piece, rotation = 0, flipX = false) {
  const cells = transform(piece.cells, { rotation, flipX });
  const width = Math.max(...cells.map(([x]) => x)) + 1;
  const height = Math.max(...cells.map(([, y]) => y)) + 1;
  const preview = document.createElement("span");
  preview.className = "piece-preview";
  preview.style.gridTemplateColumns = `repeat(${width}, 16px)`;
  preview.style.gridTemplateRows = `repeat(${height}, 16px)`;
  cells.forEach(([x, y]) => {
    const square = document.createElement("i");
    square.style.gridColumn = String(x + 1);
    square.style.gridRow = String(y + 1);
    square.style.backgroundColor = piece.color;
    square.setAttribute("aria-hidden", "true");
    square.dataset.x = x;
    square.dataset.y = y;
    preview.append(square);
  });
  return preview;
}

function renderTray() {
  const focusedPiece = document.activeElement?.closest?.("[data-piece]")?.dataset.piece;
  const placed = new Set(state.placements.map(item => item.id));
  tray.replaceChildren();
  for (const piece of PIECES) {
    if (placed.has(piece.id)) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `piece${state.selected === piece.id ? " selected" : ""}${state.hintPiece === piece.id ? " hint-piece" : ""}`;
    button.dataset.piece = piece.id;
    button.setAttribute("aria-pressed", String(state.selected === piece.id));
    button.setAttribute("aria-label", `${piece.name}, ${piece.cells.length} ruter`);
    button.append(renderPiece(piece, state.selected === piece.id ? state.rotation : 0, state.selected === piece.id && state.flipX));
    const label = document.createElement("span");
    label.textContent = piece.name;
    button.append(label);
    tray.append(button);
  }
  if (focusedPiece) tray.querySelector(`[data-piece="${focusedPiece}"]`)?.focus({ preventScroll: true });
}

function streakStats() {
  const wins = stats.completedDates.filter(item => !item.assisted && item.hints === 0).map(item => item.date);
  const dates = new Set(wins);
  const todayKey = localDate(today);
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  let current = 0;
  let cursor = dates.has(todayKey) ? today : yesterday;
  while (dates.has(localDate(cursor))) {
    current++;
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1);
  }
  const sorted = [...dates].sort();
  let longest = 0;
  let run = 0;
  let previous = null;
  for (const key of sorted) {
    const date = new Date(`${key}T00:00:00Z`);
    const day = date.getTime() / 86400000;
    run = previous !== null && day === previous + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = day;
  }
  return { current, longest };
}

function renderStats() {
  const results = stats.completedDates;
  const best = results.filter(item => !item.assisted && item.hints === 0).reduce((value, item) => Math.min(value, item.seconds), Infinity);
  const average = results.length ? results.reduce((sum, item) => sum + item.seconds, 0) / results.length : null;
  const { current, longest } = streakStats();
  document.querySelector("#stats").textContent =
    `${results.length} løst · ${current} dagers rekke · lengste ${longest} · beste ${Number.isFinite(best) ? timeText(best) : "—"} · snitt ${average == null ? "—" : timeText(average)} · ${stats.totalHints} hint brukt`;
}

function render() {
  const date = currentDate();
  dateInput.value = state.date;
  document.querySelector("#challenge-label").textContent =
    date.toLocaleDateString("nb-NO", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  renderBoard();
  renderTray();
  drawPreview();
  document.querySelector("#progress").textContent = `${state.placements.length} / ${PIECES.length} brikker`;
  updateTimer();
  document.querySelector("#pause").textContent = state.paused ? "Fortsett tiden" : "Pause tiden";
  renderStats();
  persist();
}

function formattedElapsed(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  if (minutes === 0) return `${remainder} sekunder`;
  return `${minutes} ${minutes === 1 ? "minutt" : "minutter"} og ${remainder} sekunder`;
}

function completeGame(assisted = state.assisted) {
  if (state.completed || !validateComplete(state.placements, targetForDate(currentDate()), PIECES)) return false;
  state.completed = true;
  state.assisted = assisted;
  state.paused = true;
  tick = Date.now();
  const previous = stats.completedDates.find(item => item.date === state.date);
  const result = { date: state.date, seconds: state.elapsed, hints: state.hintsUsed, assisted };
  const isUnassisted = !assisted && state.hintsUsed === 0;
  const previousIsUnassisted = previous && !previous.assisted && previous.hints === 0;
  if (!previous || (isUnassisted && !previousIsUnassisted)
    || (isUnassisted === previousIsUnassisted && state.elapsed < previous.seconds)) {
    if (previous) stats.completedDates.splice(stats.completedDates.indexOf(previous), 1);
    stats.completedDates.push(result);
  }
  saveStats(stats);
  document.querySelector("#victory").hidden = false;
  document.querySelector("#victory-title").textContent = "Gratulerer! Du løste dagens utfordring!";
  document.querySelector("#victory-details").textContent =
    `Tiden din: ${formattedElapsed(state.elapsed)}.${assisted ? " Løsningen ble vist – denne runden teller som hjulpet." : state.hintsUsed ? ` Du brukte ${state.hintsUsed} hint.` : " Helt uten hint!"}`;
  render();
  setMessage(assisted ? "Puslespillet er løst med hjelp." : "Puslespillet er løst!", "success");
  return true;
}

function tryPlace(pieceId, key) {
  if (state.completed) return false;
  const [x, y] = key.split(",").map(Number);
  const piece = pieceById.get(pieceId);
  const targets = targetForDate(currentDate());
  const occupied = new Set(state.placements.filter(item => item.id !== pieceId).flatMap(item => item.cells));
  const orientation = { rotation: state.rotation, flipX: state.flipX };
  if (!isLegalPlacement(piece, { x, y }, occupied, targets, orientation)) {
    setMessage("Her får ikke brikken plass. Unngå målrutene og andre brikker.", "error");
    board.querySelector(`[data-key="${key}"]`)?.classList.add("invalid");
    window.setTimeout(() => board.querySelector(`[data-key="${key}"]`)?.classList.remove("invalid"), 320);
    return false;
  }
  snapshot();
  const cells = placementCells(piece, { x, y }, orientation);
  state.placements = state.placements.filter(item => item.id !== pieceId);
  state.placements.push({ id: pieceId, origin: { x, y }, rotation: state.rotation, flipX: state.flipX, cells });
  state.selected = null;
  state.rotation = 0;
  state.flipX = false;
  clearPreview();
  if (!state.started) tick = Date.now();
  state.started = true;
  render();
  if (state.placements.length === PIECES.length) {
    if (!completeGame(state.assisted)) setMessage("Alle brikkene er lagt, men brettet stemmer ikke helt ennå.", "error");
  } else {
    setMessage(`${piece.name} plassert. Fortsett med neste brikke.`);
  }
  return true;
}

function returnPiece(id) {
  if (state.completed) return;
  const item = state.placements.find(placement => placement.id === id);
  snapshot();
  state.placements = state.placements.filter(placement => placement.id !== id);
  state.selected = id;
  state.rotation = item.rotation;
  state.flipX = item.flipX;
  render();
  setMessage(`${pieceById.get(id).name} tilbake på brikkebrettet.`);
}

function rotate(direction) {
  if (!state.selected || state.completed) { setMessage("Velg en brikke først."); return; }
  state.rotation = (state.rotation + direction + 4) % 4;
  renderTray();
  drawPreview(true);
}

function flip() {
  if (!state.selected || state.completed) { setMessage("Velg en brikke først."); return; }
  state.flipX = !state.flipX;
  renderTray();
  drawPreview(true);
}

function clearPreview() {
  previewOrigin = null;
  touchPreview = false;
  hidePreview();
}

function hidePreview() {
  previewLayer.replaceChildren();
  previewStatus.textContent = "";
  previewStatus.className = "preview-status";
  delete previewStatus.dataset.signature;
}

function drawPreview(announce = false) {
  previewLayer.replaceChildren();
  if (!previewOrigin || !state.selected || state.completed) return;
  const piece = pieceById.get(state.selected);
  const orientation = { rotation: state.rotation, flipX: state.flipX };
  const occupied = new Set(state.placements.filter(item => item.id !== piece.id).flatMap(item => item.cells));
  const valid = isLegalPlacement(piece, previewOrigin, occupied, targetForDate(currentDate()), orientation);
  previewLayer.classList.toggle("invalid-preview", !valid);
  const first = board.querySelector(".cell").getBoundingClientRect();
  const second = board.querySelectorAll(".cell")[1].getBoundingClientRect();
  const below = board.querySelectorAll(".cell")[7].getBoundingClientRect();
  const stepX = second.left - first.left;
  const stepY = below.top - first.top;
  const cells = placementCells(piece, previewOrigin, orientation);
  for (const key of cells) {
    const [x, y] = key.split(",").map(Number);
    const square = document.createElement("span");
    square.className = "preview-square";
    square.dataset.key = key;
    square.style.left = `${x * stepX}px`;
    square.style.top = `${y * stepY}px`;
    square.style.width = `${first.width}px`;
    square.style.height = `${first.height}px`;
    previewLayer.append(square);
  }
  const anchor = document.createElement("span");
  anchor.className = "preview-anchor";
  anchor.style.left = `${(previewOrigin.x + previewAnchor[0]) * stepX}px`;
  anchor.style.top = `${(previewOrigin.y + previewAnchor[1]) * stepY}px`;
  anchor.style.width = `${first.width}px`;
  anchor.style.height = `${first.height}px`;
  previewLayer.append(anchor);
  previewStatus.classList.toggle("invalid-preview", !valid);
  const outside = cells.some(key => {
    const [x, y] = key.split(",").map(Number);
    return x < 0 || x > 6 || y < 0 || y > 7;
  });
  const status = `${valid ? "✓ Kan plasseres" : "✕ Kan ikke plasseres"}${outside ? " – deler er utenfor brettet" : ""}. ⊕ markerer festepunktet.`;
  const signature = outside ? `${status}:${piece.id}:${state.rotation}:${state.flipX}` : status;
  if (previewStatus.dataset.signature !== signature || announce) {
    previewStatus.textContent = status;
    previewStatus.dataset.signature = signature;
    if (outside) {
      const miniature = renderPiece(piece, state.rotation, state.flipX);
      miniature.classList.add("preview-mini");
      miniature.setAttribute("aria-hidden", "true");
      previewStatus.append(miniature);
    }
  }
}

function boardPoint(clientX, clientY) {
  const rect = board.getBoundingClientRect();
  if (clientX < rect.left || clientX >= rect.right || clientY < rect.top || clientY >= rect.bottom) return null;
  const cells = board.querySelectorAll(".cell");
  const first = cells[0].getBoundingClientRect();
  const stepX = cells[1].getBoundingClientRect().left - first.left;
  const stepY = cells[7].getBoundingClientRect().top - first.top;
  return { x: Math.min(6, Math.floor((clientX - rect.left) / stepX)), y: Math.min(7, Math.floor((clientY - rect.top) / stepY)) };
}

function updatePreview(point, anchor = [0, 0], announce = false) {
  previewAnchor = anchor;
  previewOrigin = { x: point.x - anchor[0], y: point.y - anchor[1] };
  drawPreview(announce);
}

function cancelSelection() {
  if (drag) finishDrag(false);
  state.selected = null;
  state.rotation = 0;
  state.flipX = false;
  clearPreview();
  renderTray();
  setMessage("Brikkevalg avbrutt.");
}

dateInput.addEventListener("change", () => {
  const value = dateInput.value;
  if (!isValidDateString(value)) { setMessage("Velg en gyldig dato.", "error"); return; }
  state.date = value;
  state.placements = [];
  state.history = [];
  state.elapsed = 0;
  state.paused = false;
  state.started = false;
  state.hintsUsed = 0;
  state.assisted = false;
  state.completed = false;
  state.selected = null;
  state.rotation = 0;
  state.flipX = false;
  state.hintPiece = null;
  clearPreview();
  document.querySelector("#victory").hidden = true;
  tick = Date.now();
  setMessage("Ny dato valgt. Plasser brikkene rundt dagens tre felter.");
  render();
});

tray.addEventListener("click", event => {
  if (suppressClick) return;
  const button = event.target.closest("[data-piece]");
  if (!button || state.completed || state.placements.some(item => item.id === button.dataset.piece)) return;
  state.selected = button.dataset.piece;
  state.rotation = 0;
  state.flipX = false;
  clearPreview();
  persist();
  renderTray();
  setMessage(`${pieceById.get(state.selected).name} valgt. Trykk på en rute på brettet.`);
});

board.addEventListener("click", event => {
  if (suppressClick) return;
  const cell = event.target.closest("[data-key]");
  const point = event.detail !== 0 ? boardPoint(event.clientX, event.clientY) : null;
  const key = cell?.dataset.key || (point && `${point.x},${point.y}`);
  if (!key) return;
  if (state.selected) {
    const [x, y] = key.split(",").map(Number);
    if (lastPointerType === "touch" && event.detail !== 0) {
      if (!touchPreview || previewOrigin?.x !== x || previewOrigin?.y !== y || previewAnchor[0] !== 0 || previewAnchor[1] !== 0) {
        touchPreview = true;
        updatePreview({ x, y }, [0, 0], true);
        setMessage("Trykk på samme rute igjen for å plassere, eller velg Avbryt.");
        return;
      }
    }
    if (tryPlace(state.selected, key) && event.detail === 0 && !state.completed) {
      tray.querySelector("[data-piece]")?.focus({ preventScroll: true });
    }
    return;
  }
  const placement = state.placements.find(item => item.cells.includes(key));
  if (placement) { returnPiece(placement.id); return; }
});

board.addEventListener("pointermove", event => {
  if (drag || !state.selected || event.pointerType === "touch") return;
  const point = boardPoint(event.clientX, event.clientY);
  if (point) { touchPreview = false; updatePreview(point); }
});
board.addEventListener("pointerleave", event => {
  if (!drag && event.pointerType !== "touch" && !touchPreview) hidePreview();
});
board.addEventListener("focusin", event => {
  const cell = event.target.closest("[data-key]");
  if (state.selected && cell?.dataset.key && cell.matches(":focus-visible")) {
    const [x, y] = cell.dataset.key.split(",").map(Number);
    updatePreview({ x, y }, [0, 0], true);
  }
});

function beginPointer(event) {
  lastPointerType = event.pointerType;
  if (state.completed || drag || event.button !== 0 || !event.isPrimary) return;
  const button = event.target.closest("[data-piece]");
  const cell = event.target.closest("#board [data-key]");
  const placement = cell?.dataset.key && state.placements.find(item => item.cells.includes(cell.dataset.key));
  if (!button && !placement) return;
  const pieceId = button?.dataset.piece || placement.id;
  const square = event.target.closest(".piece-preview i");
  const anchor = placement
    ? cell.dataset.key.split(",").map((value, index) => Number(value) - (index ? placement.origin.y : placement.origin.x))
    : square ? [Number(square.dataset.x), Number(square.dataset.y)] : [0, 0];
  drag = {
    pointerId: event.pointerId, pointerType: event.pointerType, x: event.clientX, y: event.clientY,
    pieceId, placement, anchor, active: false, capture: button ? tray : board,
    prior: { selected: state.selected, rotation: state.rotation, flipX: state.flipX },
  };
}

tray.addEventListener("pointerdown", beginPointer);
board.addEventListener("pointerdown", beginPointer);
board.addEventListener("pointerdown", event => { lastPointerType = event.pointerType; });

window.addEventListener("pointermove", event => {
  if (!drag || event.pointerId !== drag.pointerId) return;
  if (!drag.active && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 7) return;
  if (!drag.active) {
    drag.active = true;
    drag.capture.setPointerCapture(event.pointerId);
    state.selected = drag.pieceId;
    state.rotation = drag.placement?.rotation ?? (drag.prior.selected === drag.pieceId ? drag.prior.rotation : 0);
    state.flipX = drag.placement?.flipX ?? (drag.prior.selected === drag.pieceId ? drag.prior.flipX : false);
    drag.ghost = document.createElement("div");
    drag.ghost.className = "drag-ghost";
    drag.ghost.setAttribute("aria-hidden", "true");
    drag.ghost.append(renderPiece(pieceById.get(drag.pieceId), state.rotation, state.flipX));
    document.body.append(drag.ghost);
    renderTray();
    drag.scrollFrame = requestAnimationFrame(scrollDuringDrag);
  }
  if (event.cancelable) event.preventDefault();
  drag.clientX = event.clientX;
  drag.clientY = event.clientY;
  updateDragPosition();
}, { passive: false });

function updateDragPosition() {
  const y = drag.clientY - (drag.pointerType === "touch" ? 48 : 0);
  const point = boardPoint(drag.clientX, y);
  drag.point = point;
  drag.ghost.hidden = Boolean(point);
  drag.ghost.style.left = `${drag.clientX + 12}px`;
  drag.ghost.style.top = `${y - 24}px`;
  if (point) updatePreview(point, drag.anchor);
  else clearPreview();
}

function scrollDuringDrag() {
  if (!drag?.active) return;
  const edge = 70;
  const delta = drag.clientY < edge ? -Math.ceil((edge - drag.clientY) / 5)
    : drag.clientY > window.innerHeight - edge ? Math.ceil((drag.clientY - window.innerHeight + edge) / 5) : 0;
  if (delta) {
    const before = window.scrollY;
    window.scrollBy(0, delta);
    if (window.scrollY !== before) updateDragPosition();
  }
  drag.scrollFrame = requestAnimationFrame(scrollDuringDrag);
}

function finishDrag(commit) {
  const current = drag;
  if (!current) return;
  drag = null;
  if (current.scrollFrame) cancelAnimationFrame(current.scrollFrame);
  if (current.capture.hasPointerCapture(current.pointerId)) current.capture.releasePointerCapture(current.pointerId);
  current.ghost?.remove();
  if (!current.active) return;
  suppressClick = true;
  window.setTimeout(() => { suppressClick = false; }, 0);
  if (commit && current.point && previewOrigin) {
    const origin = previewOrigin;
    if (!tryPlace(current.pieceId, `${origin.x},${origin.y}`)) {
      Object.assign(state, current.prior);
      clearPreview();
      renderTray();
    }
  } else {
    Object.assign(state, current.prior);
    clearPreview();
    renderTray();
    setMessage("Flytting avbrutt. Brettet er uendret.");
  }
}

window.addEventListener("pointerup", event => {
  if (drag?.pointerId === event.pointerId) finishDrag(true);
});
window.addEventListener("pointercancel", event => {
  if (drag?.pointerId === event.pointerId) finishDrag(false);
});
window.addEventListener("blur", () => { if (drag) finishDrag(false); });
window.addEventListener("resize", () => drawPreview());

document.querySelector("#rotate-cw").addEventListener("click", () => rotate(1));
document.querySelector("#rotate-ccw").addEventListener("click", () => rotate(3));
document.querySelector("#flip").addEventListener("click", flip);
document.querySelector("#cancel-placement").addEventListener("click", cancelSelection);
document.querySelector("#undo").addEventListener("click", () => {
  if (state.completed) return;
  const previous = state.history.pop();
  if (!previous) { setMessage("Ingenting å angre ennå."); return; }
  state.placements = JSON.parse(previous);
  state.selected = null;
  clearPreview();
  document.querySelector("#victory").hidden = true;
  render();
  setMessage("Siste trekk angret.");
});
document.querySelector("#reset").addEventListener("click", () => {
  snapshot();
  state.placements = [];
  state.selected = null;
  state.rotation = 0;
  state.flipX = false;
  state.elapsed = 0;
  state.started = false;
  state.paused = false;
  state.hintsUsed = 0;
  state.assisted = false;
  state.completed = false;
  state.hintPiece = null;
  clearPreview();
  state.history = [];
  document.querySelector("#victory").hidden = true;
  tick = Date.now();
  render();
  setMessage("Puslespillet er nullstilt.");
});

document.querySelector("#hint").addEventListener("click", () => {
  if (state.completed) return;
  const result = solve(PIECES, targetForDate(currentDate()), state.placements);
  if (!result.ok) {
    setMessage(`Ingen gyldig løsning fra dagens plassering. Prøv å flytte eller angre en brikke. ${result.reason}`, "error");
    return;
  }
  const next = result.placements.find(item => !state.placements.some(placed => placed.id === item.id));
  if (!next) return;
  state.hintsUsed++;
  stats.totalHints++;
  saveStats(stats);
  renderStats();
  state.hintPiece = next.id;
  board.querySelectorAll(".hint, .hint-area, .hint-solution").forEach(cell =>
    cell.classList.remove("hint", "hint-area", "hint-solution"),
  );
  if (state.hintsUsed % 3 === 1) {
    board.querySelectorAll(".hint").forEach(cell => cell.classList.remove("hint"));
    next.cells.forEach(key => board.querySelector(`[data-key="${key}"]`)?.classList.add("hint-area"));
    setMessage("Hint: Se etter plass til en brikke i det markerte området.");
  } else if (state.hintsUsed % 3 === 2) {
    next.cells.forEach(key => board.querySelector(`[data-key="${key}"]`)?.classList.add("hint"));
    renderTray();
    setMessage(`Prøv brikken «${pieceById.get(next.id).name}» i det markerte området.`);
  } else {
    next.cells.forEach(key => board.querySelector(`[data-key="${key}"]`)?.classList.add("hint-solution"));
    setMessage(`«${pieceById.get(next.id).name}»: start i rad ${next.origin.y + 1}, kolonne ${next.origin.x + 1}; roter ${next.rotation * 90}°${next.flipX ? " og vend brikken" : ""}.`);
  }
  persist();
});

document.querySelector("#solution").addEventListener("click", () => {
  if (state.completed || !window.confirm("Vil du vise hele løsningen? Denne runden blir registrert som hjulpet.")) return;
  const targets = targetForDate(currentDate());
  const result = solve(PIECES, targets);
  if (!result.ok || !validateComplete(result.placements, targets, PIECES)) {
    setMessage(`Fant ingen validert løsning: ${result.reason || "Løsningen bestod ikke kontrollen."}`, "error");
    return;
  }
  state.placements = result.placements;
  state.selected = null;
  clearPreview();
  state.assisted = true;
  renderBoard();
  renderTray();
  completeGame(true);
});

document.querySelector("#pause").addEventListener("click", () => {
  if (state.completed) return;
  state.paused = !state.paused;
  tick = Date.now();
  render();
});

async function copyResult(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* Continue with the selection-based fallback when clipboard permission is denied. */ }
  const input = document.createElement("textarea");
  input.value = text;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.append(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  return copied;
}

document.querySelector("#share").addEventListener("click", async () => {
  const marker = state.assisted ? "Løst med hjelp." : state.hintsUsed ? `Løst med ${state.hintsUsed} hint.` : "Løst uten hint!";
  const text = `🧩 Dagens utfordring – Papers United\n\n📅 ${currentDate().toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" })}\n⏱️ Tid: ${timeText(state.elapsed)}\n🏆 ${marker}\n\nKlarer du å slå tiden min?\n\nhttps://papersunited.com/puzzle-a-day/`;
  try {
    if (navigator.share) await navigator.share({ title: "Dagens utfordring – Papers United", text });
    else {
      const copied = await copyResult(text);
      setMessage(copied ? "Resultatet er kopiert. Del det med en venn!" : "Nettleseren støtter ikke deling eller kopiering.", copied ? "success" : "error");
    }
  } catch (error) {
    if (error.name !== "AbortError") setMessage("Kunne ikke dele resultatet. Prøv å kopiere lenken.", "error");
  }
});

document.addEventListener("keydown", event => {
  if (event.target.matches("input, textarea")) return;
  if (event.key.toLowerCase() === "r") rotate(event.shiftKey ? 3 : 1);
  if (event.key.toLowerCase() === "f") flip();
  if (event.key === "Escape" && state.selected) {
    cancelSelection();
  }
});

window.setInterval(() => {
  if (!state.paused && !state.completed && state.started && !document.hidden) {
    const now = Date.now();
    state.elapsed += Math.max(0, (now - tick) / 1000);
    tick = now;
    updateTimer();
    persist();
  }
}, 500);
document.addEventListener("visibilitychange", () => { tick = Date.now(); });

document.querySelector("#victory").hidden = !state.completed;
if (state.completed) {
  document.querySelector("#victory-title").textContent = "Gratulerer! Du løste dagens utfordring!";
  document.querySelector("#victory-details").textContent = `Tiden din: ${formattedElapsed(state.elapsed)}.${state.assisted ? " Løsningen ble vist – denne runden teller som hjulpet." : " Flott jobbet!"}`;
}
render();
if (saved) setMessage("Spillet er hentet fra der du slapp.");
