// Moving entities: 4 facing directions x 2 walk frames. To add one, write a
// `draw(dir, frame)` and add a `directional(...)` line. Sprite names must be
// `<entityType>_<dir>`. Frame 1 bobs up 1px; shadows are drawn separately.

import { blank, put, rect, roundBox, TILE } from "../core.mjs";
import { PALETTE } from "../palette.mjs";
import { directional, DIRS } from "./define.mjs";

const robot = (dir, frame) => {
  const { dark, base, light, visor, glow, led } = PALETTE.robot;
  const s = blank();
  const dy = frame === 1 ? -1 : 0;
  // Treads peek out below the body, which bobs up on the second frame.
  for (const x of [4, 5, 10, 11]) put(s, x, 13, PALETTE.outline);
  for (const x of [4, 11]) put(s, x, 12, PALETTE.outline);
  roundBox(s, 3, 3 + dy, 10, 10, {
    fillC: base,
    hi: light,
    lo: dark,
    outline: PALETTE.outline,
  });
  if (dir === "down") {
    rect(s, 5, 8 + dy, 6, 2, visor);
    put(s, 6, 9 + dy, glow);
    put(s, 9, 9 + dy, glow);
  } else if (dir === "up") {
    rect(s, 5, 5 + dy, 6, 4, dark);
    put(s, 7, 6 + dy, led);
    put(s, 8, 6 + dy, base);
  } else if (dir === "left") {
    rect(s, 4, 6 + dy, 2, 4, visor);
    put(s, 4, 7 + dy, glow);
    put(s, 4, 8 + dy, glow);
    rect(s, 9, 5 + dy, 2, 5, dark);
  } else {
    rect(s, 10, 6 + dy, 2, 4, visor);
    put(s, 11, 7 + dy, glow);
    put(s, 11, 8 + dy, glow);
    rect(s, 5, 5 + dy, 2, 5, dark);
  }
  return s;
};

const player = (dir, frame) => {
  const p = PALETTE.player;
  const s = blank();
  const dy = frame === 1 ? -1 : 0;
  // Feet alternate between frames.
  for (const x of frame === 0 ? [5, 10] : [6, 9]) put(s, x, 14, p.feet);
  roundBox(s, 4, 9 + dy, 8, 5, {
    fillC: p.tunic,
    hi: p.tunicLight,
    lo: p.tunicDark,
    outline: PALETTE.outline,
  });
  roundBox(s, 4, 2 + dy, 8, 8, {
    fillC: p.skin,
    hi: p.skin,
    lo: p.skin,
    outline: PALETTE.outline,
  });
  if (dir === "down") {
    rect(s, 5, 3 + dy, 6, 2, p.hair);
    put(s, 6, 6 + dy, PALETTE.outline);
    put(s, 9, 6 + dy, PALETTE.outline);
  } else if (dir === "up") {
    rect(s, 5, 3 + dy, 6, 6, p.hair);
  } else if (dir === "left") {
    rect(s, 5, 3 + dy, 6, 2, p.hair);
    rect(s, 8, 5 + dy, 3, 3, p.hair);
    put(s, 5, 6 + dy, PALETTE.outline);
  } else {
    rect(s, 5, 3 + dy, 6, 2, p.hair);
    rect(s, 5, 5 + dy, 3, 3, p.hair);
    put(s, 10, 6 + dy, PALETTE.outline);
  }
  return s;
};

// Walk cycle: time each of the two frames is shown while moving.
const WALK = { frameSec: 0.16 };

// Gathering: a tool swung down from a raised position, 4 frames. The body sits
// up 1px (`lift`) while the tool is raised. `handle` is the direction the
// handle points from the grip (as if facing right) and `len` how many pixels
// long it looks.
//  - Side-on: the handle turns a step round the grip, from raised to striking.
//  - Facing the viewer: the tool swings toward them, so it shortens while it
//    comes down past the grip, then reaches out below it.
//  - Facing away: the tool swings away, so it dips behind the body's top edge.
const SWINGS = {
  side: [
    { lift: 1, handle: [0, -1], len: 2 },
    { lift: 1, handle: [1, -1], len: 2 },
    { lift: 0, handle: [1, 0], len: 2 },
    { lift: 0, handle: [1, 1], len: 2 },
  ],
  toward: [
    { lift: 1, handle: [0, -1], len: 2 },
    { lift: 1, handle: [0, -1], len: 1 },
    { lift: 0, handle: [0, 1], len: 1 },
    { lift: 0, handle: [0, 1], len: 2 },
  ],
  away: [
    { lift: 1, handle: [0, -1], len: 2 },
    { lift: 1, handle: [0, -1], len: 2 },
    { lift: 0, handle: [0, -1], len: 1 },
    { lift: 0, handle: [0, -1], len: 1 },
  ],
};
const SWING_OF = {
  left: "side",
  right: "side",
  down: "toward",
  up: "away",
};
const GATHER = { frameSec: 0.15 };

/**
 * The pixels of a tool held at `grip`, as [x, y, colour] with the grip hand
 * first, then the handle and a head across its tip.
 */
const toolPixels = ([gx, gy], [hx, hy], len, hand) => {
  const { ore, log } = PALETTE;
  const tip = [gx + len * hx, gy + len * hy];
  // Across the handle's tip, so the head turns with the handle.
  const [px, py] = [-hy, hx];
  const handle = Array.from({ length: len - 1 }, (_, i) => [
    gx + (i + 1) * hx,
    gy + (i + 1) * hy,
    log.bark,
  ]);
  return [
    [gx, gy, hand],
    ...handle,
    [...tip, log.barkLight],
    [tip[0] + px, tip[1] + py, ore[1]],
    [tip[0] - px, tip[1] - py, ore[2]],
  ];
};

/** Puts `pixels` on `s` with a 1px outline around them, like the rest of the art. */
const drawOutlined = (s, pixels) => {
  const covered = new Set(pixels.map(([x, y]) => y * TILE + x));
  const isEmpty = (x, y) =>
    x >= 0 &&
    y >= 0 &&
    x < TILE &&
    y < TILE &&
    s[(y * TILE + x) * 4 + 3] === 0 &&
    !covered.has(y * TILE + x);
  for (const [x, y] of pixels) {
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      if (isEmpty(x + dx, y + dy)) put(s, x + dx, y + dy, PALETTE.outline);
    }
  }
  for (const [x, y, colour] of pixels) put(s, x, y, colour);
};

/**
 * Wraps a body drawing into a gather frame: the body with a tool swung out
 * from `grip` (a point just outside the right edge of the body, at about arm
 * height). The tool is in the hand on the right as seen when facing right or
 * towards the viewer, and mirrored to the left for the other two facings.
 */
const gathering = (draw, grip, hand) => (dir, frame) => {
  const { lift, handle, len } = SWINGS[SWING_OF[dir]][frame];
  const s = draw(dir, lift);
  const mirrored = dir === "left" || dir === "up";
  const pixels = toolPixels(
    [mirrored ? TILE - 1 - grip[0] : grip[0], grip[1] - lift],
    [mirrored ? -handle[0] : handle[0], handle[1]],
    len,
    hand
  );
  drawOutlined(s, pixels);
  return s;
};

const gatherSprites = (name, draw, grip, hand) =>
  DIRS.map(dir => ({
    name: `${name}_gather_${dir}`,
    frames: SWINGS[SWING_OF[dir]].map((_, frame) =>
      gathering(draw, grip, hand)(dir, frame)
    ),
    ...GATHER,
  }));

export const entities = [
  ...directional("robot", 2, robot, WALK),
  ...directional("player", 2, player, WALK),
  ...gatherSprites("robot", robot, [13, 9], PALETTE.robot.light),
  ...gatherSprites("player", player, [12, 11], PALETTE.player.skin),
];
