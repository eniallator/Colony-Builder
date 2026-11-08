// Non-gameplay sprites the renderer composes with others (shadows, later
// selection highlights, particles, ...).

import { blank, put, TILE } from "../core.mjs";
import { still } from "./define.mjs";

/**
 * Soft contact shadow: an ellipse of half-width `rx` and half-height `ry`,
 * centred on the bottom rows (13.5) so it shows below the body instead of
 * hiding behind it.
 */
const shadow = (rx, ry) => {
  const s = blank();
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const d = ((x - 7.5) / rx) ** 2 + ((y - 13.5) / ry) ** 2;
      if (d <= 1) put(s, x, y, "#000000", 70);
    }
  }
  return s;
};

export const effects = [
  // Under players and robots.
  still("shadow", shadow(5.5, 2)),
  // Under dropped items, which are smaller.
  still("shadow_small", shadow(3.5, 1.5)),
];
