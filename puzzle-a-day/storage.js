const STORAGE_KEY = "papers-united-calendar-puzzle-v1";
const STATS_KEY = "papers-united-calendar-stats-v1";

export function loadGame() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (value?.version === 1 && typeof value.date === "string" && Array.isArray(value.placements)
      && Number.isFinite(value.elapsed) && typeof value.paused === "boolean"
      && typeof value.started === "boolean") return value;
  } catch { /* Corrupted or unavailable storage starts a fresh game. */ }
  return null;
}

export function saveGame(value) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...value, version: 1 })); return true; }
  catch { return false; }
}

export function loadStats() {
  try {
    const value = JSON.parse(localStorage.getItem(STATS_KEY) || "null");
    if (value?.version === 1 && Array.isArray(value.completedDates)) return value;
  } catch { /* Corrupted or unavailable storage starts empty. */ }
  return { version: 1, completedDates: [], bestSeconds: null };
}

export function saveStats(stats) {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); return true; }
  catch { return false; }
}
