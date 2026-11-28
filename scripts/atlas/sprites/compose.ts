// Builds a sprite from overlapping outlined shapes ("chunks"), painted back to
// front. Handy for piles, stacks and clusters, where hand-typing one big ASCII
// grid would be error-prone. Each chunk is a small ASCII pattern: '.' is
// transparent, every other character comes from the legend. The 1px outline is
// added automatically around each chunk, so overlaps layer naturally.

import {
  blank,
  NEIGHBOURS,
  put,
  type Legend,
  type Pixels,
  type Plot,
  type Point,
} from "../core.ts";

/** A chunk's rows and where its top left corner goes. */
export type Placement = readonly [
  rows: readonly string[],
  x: number,
  y: number,
];

/**
 * Paints one chunk (outline first, if there is one, then fill) at (ox, oy).
 * `plot` places each pixel: pass `putWrap` to carry a chunk over the edges.
 */
export const stamp = (
  s: Pixels,
  rows: readonly string[],
  legend: Legend,
  [ox, oy]: Readonly<Point>,
  { outline, plot = put }: { outline?: string; plot?: Plot } = {}
): void => {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  const filled = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height && rows[y]?.[x] !== ".";

  for (let y = -1; outline != null && y <= height; y++) {
    for (let x = -1; x <= width; x++) {
      if (filled(x, y)) continue;
      const touches = NEIGHBOURS.some(([dx, dy]) => filled(x + dx, y + dy));
      if (touches) plot(s, ox + x, oy + y, outline);
    }
  }
  rows.forEach((row, y) => {
    Array.from(row).forEach((ch, x) => {
      if (ch === ".") return;
      const colour = legend[ch];
      if (colour == null) throw new Error(`no legend entry for "${ch}"`);
      plot(s, ox + x, oy + y, colour);
    });
  });
};

/** `layers` is [[rows, x, y], ...], painted in order (first = furthest back). */
export const compose = (
  layers: readonly Placement[],
  legend: Legend,
  outline?: string
): Pixels => {
  const s = blank();
  for (const [rows, x, y] of layers) {
    if (new Set(rows.map(r => r.length)).size !== 1)
      throw new Error(`chunk rows must all be the same width: ${rows}`);
    stamp(s, rows, legend, [x, y], { outline });
  }
  return s;
};
