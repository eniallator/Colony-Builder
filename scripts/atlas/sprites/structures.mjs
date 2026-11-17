// Structures grown on the terrain: sprites are named after the structure id in
// shared/src/world/structure/types.ts (`tree`, `cactus`). They rest on the
// ground at their bottom edge, so the renderer anchors them by that line.
//
// Drawn from shapes rather than ASCII so the lit-from-the-top-left shading
// stays consistent; the edge is raggedised by the sprite's seeded RNG.

import { blank, hash, mulberry32, put, TILE } from "../core.mjs";
import { PALETTE } from "../palette.mjs";
import { still } from "./define.mjs";

const { leaf, cactus, log, outline, flower } = PALETTE;

/** Adds a 1px outline around every opaque pixel's transparent neighbours. */
const outlined = s => {
  const height = s.length / (TILE * 4);
  const opaque = (x, y) =>
    x >= 0 && y >= 0 && x < TILE && y < height && s[(y * TILE + x) * 4 + 3] > 0;
  const edge = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < TILE; x++) {
      if (opaque(x, y)) continue;
      const touches = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dx, dy]) => opaque(x + dx, y + dy));
      if (touches) edge.push([x, y]);
    }
  }
  for (const [x, y] of edge) put(s, x, y, outline);
  return s;
};

/** Which of the 4 ramp steps a point lit from the top-left falls on. */
const shade = (ramp, lit) =>
  lit > 0.45 ? ramp[3] : lit > 0.05 ? ramp[2] : lit > -0.4 ? ramp[1] : ramp[0];

// A tree is 16x32: a two-tier canopy of overlapping blobs on a short trunk.
const TREE_BLOBS = [
  // [centreX, centreY, radius], back to front.
  [8, 14, 5.5],
  [5, 16, 4.5],
  [11, 16, 4.5],
  [8, 8, 5.5],
];
const TRUNK = { left: 7, right: 8, top: 20, base: 31 };

const tree = rng => {
  const s = blank(2);

  // Trunk: lit left edge, shaded right edge, flaring a pixel at the root.
  for (let y = TRUNK.top; y <= TRUNK.base; y++) {
    const flare = y >= TRUNK.base - 1;
    put(s, TRUNK.left, y, log.barkLight);
    put(s, TRUNK.right, y, log.bark);
    if (flare) {
      put(s, TRUNK.left - 1, y, log.bark);
      put(s, TRUNK.right + 1, y, log.barkDark);
    }
  }

  // Canopy: the nearest blob a pixel falls in decides its shading, and a
  // random wobble on the radius keeps the edge from being a perfect circle.
  for (let y = 0; y < TRUNK.top + 2; y++) {
    for (let x = 1; x < TILE - 1; x++) {
      const blob = [...TREE_BLOBS]
        .reverse()
        .find(
          ([cx, cy, r]) => Math.hypot(x - cx, y - cy) <= r + (rng() - 0.5) * 1.6
        );
      if (blob == null) continue;
      const [cx, cy, r] = blob;
      const lit = (-(x - cx) - (y - cy)) / (r * 1.4);
      // The odd speckle one step lighter or darker, never a checkerboard.
      const speckle = rng() < 0.08 ? (rng() < 0.5 ? -0.3 : 0.3) : 0;
      put(s, x, y, shade(leaf, lit + speckle));
    }
  }
  return outlined(s);
};

// A cactus is 16x16: a ribbed trunk with an arm raised on each side.
const CACTUS_PARTS = [
  // [left, top, width, height], arms first so the trunk draws over the joins.
  [2, 4, 3, 7], // left arm
  [3, 9, 4, 3], // left elbow into the trunk
  [11, 6, 3, 6], // right arm
  [9, 10, 3, 3], // right elbow into the trunk
  [6, 1, 4, 14], // trunk
];

const cactusPlant = rng => {
  const s = blank();
  for (const [left, top, width, height] of CACTUS_PARTS) {
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        // Lit on the left edge and the top, shaded on the right.
        const colour =
          dx === 0 || dy === 0
            ? cactus[3]
            : dx === width - 1
              ? cactus[0]
              : // Vertical ribs, with the odd spine catching the light.
                dx % 2 === 0 && rng() < 0.12
                ? cactus[3]
                : cactus[dx === 1 ? 2 : 1];
        put(s, left + dx, top + dy, colour);
      }
    }
  }
  // A single bloom on top of the trunk.
  put(s, 7, 1, flower);
  put(s, 8, 1, flower);
  return outlined(s);
};

export const structures = [
  still("tree", tree(mulberry32(hash("tree")))),
  still("cactus", cactusPlant(mulberry32(hash("cactus")))),
];
