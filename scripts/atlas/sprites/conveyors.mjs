// Conveyor belts, drawn once going up. A straight belt and a corner (fed from
// the left, so it turns anticlockwise) are rotated for the other facings, and
// the corner is mirrored for the clockwise turn. Sprite names come from the
// game (`conveyorSpriteName`), so the renderer finds what is drawn here.
//
// A belt is raised, so a side facing the viewer shows its front face. On a belt
// going sideways that is the rollers under it seen side-on, between its top run
// and its return run; round the outside of a corner it is a plain shadow under
// one curved edge. It is painted after the belt is rotated, since which sides
// face the viewer depends on the facing.

import {
  conveyorBends,
  conveyorSpriteName,
} from "../../../client/src/render/structure-sprites.ts";
import { FACINGS } from "../../../shared/src/facing.ts";
import { blank, fill, put, putWrap, remap, ROTATE, TILE } from "../core.mjs";
import { PALETTE } from "../palette.mjs";

// Chevrons shift this many px per frame. Published to the client as `stepPx`,
// which derives the animation speed from it and the game's CONVEYOR_SPEED so
// the chevrons keep pace with items on the belt.
const STEP_PX = 2;
// How far apart the chevrons are along the belt: one a tile.
const SPACING_PX = TILE;
// The loop closes once each chevron has reached the next one's place.
const FRAMES = SPACING_PX / STEP_PX;
// How far each arm of a chevron reaches out from its tip.
const ARM_PX = 3;

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

/** A belt going up: a plain bed between two beams, and a chevron pointing up it. */
const straight = frame => {
  const s = fill(base);
  for (let y = 0; y < TILE; y++) {
    BEAM.forEach((colour, i) => {
      put(s, i, y, colour);
      put(s, TILE - 1 - i, y, colour);
    });
  }
  const tip = -frame * STEP_PX;
  // Chevron: tip at the top, arms sweeping down and outwards.
  for (let i = 0; i < ARM_PX; i++) {
    const colour = i === 0 ? arrowHi : arrow;
    putWrap(s, 7 - i, tip + i, colour);
    putWrap(s, 8 + i, tip + i, colour);
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
 * top left corner. Its chevrons are `turningChevrons`. Only its outer beam has
 * a front face, since one on the inner beam would cut into the belt's surface.
 */
const turning = () => {
  const s = blank();
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const pixel = turningPixelAt(x, y);
      if (pixel == null) continue;

      put(s, x, y, pixel.beam != null ? BEAM[pixel.fromEdge] : base);
    }
  }
  return s;
};

/**
 * The chevron pixels of a turn, as [x, y, colour], some of them off the tile.
 * A chevron rides the middle of the ring, from the left edge to the top, in as
 * long as it takes to cross a straight tile, so it stays in step with the belts
 * either side. As on a straight tile, a tip starts on the last pixel before
 * this one, and the chevron ahead still trails into it.
 */
const turningChevrons = frame => {
  const middle = TILE / 2;
  return [-0.5, SPACING_PX - 0.5].flatMap(lead => {
    const progress = (((frame * STEP_PX + lead) / TILE) * Math.PI) / 2;
    const angle = Math.PI / 2 - progress;
    const ahead = [Math.sin(angle), -Math.cos(angle)];
    const outward = [Math.cos(angle), Math.sin(angle)];
    return [-1, 1].flatMap(side => {
      // The pixel `i` along one arm, counting from the tip.
      const along = i =>
        [0, 1].map(axis =>
          Math.floor(
            (middle + side * (0.5 + i)) * outward[axis] - i * ahead[axis]
          )
        );
      const [tipX, tipY] = along(0);
      const [endX, endY] = along(ARM_PX - 1);
      // Joined up from end to end, so a slanted arm never breaks apart.
      const steps = Math.max(Math.abs(endX - tipX), Math.abs(endY - tipY));
      return Array.from({ length: steps + 1 }, (_, i) => [
        Math.round(tipX + ((endX - tipX) * i) / steps),
        Math.round(tipY + ((endY - tipY) * i) / steps),
        i === 0 ? arrowHi : arrow,
      ]);
    });
  });
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

// A turn's beams show no rollers: `shadeCurvedFace` draws the side of a curve
// that faces the viewer.
const TURNING_BEAMS = Array.from({ length: TILE * TILE }, (_, i) => [
  i % TILE,
  Math.floor(i / TILE),
]).flatMap(([x, y]) =>
  turningPixelAt(x, y)?.beam != null ? [{ at: [x, y] }] : []
);

/**
 * Redraws the outer side of a corner which faces the viewer, round the inner
 * corner at (`centreX`, 0): a single lit edge sweeping from the lit top of the
 * beam going away to the lip above the front face of the belt going sideways,
 * with that face in shadow under it.
 */
const shadeCurvedFace = (s, centreX) => {
  // Whether a pixel, `across` and `down` from the centre, is on top of the belt.
  const onTop = (across, down) =>
    Math.hypot(across / (TILE - 1), down / (TILE - RAIL_PX)) <= 1;

  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      if (s[pixelAt(x, y) + 3] === 0) continue;

      const across = Math.abs(x + 0.5 - centreX);
      const down = y + 0.5;
      if (!onTop(across, down)) put(s, x, y, rail);
      else if (!onTop(across + 1, down) || !onTop(across, down + 1)) {
        put(s, x, y, railHi);
      } else if (Math.hypot(across, down) >= TILE - RAIL_PX) {
        put(s, x, y, base);
      }
    }
  }
};

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
const TURNING = {
  draw: turning,
  beams: TURNING_BEAMS,
  wraps: false,
  curve: turningChevrons,
};

/**
 * A sprite drawn as `drawing`, then moved by `mappings`. Its bed, the surface
 * between the beams, moves up a pixel so it stands proud of them, and the lit
 * beam colour shows under it where a front face begins. Beams that end up
 * facing down show that front face, turning the way the belt moves there.
 * With `wraps`, a bed's top row comes round to the bottom, so a belt that goes
 * on past the tile stays seamless. Without, it is lost, and the bottom row also
 * stays where it is so the tile below joins on.
 *
 * A turn gives `curve`, its chevrons for a frame. They are painted after the bed
 * moves, so that what comes in from the next tile is not lost. A turn whose
 * inner corner ends up at the top also has its outer side towards the viewer.
 */
const sprite = (name, { draw, beams, wraps, curve }, ...mappings) => {
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
      if (curve != null) {
        if (originY === 0) shadeCurvedFace(out, originX === 0 ? 0 : TILE);
        for (const [x, y, colour] of curve(frame)) {
          const [placedX, placedY] = place(x, y);
          put(out, placedX, placedY - 1, colour);
        }
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
