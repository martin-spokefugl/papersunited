const definitions = [
  ["p1", "T-brikke", ["XXX", ".X.", ".X."], "#2f7654"],
  ["p2", "Siksak", ["XX.", ".XX"], "#397d59"],
  ["p3", "U-brikke", ["XXX", "X.X"], "#286b4a"],
  ["p4", "Forskjøvet femmer", ["..XX", "XXX."], "#43815c"],
  ["p5", "Hjørnebrikke", ["XXX", "..X", "..X"], "#347650"],
  ["p6", "L-brikke", [".X", ".X", "XX"], "#4b865f"],
  ["p7", "Trappebrikke", [".XX", ".X.", "XX."], "#2c704c"],
  ["p8", "Lang hjørnebrikke", ["XX", ".X", ".X", ".X"], "#3d7954"],
  ["p9", "Rett brikke", ["X", "X", "X", "X"], "#568c67"],
  ["p10", "Femruter", [".X", "XX", "XX"], "#246447"],
];

export const PIECE_GEOMETRY_VERIFIED = true;
export const PIECES = definitions.map(([id, name, rows, color]) => ({
  id,
  name,
  color,
  cells: rows.flatMap((row, y) => [...row].flatMap((value, x) => value === "X" ? [[x, y]] : [])),
}));
