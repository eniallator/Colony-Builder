// Conveyor belts, drawn once going up. A straight belt and a corner (fed from
// the left, so it turns anticlockwise) are rotated for the other facings, and
// the corner is mirrored for the clockwise turn. Sprite names come from the
// game (`conveyorSpriteName`), so the renderer finds what is drawn here.
//
// A belt is raised, so a beam facing the viewer (the bottom of a belt going
// sideways, or the outside of a corner) shows its front face: the rollers
// under the belt seen side-on, between its top run and its return run. It is
// painted after the belt is rotated,
// since which beams face the viewer depends on the facing.

import { FACINGS } from "../../../shared/src/facing.ts";
import {
  conveyorBends,
  conveyorSpriteName,
} from "../../../shared/src/world/structure/conveyor.ts";
import { blank, fill, put, putWrap, remap, ROTATE, TILE } from "../core.mjs";
import { PALETTE } from "../palette.mjs";

// Chevrons shift this many px per frame -> a 4-frame loop. Published to the
// client as `stepPx`, which derives the animation speed from it and the game's
// CONVEYOR_SPEED so the chevrons keep pace with items on the belt.
const STEP_PX = 2;
const FRAMES = 4;
// Where the chevrons are, along the belt, between one and the next.
const SPACING_PX = 8;

// How far the belt stands above the ground, in px. Published to the client as
// `raise`, which lifts whatever rides the belt by this much.
const RAISE_PX = 1;

// Rollers turn under the belt, one every this many px along it. This divides the
// loop's distance, so the rollers loop with the chevrons.
const ROLLER_SPACING_PX = 4;

const RAIL_PX = 4;
const { rail, railHi, base, arrow, arrowHi } = PALETTE.belt;
// A beam seen from above, from the ground edge in: a dark edge and a lit top,
// then the belt surface carries on over the rest of its width (which is what
// a front face fills when the beam faces the viewer). Every belt has the same
// beams, so they join the next one's, mirrored or not.
const BEAM = [rail, railHi, base, base];
// How much of a beam shows as a beam, the rest being belt surface.
const EDGE_PX = 2;

// Rollers are this many px across, and one every `ROLLER_SPACING_PX`.
const ROLLER_PX = 2;
// How far round its pixels each roller in a tile starts, so they do not all
// turn in step. They are out of order, so no roller follows its neighbour's lead.
const ROLLER_PHASES = [0, 2, 1, 3];
// A roller's pixels, clockwise from its top left. A dark one going round them
// turns the way the top of a roller under a belt moving right does.
const ROLLER_RIM = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

/**
 * What a front face shows at `column` of the tile, `row` px down it (0 is next
 * to the bed). The belt's top run is the first row and its return run the last,
 * with a row of rollers sandwiched between them. The dark pixel on each roller
 * moves a place a frame, so the loop closes after a turn.
 */
const rollerAt = (column, row, frame, clockwise) => {
  if (row === 0 || row === RAIL_PX - 1) return base;

  const x = column % ROLLER_SPACING_PX;
  if (x >= ROLLER_PX) return rail;

  const place = ROLLER_RIM.findIndex(([rx, ry]) => rx === x && ry === row - 1);
  const turned =
    frame +
    ROLLER_PHASES[
      Math.floor(column / ROLLER_SPACING_PX) % ROLLER_PHASES.length
    ];
  const marked =
    (((clockwise ? turned : -turned) % ROLLER_RIM.length) + ROLLER_RIM.length) %
    ROLLER_RIM.length;
  return place === marked ? rail : railHi;
};

/**
 * A belt going up: a bed between two beams, rollers turning under it, and
 * chevrons pointing up it.
 */
const straight = frame => {
  const s = fill(base);
  for (let y = 0; y < TILE; y++) {
    BEAM.forEach((colour, i) => {
      put(s, i, y, colour);
      put(s, TILE - 1 - i, y, colour);
    });
  }
  // A roller shows from above as a lit ridge across the bed.
  for (let k = 0; k < TILE / ROLLER_SPACING_PX; k++) {
    const y = k * ROLLER_SPACING_PX - frame * STEP_PX;
    for (let x = EDGE_PX; x < TILE - EDGE_PX; x++) putWrap(s, x, y, railHi);
  }
  for (const start of [0, SPACING_PX]) {
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

/**
 * What a turn has at a pixel: nothing (outside the ring), part of a beam
 * (`beam` says which, and `fromEdge` how far in from its ground edge) or the
 * bed. The belt is a quarter ring round the top left corner, so it is as wide
 * round the turn as it is on either side.
 */
const turningPixelAt = (x, y) => {
  const radius = Math.hypot(x + 0.5, y + 0.5);
  if (radius >= TILE) return null;
  if (radius < RAIL_PX) return { beam: "inner", fromEdge: Math.floor(radius) };
  if (radius >= TILE - RAIL_PX) {
    return { beam: "outer", fromEdge: TILE - 1 - Math.floor(radius) };
  }
  return { beam: null, fromEdge: 0 };
};

/**
 * A belt coming in from the left and going up: a quarter ring round the tile's
 * top left corner, with rollers and chevrons following the curve. Only its
 * outer beam has a front face, since one on the inner beam would cut into the
 * belt's surface.
 */
const turning = frame => {
  const s = blank();
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const pixel = turningPixelAt(x, y);
      if (pixel == null) continue;

      put(s, x, y, pixel.beam != null ? BEAM[pixel.fromEdge] : base);
    }
  }

  const middle = TILE / 2;
  const length = (middle * Math.PI) / 2;
  const mark = (along, radius, colour) => {
    const angle = Math.PI / 2 - along / middle;
    const x = Math.floor(radius * Math.cos(angle));
    const y = Math.floor(radius * Math.sin(angle));
    const pixel = turningPixelAt(x, y);
    // Not over a beam's dark edge or lit top, or off the belt.
    if (pixel == null || (pixel.beam != null && pixel.fromEdge < EDGE_PX)) {
      return;
    }
    put(s, x, y, colour);
  };

  // Rollers lie across the belt, like spokes, rolling from the left edge to the
  // top with the chevrons.
  const first = (frame * STEP_PX) % ROLLER_SPACING_PX;
  for (let along = first; along <= length; along += ROLLER_SPACING_PX) {
    for (let radius = EDGE_PX; radius < TILE - EDGE_PX; radius += 0.5) {
      mark(along, radius, railHi);
    }
  }

  // Chevrons ride the middle of the ring, going from the left edge to the top.
  for (const start of [0, SPACING_PX]) {
    const along = start + frame * STEP_PX;
    if (along > length) continue;

    const angle = Math.PI / 2 - along / middle;
    const ahead = [Math.sin(angle), -Math.cos(angle)];
    const outward = [Math.cos(angle), Math.sin(angle)];
    for (let i = 0; i < 4; i++) {
      for (const side of [-1, 1]) {
        const out = side * (0.5 + i);
        put(
          s,
          Math.floor(middle * outward[0] - i * ahead[0] + out * outward[0]),
          Math.floor(middle * outward[1] - i * ahead[1] + out * outward[1]),
          i === 0 ? arrowHi : arrow
        );
      }
    }
  }
  return s;
};

/**
 * The beam pixels of a belt, as they are drawn going up: where, how deep into
 * the beam from the bed (0 next to it, `RAIL_PX - 1` at the ground), which way
 * the beam faces, and which way the belt moves there.
 */
const STRAIGHT_BEAMS = Array.from({ length: TILE }, (_, y) =>
  Array.from({ length: RAIL_PX }, (_, i) => [
    {
      at: [i, y],
      depth: RAIL_PX - 1 - i,
      faces: [-1, 0],
      travels: [0, -1],
    },
    {
      at: [TILE - 1 - i, y],
      depth: RAIL_PX - 1 - i,
      faces: [1, 0],
      travels: [0, -1],
    },
  ])
).flat(2);

const TURNING_BEAMS = Array.from({ length: TILE * TILE }, (_, i) => [
  i % TILE,
  Math.floor(i / TILE),
]).flatMap(([x, y]) => {
  const pixel = turningPixelAt(x, y);
  if (pixel?.beam == null) return [];
  // The inner beam has no front face, which would cut into the belt's surface.
  if (pixel.beam === "inner") return [{ at: [x, y] }];

  const angle = Math.atan2(y + 0.5, x + 0.5);
  return [
    {
      at: [x, y],
      depth: RAIL_PX - 1 - pixel.fromEdge,
      faces: [Math.cos(angle), Math.sin(angle)],
      travels: [Math.sin(angle), -Math.cos(angle)],
    },
  ];
});

const MIRROR = (x, y) => [TILE - 1 - x, y];
const FACING_ROTATIONS = {
  up: (x, y) => [x, y],
  right: ROTATE.cw,
  down: ROTATE.half,
  left: ROTATE.ccw,
};
const BEND_ORIENTATIONS = {
  anticlockwise: (x, y) => [x, y],
  clockwise: MIRROR,
};

const compose = mappings => (x, y) =>
  mappings.reduce(([px, py], mapping) => mapping(px, py), [x, y]);

const pixelAt = (x, y) => (y * TILE + x) * 4;
const copyPixel = (from, fromX, fromY, to, toX, toY) => {
  to.set(
    from.subarray(pixelAt(fromX, fromY), pixelAt(fromX, fromY) + 4),
    pixelAt(toX, toY)
  );
};

const STRAIGHT = { draw: straight, beams: STRAIGHT_BEAMS, wraps: true };
const TURNING = { draw: turning, beams: TURNING_BEAMS, wraps: false };

/**
 * A sprite drawn as `drawing`, then moved by `mappings`. Its bed, the surface
 * between the beams, moves up a pixel so it stands proud of them, and the lit
 * beam colour shows under it where a front face begins. Beams that end up
 * facing down show that front face, turning the way the belt moves there.
 * With `wraps`, a bed's top row comes round to the bottom, so a belt that goes
 * on past the tile stays seamless. Without, it is lost, and the bottom row also
 * stays where it is so the tile below joins on.
 */
const sprite = (name, { draw, beams, wraps }, ...mappings) => {
  const place = compose(mappings);
  const [originX, originY] = place(0, 0);
  // Where a direction points once placed, so without moving it.
  const direction = (x, y) => {
    const [placedX, placedY] = place(x, y);
    return [placedX - originX, placedY - originY];
  };

  const placedBeams = beams.map(({ at, depth, faces, travels }) => ({
    at: place(...at),
    depth,
    front: faces != null && direction(...faces)[1] > 0.5,
    clockwise: travels != null && direction(...travels)[0] >= 0,
  }));
  const keyOf = (x, y) => y * TILE + x;
  const beamAt = new Set(placedBeams.map(({ at }) => keyOf(...at)));
  const frontAt = new Set(
    placedBeams.filter(({ front }) => front).map(({ at }) => keyOf(...at))
  );

  return {
    name,
    frames: Array.from({ length: FRAMES }, (_, frame) => {
      const placed = remap(draw(frame), place);
      const out = blank();

      const bed = [];
      for (let y = 0; y < TILE; y++) {
        for (let x = 0; x < TILE; x++) {
          if (placed[pixelAt(x, y) + 3] === 0) continue;

          if (beamAt.has(keyOf(x, y))) copyPixel(placed, x, y, out, x, y);
          else bed.push([x, y]);
        }
      }

      for (const [x, y] of bed) {
        const up = y > 0 ? y - 1 : wraps ? TILE - 1 : null;
        if (up != null) copyPixel(placed, x, y, out, x, up);
        if (!wraps && y === TILE - 1) copyPixel(placed, x, y, out, x, y);
      }
      // Where the bed was, the beam under it shows: the lit lip above a front
      // face, otherwise the beam's own colour, so no hole is left along a curve.
      for (const [x, y] of bed) {
        if (frontAt.has(keyOf(x, y + 1))) put(out, x, y, railHi);
        else if (beamAt.has(keyOf(x, y + 1))) {
          copyPixel(placed, x, y + 1, out, x, y);
        }
      }

      for (const {
        at: [x, y],
        depth,
        front,
        clockwise,
      } of placedBeams) {
        if (front) put(out, x, y, rollerAt(x, depth, frame, clockwise));
      }
      return out;
    }),
    stepPx: STEP_PX,
    raise: RAISE_PX,
  };
};

export const conveyors = FACINGS.flatMap(facing => [
  sprite(conveyorSpriteName(facing), STRAIGHT, FACING_ROTATIONS[facing]),
  ...conveyorBends.map(bend =>
    sprite(
      conveyorSpriteName(facing, bend),
      TURNING,
      BEND_ORIENTATIONS[bend],
      FACING_ROTATIONS[facing]
    )
  ),
]);
