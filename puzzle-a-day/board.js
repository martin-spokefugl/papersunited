export const ROWS = [
  ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
  ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  ["1", "2", "3", "4", "5", "6", "7"],
  ["8", "9", "10", "11", "12", "13", "14"],
  ["15", "16", "17", "18", "19", "20", "21"],
  ["22", "23", "24", "25", "26", "27", "28"],
  ["29", "30", "31", "Sun", "Mon", "Tues", "Wed"],
  [null, null, null, null, "Thu", "Fri", "Sat"],
];

export const CELLS = ROWS.flatMap((row, y) => row.flatMap((label, x) =>
  label === null ? [] : [{ x, y, label }],
));
export const CELL_BY_COORD = new Map(CELLS.map(cell => [`${cell.x},${cell.y}`, cell]));

export function targetForDate(date) {
  const month = date.getMonth();
  const weekday = date.getDay();
  return new Set([
    `${month % 6},${Math.floor(month / 6)}`,
    `${(date.getDate() - 1) % 7},${2 + Math.floor((date.getDate() - 1) / 7)}`,
    weekday < 4 ? `${weekday + 3},6` : `${weekday},7`,
  ]);
}
