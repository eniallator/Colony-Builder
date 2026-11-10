// Non-gameplay sprites the renderer composes with others (shadows, later
// selection highlights, particles, ...).

import { blank, put, TILE } from "../core.mjs";
import { still } from "./define.mjs";

// Row the shadows' ellipses are centred on (pixel centre, so the line through
// it is CENTRE_ROW + 0.5). The renderer lines this line up with the ground line
// of whatever casts the shadow, so half the shadow shows below it.
const CENTRE_ROW = 13.5;

/** Soft ellipse of half-width `rx` and half-height `ry`. */
const ellipse = (rx, ry) => {
  const s = blank();
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const d = ((x - 7.5) / rx) ** 2 + ((y - CENTRE_ROW) / ry) ** 2;
      if (d <= 1) put(s, x, y, "#000000", 70);
    }
  }
  return s;
};

/** Soft contact shadow sprite. */
const shadow = (name, rx, ry) =>
  // Its ground line is the middle of the ellipse, not its lowest pixel.
  still(name, ellipse(rx, ry), { ground: CENTRE_ROW + 0.5 });

export const effects = [
  // Under players and robots.
  shadow("shadow", 5.5, 2),
  // Under dropped items, which are smaller.
  shadow("shadow_small", 4, 2),
];
