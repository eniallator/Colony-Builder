// Conveyor belts. Draw one belt moving up, then derive the other directions by
// rotating it. A new belt tier (e.g. a fast belt) is one `conveyorFamily` line
// with its own colours.

import { fill, put, putWrap, remap, ROTATE, TILE } from "../core.mjs";
import { PALETTE } from "../palette.mjs";

// Chevrons shift this many px per frame -> a 4-frame loop. Published to the
// client as `stepPx`, which derives the animation speed from it and the game's
// CONVEYOR_SPEED so the chevrons keep pace with items on the belt.
const STEP_PX = 2;
const FRAMES = 4;

/** Belt moving up. */
const conveyorUp = (colours, frame) => {
  const { rail, railHi, base, arrow, arrowHi } = colours;
  const s = fill(base);
  for (let y = 0; y < TILE; y++) {
    put(s, 0, y, rail);
    put(s, 1, y, railHi);
    put(s, TILE - 2, y, railHi);
    put(s, TILE - 1, y, rail);
  }
  for (const start of [0, 8]) {
    const tip = start - frame * STEP_PX;
    // Chevron: tip at the top, arms sweeping down and outwards.
    for (let i = 0; i < 4; i++) {
      putWrap(s, 7 - i, tip + i, arrow);
      putWrap(s, 8 + i, tip + i, arrow);
    }
    putWrap(s, 7, tip, arrowHi);
    putWrap(s, 8, tip, arrowHi);
  }
  return s;
};

/** Produces `<prefix>_up|right|down|left`, `FRAMES` animation frames each. */
export const conveyorFamily = (prefix, colours) => {
  const up = Array.from({ length: FRAMES }, (_, f) => conveyorUp(colours, f));
  const rotated = mapping => up.map(f => remap(f, mapping));
  return [
    { name: `${prefix}_up`, frames: up, stepPx: STEP_PX },
    { name: `${prefix}_right`, frames: rotated(ROTATE.cw), stepPx: STEP_PX },
    { name: `${prefix}_down`, frames: rotated(ROTATE.half), stepPx: STEP_PX },
    { name: `${prefix}_left`, frames: rotated(ROTATE.ccw), stepPx: STEP_PX },
  ];
};

export const conveyors = [...conveyorFamily("conveyor", PALETTE.belt)];
