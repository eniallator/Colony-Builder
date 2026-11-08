// Moving entities: 4 facing directions x 2 walk frames. To add one, write a
// `draw(dir, frame)` and add a `directional(...)` line. Sprite names must be
// `<entityType>_<dir>`. Frame 1 bobs up 1px; shadows are drawn separately.

import { blank, put, rect, roundBox } from "../core.mjs";
import { PALETTE } from "../palette.mjs";
import { directional } from "./define.mjs";

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

export const entities = [
  ...directional("robot", 2, robot),
  ...directional("player", 2, player),
];
