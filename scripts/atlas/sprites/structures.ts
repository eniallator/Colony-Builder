// Structures grown on the terrain: sprites are named after the structure id in
// shared/src/world/structure/types.ts (`tree`, `cactus`, ...). They rest on the
// ground at their bottom edge, so the renderer anchors them by that line.
//
// Mostly drawn from shapes rather than ASCII so the lit-from-the-top-left
// shading stays consistent; ferns, all thin fronds, are drawn by hand. Trees,
// cacti and ferns are shaded in the brighter steps of their ramp, with a soft
// outline in its darkest.

import {
  blank,
  byteAt,
  NEIGHBOURS,
  put,
  TILE,
  type Pixels,
  type Point,
  type Rng,
} from "../core.ts";
import { PALETTE } from "../palette.ts";
import { stamp } from "./compose.ts";
import { variants } from "./define.ts";

const { leaf, cactus, fern, mushroom, log, outline, flower } = PALETTE;

type Ramp = readonly [dark: string, mid: string, light: string, high: string];
type Blob = readonly [centreX: number, centreY: number, radius: number];
type Rect = readonly [left: number, top: number, width: number, height: number];

interface TreeLook {
  blobs: readonly Blob[];
  trunk: { left: number; right: number; top: number };
  blossoms?: readonly Point[];
}

interface CactusLook {
  parts: readonly Rect[];
  bloom: Point;
}

/** One toadstool of a mushroom (see `MUSHROOM_LOOKS`). */
interface Toadstool {
  x: number;
  base: number;
  stalk: number;
  width: number;
  height: number;
}

/** Adds a 1px outline around every opaque pixel's transparent neighbours. */
const outlined = (s: Pixels, colour: string = outline) => {
  const height = s.length / (TILE * 4);
  const opaque = (x: number, y: number) =>
    x >= 0 &&
    y >= 0 &&
    x < TILE &&
    y < height &&
    byteAt(s, (y * TILE + x) * 4 + 3) > 0;
  const edge: Point[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < TILE; x++) {
      if (opaque(x, y)) continue;
      const touches = NEIGHBOURS.some(([dx, dy]) => opaque(x + dx, y + dy));
      if (touches) edge.push([x, y]);
    }
  }
  for (const [x, y] of edge) put(s, x, y, colour);
  return s;
};

/** Which of the 4 ramp steps a point lit from the top-left falls on. */
const shade = (ramp: Ramp, lit: number) =>
  lit > 0.45 ? ramp[3] : lit > 0.05 ? ramp[2] : lit > -0.4 ? ramp[1] : ramp[0];
// A tree is 16x32: a canopy of overlapping blobs on a short trunk. Each look
// has its own silhouette (the first is the classic two-tier crown), so a grove
// is not a row of stamps. Every one stands with its foot on the bottom row.
const TREE_LOOKS: readonly TreeLook[] = [
  {
    // Round: a two-tier crown.
    blobs: [
      // [centreX, centreY, radius], back to front.
      [8, 14, 5.5],
      [5, 16, 4.5],
      [11, 16, 4.5],
      [8, 8, 5.5],
    ],
    trunk: { left: 7, right: 8, top: 20 },
  },
  {
    // Tall and narrow: three tiers stacked like a fir.
    blobs: [
      [8, 17, 4.8],
      [8, 12, 5],
      [8, 7.5, 4],
    ],
    trunk: { left: 7, right: 8, top: 21 },
  },
  {
    // Wide and bushy: a low crown on a thick trunk.
    blobs: [
      [5, 18, 4],
      [11, 18, 4],
      [8, 15, 5.5],
      [8, 10.5, 4.5],
    ],
    trunk: { left: 7, right: 9, top: 22 },
  },
  {
    // Lopsided and in blossom: a crown leaning left.
    blobs: [
      [6, 13, 5.5],
      [11, 17, 4],
      [12, 10.5, 3.5],
      [7, 7, 5],
    ],
    trunk: { left: 7, right: 8, top: 20 },
    // Where each flower starts, on the lit side of the crown.
    blossoms: [
      [4, 5],
      [8, 10],
      [4, 13],
    ],
  },
];
const TREE_BASE = 31;

/** A flower two pixels wide, starting at (x, y). */
const bloomAt = (s: Pixels, [x, y]: Point) => {
  put(s, x, y, flower);
  put(s, x + 1, y, flower);
};

/** The frontmost blob over a pixel, each with an evenly scalloped edge. */
const blobAt = (blobs: readonly Blob[], x: number, y: number) =>
  blobs.findLast(([cx, cy, r]) => {
    const scallop = 0.55 * Math.sin(6 * Math.atan2(y - cy, x - cx));
    return Math.hypot(x - cx, y - cy) <= r + scallop;
  });

const tree = (_rng: Rng, { blobs, trunk, blossoms = [] }: TreeLook) => {
  const s = blank(2);

  // Trunk: lit left edge, shaded right edge (and the middle, if it is thicker
  // than 2px), flaring a pixel at the root.
  for (let y = trunk.top; y <= TREE_BASE; y++) {
    const flare = y >= TREE_BASE - 1;
    for (let x = trunk.left; x <= trunk.right; x++) {
      put(s, x, y, x === trunk.left ? log.barkLight : log.bark);
    }
    if (flare) {
      put(s, trunk.left - 1, y, log.bark);
      put(s, trunk.right + 1, y, log.barkDark);
    }
  }

  // Canopy: the frontmost blob a pixel falls in decides its shading.
  const [, low, mid, high] = leaf;
  for (let y = 0; y < trunk.top + 2; y++) {
    for (let x = 1; x < TILE - 1; x++) {
      const blob = blobAt(blobs, x, y);
      if (blob == null) continue;
      const [cx, cy, r] = blob;
      const lit = (-(x - cx) - (y - cy)) / (r * 1.4);
      put(s, x, y, lit > 0.3 ? high : lit > -0.4 ? mid : low);
    }
  }
  for (const at of blossoms) bloomAt(s, at);
  return outlined(s, leaf[0]);
};

// A cactus is 16x16: a trunk, usually with arms. Each look has its own
// silhouette; all of them stand on row 14 (the outline takes row 15).
const CACTUS_LOOKS: readonly CactusLook[] = [
  {
    // Two arms raised, the right one lower.
    parts: [
      // [left, top, width, height], which merge into one shape.
      [2, 4, 3, 7], // left arm
      [3, 9, 4, 3], // left elbow into the trunk
      [11, 6, 3, 6], // right arm
      [9, 10, 3, 3], // right elbow into the trunk
      [6, 1, 4, 14], // trunk
    ],
    bloom: [7, 1],
  },
  {
    // Tall, with a single arm on the right.
    parts: [
      [11, 3, 3, 7], // right arm
      [9, 8, 3, 3], // right elbow into the trunk
      [6, 1, 4, 14], // trunk
    ],
    bloom: [7, 1],
  },
  {
    // A squat barrel with no arms.
    parts: [[4, 5, 8, 10]],
    bloom: [7, 5],
  },
  {
    // Two arms, the left one higher, on a shorter trunk.
    parts: [
      [2, 2, 3, 6], // left arm
      [3, 7, 4, 3], // left elbow into the trunk
      [11, 8, 3, 5], // right arm
      [9, 11, 3, 3], // right elbow into the trunk
      [6, 3, 4, 12], // trunk
    ],
    bloom: [2, 2],
  },
];

const cactusPlant = (_rng: Rng, { parts, bloom }: CactusLook) => {
  const s = blank();
  const inside = (x: number, y: number) =>
    parts.some(
      ([left, top, width, height]) =>
        x >= left && x < left + width && y >= top && y < top + height
    );
  const [, low, mid, high] = cactus;
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      if (!inside(x, y)) continue;
      // Lit on the left edge and the top, shaded on the right.
      const lit = !inside(x - 1, y) || !inside(x, y - 1);
      put(s, x, y, !inside(x + 1, y) ? low : lit ? high : mid);
    }
  }
  // A single bloom on top of a trunk or an arm.
  bloomAt(s, bloom);
  return outlined(s, cactus[0]);
};

// A mushroom is 16x16: a few toadstools, each a pale stalk under a domed cap.
// Every look has one standing on row 14, like the other structures.
const MUSHROOM_LOOKS: readonly (readonly Toadstool[])[] = [
  // Each toadstool is { x: centre, base: the stalk's lowest row, stalk: its
  // height, width and height: the cap's }. Back (higher up) to front.
  // One big toadstool.
  [{ x: 8, base: 14, stalk: 4, width: 12, height: 6 }],
  // A cluster of three.
  [
    { x: 5, base: 12, stalk: 4, width: 7, height: 4 },
    { x: 11, base: 12, stalk: 3, width: 6, height: 4 },
    { x: 8, base: 14, stalk: 3, width: 8, height: 5 },
  ],
  // A tall slender one and a small one beside it.
  [
    { x: 6, base: 13, stalk: 7, width: 8, height: 5 },
    { x: 11, base: 14, stalk: 2, width: 5, height: 3 },
  ],
  // A patch of four small ones.
  [
    { x: 10, base: 12, stalk: 3, width: 5, height: 3 },
    { x: 4, base: 13, stalk: 2, width: 5, height: 3 },
    { x: 7, base: 14, stalk: 3, width: 6, height: 4 },
    { x: 13, base: 14, stalk: 1, width: 4, height: 3 },
  ],
];

const toadstool = (
  s: Pixels,
  rng: Rng,
  { x: cx, base, stalk, width, height }: Toadstool
) => {
  // Stalk: lit on the left, shaded on the right.
  const stalkWidth = width >= 9 ? 3 : 2;
  const stalkLeft = cx - Math.floor(stalkWidth / 2);
  for (let y = base - stalk + 1; y <= base; y++) {
    for (let dx = 0; dx < stalkWidth; dx++) {
      put(
        s,
        stalkLeft + dx,
        y,
        dx === 0
          ? mushroom.stalk[2]
          : dx === stalkWidth - 1
            ? mushroom.stalk[0]
            : mushroom.stalk[1]
      );
    }
  }

  // Cap: a dome whose flat underside sits just above the stalk, rows
  // narrowing towards the top, with a wobble so the edge is not smooth.
  const bottom = base - stalk;
  const middle = bottom - (height - 1) / 2;
  for (let y = bottom - height + 1; y <= bottom; y++) {
    const rise = (bottom - y) / height;
    const half = (width / 2) * Math.sqrt(1 - rise * rise) + (rng() - 0.5) * 0.8;
    for (let x = Math.ceil(cx - half); x < Math.floor(cx + half); x++) {
      const lit =
        (-(x + 0.5 - cx) / (width / 2) - (y - middle) / (height / 2)) * 0.5;
      const spot = y < bottom && width >= 6 && lit > -0.2 && rng() < 0.12;
      put(
        s,
        x,
        y,
        y === bottom
          ? mushroom.cap[0]
          : spot
            ? mushroom.stalk[2]
            : shade(mushroom.cap, lit)
      );
    }
  }
};

const mushroomPlant = (rng: Rng, toadstools: readonly Toadstool[]) => {
  const s = blank();
  for (const details of toadstools) toadstool(s, rng, details);
  return outlined(s);
};

// A fern is 16x16: fronds fanning out from one root on row 14. Each look is
// drawn by hand (a, b, c = darker to lighter), centred on the tile.
const FERN_LOOKS = [
  // A broad, even fan.
  [
    "......c.......",
    "..c...cb...c..",
    "..bc..cb..cb..",
    "...bc.cb.cb...",
    "c...bccbcb...c",
    ".bc..cccb..cb.",
    "..bbc.cb.cbb..",
    "....bccbcb....",
    "......ab......",
    ".....aaaa.....",
  ],
  // Tall and upright.
  [
    "......c.......",
    "......cb......",
    "...c..cb..c...",
    "...cb.cb.cb...",
    "....cbcbcb....",
    ".c..cbcbb..c..",
    ".bc..ccbb.cb..",
    "..bc.ccb.cb...",
    "...bbccbbb....",
    "....bcbcb.....",
    "......ab......",
    ".....aaaa.....",
  ],
  // Low and wide, drooping at the tips.
  [
    "...cc....cc...",
    ".cc.bc..cb.cc.",
    "cb...bccb...bc",
    "b..ccbccbcc..b",
    "..cb..cb..bc..",
    "..b..cccb..b..",
    ".....abab.....",
    ".....aaaa.....",
  ],
  // Leaning to the left, with a young frond on the right.
  [
    "..c...........",
    "..cb..c.......",
    "c..cb.cb......",
    "bc..cbcb...c..",
    ".bc..cccb.cb..",
    "..bbc.ccbcb...",
    "....bccccb....",
    ".....bccb.....",
    "......abb.....",
    ".....aaaa.....",
  ],
];

const fernPlant = (_rng: Rng, rows: readonly string[]) => {
  const s = blank();
  const [edge, a, b, c] = fern;
  stamp(s, rows, { a, b, c }, [1, TILE - 1 - rows.length]);
  return outlined(s, edge);
};

export const structures = [
  variants("tree", TREE_LOOKS, tree),
  variants("cactus", CACTUS_LOOKS, cactusPlant),
  variants("mushroom", MUSHROOM_LOOKS, mushroomPlant),
  variants("fern", FERN_LOOKS, fernPlant),
];
