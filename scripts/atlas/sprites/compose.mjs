// Builds a sprite from overlapping outlined shapes ("chunks"), painted back to
// front. Handy for piles, stacks and clusters, where hand-typing one big ASCII
// grid would be error-prone. Each chunk is a small ASCII pattern: '.' is
// transparent, every other character comes from the legend. The 1px outline is
// added automatically around each chunk, so overlaps layer naturally.

import { blank, put } from "../core.mjs";

/** Paints one chunk (outline first, then fill) at (ox, oy). */
const stamp = (s, rows, legend, outline, ox, oy) => {
  const height = rows.length;
  const width = rows[0].length;
  const filled = (x, y) =>
    x >= 0 && y >= 0 && x < width && y < height && rows[y][x] !== ".";

  for (let y = -1; y <= height; y++) {
    for (let x = -1; x <= width; x++) {
      if (filled(x, y)) continue;
      const touches = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dx, dy]) => filled(x + dx, y + dy));
      if (touches) put(s, ox + x, oy + y, outline);
    }
  }
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === ".") return;
      const colour = legend[ch];
      if (colour == null) throw new Error(`no legend entry for "${ch}"`);
      put(s, ox + x, oy + y, colour);
    })
  );
};

/** `layers` is [[rows, x, y], ...], painted in order (first = furthest back). */
export const compose = (layers, legend, outline) => {
  const s = blank();
  for (const [rows, x, y] of layers) {
    if (new Set(rows.map(r => r.length)).size !== 1)
      throw new Error(`chunk rows must all be the same width: ${rows}`);
    stamp(s, rows, legend, outline, x, y);
  }
  return s;
};
