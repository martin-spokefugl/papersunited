import { isLegalPlacement, placementCells } from "./logic.js";

const SVG_NS = "http://www.w3.org/2000/svg";

export function placementPreview(piece, origin, orientation, placements, targets) {
  const occupied = new Set(placements.filter(item => item.id !== piece.id).flatMap(item => item.cells));
  return {
    cells: placementCells(piece, origin, orientation),
    valid: isLegalPlacement(piece, origin, occupied, targets, orientation),
  };
}

export function renderGhost(layer, preview, origin, anchor, grid) {
  const document = layer.ownerDocument;
  const make = (tag, attributes) => {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
    return node;
  };
  layer.replaceChildren();
  layer.setAttribute("viewBox", `0 0 ${grid.width} ${grid.height}`);
  layer.setAttribute("preserveAspectRatio", "none");
  const fill = preview.valid ? "#36a46b" : "#e24b3e";
  const stroke = preview.valid ? "#095c32" : "#8d1d17";
  for (const key of preview.cells) {
    const [x, y] = key.split(",").map(Number);
    layer.append(make("rect", {
      class: "preview-square",
      "data-key": key,
      x: x * grid.stepX + 1.5,
      y: y * grid.stepY + 1.5,
      width: Math.max(0, grid.cellWidth - 3),
      height: Math.max(0, grid.cellHeight - 3),
      rx: 3,
      fill,
      "fill-opacity": 0.65,
      stroke,
      "stroke-width": 3,
      "stroke-dasharray": preview.valid ? "none" : "6 3",
      "vector-effect": "non-scaling-stroke",
    }));
  }
  const marker = make("text", {
    class: "preview-anchor",
    x: (origin.x + anchor[0]) * grid.stepX + grid.cellWidth / 2,
    y: (origin.y + anchor[1]) * grid.stepY + grid.cellHeight / 2,
    "text-anchor": "middle",
    "dominant-baseline": "central",
    "font-size": 22,
    fill: "#102b21",
    stroke: "#ffffff",
    "stroke-width": 2,
    "paint-order": "stroke",
  });
  marker.textContent = "⊕";
  layer.append(marker);
}
