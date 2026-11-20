const STORAGE_KEY = "papers-united-calendar-puzzle-v2";
const STATS_KEY = "papers-united-calendar-stats-v2";

export function loadGame() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (value?.version === 2 && typeof value.date === "string" && Array.isArray(value.placements)
      && Number.isFinite(value.elapsed) && typeof value.paused === "boolean"
      && typeof value.started === "boolean" && Number.isInteger(value.hintsUsed)
      && typeof value.assisted === "boolean" && typeof value.completed === "boolean") return value;
  } catch { /* Corrupted or unavailable storage starts a fresh game. */ }
  return null;
}

export function saveGame(value) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...value, version: 2 })); return true; }
  catch { return false; }
}

export function loadStats() {
  try {
    const value = JSON.parse(localStorage.getItem(STATS_KEY) || "null");
    if (value?.version === 2 && Array.isArray(value.completedDates) && Number.isInteger(value.totalHints)) {
      return {
        version: 2,
        completedDates: value.completedDates.filter(item => item && /^\d{4}-\d{2}-\d{2}$/.test(item.date)
          && Number.isFinite(item.seconds) && item.seconds >= 0
          && Number.isInteger(item.hints) && item.hints >= 0 && typeof item.assisted === "boolean"),
        totalHints: Math.max(0, value.totalHints),
      };
    }
  } catch { /* Corrupted or unavailable storage starts empty. */ }
  return { version: 2, completedDates: [], totalHints: 0 };
}

export function saveStats(stats) {
  try { localStorage.setItem(STATS_KEY, JSON.stringify({ ...stats, version: 2 })); return true; }
  catch { return false; }
}
