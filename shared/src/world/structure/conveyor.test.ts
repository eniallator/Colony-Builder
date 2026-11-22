import { describe, expect, it } from "vitest";

import { REGION_SIDE_LENGTH } from "../../constants.ts";
import { facingDirOf, FACINGS, type Facing } from "../../facing.ts";
import {
  conveyorBends,
  conveyorFootprint,
  conveyorSpan,
  conveyorSpriteName,
  conveyorSpriteNames,
  splitConveyor,
} from "./conveyor.ts";
import type { Footprint } from "./footprint.ts";
import type { ConveyorData } from "./types.ts";

const stepsOf = (tiles: number) => tiles * REGION_SIDE_LENGTH;
const belt = (facing: Facing, tiles: number): ConveyorData => ({
  facing,
  length: stepsOf(tiles),
});

// Where a position along and across a belt's axis is in the world.
const worldPosOf = (
  facing: Facing,
  along: number,
  across: number
): [x: number, y: number] =>
  facingDirOf[facing].x() !== 0 ? [along, across] : [across, along];

const covers = ({ from, size }: Footprint, [x, y]: [number, number]) =>
  x >= from[0] &&
  x < from[0] + size[0] &&
  y >= from[1] &&
  y < from[1] + size[1];

describe("conveyorFootprint", () => {
  const tiles = 3;

  it.each(FACINGS)("covers every tile of a belt facing %s", facing => {
    const footprint = conveyorFootprint(belt(facing, tiles));
    const step = facingDirOf[facing];

    for (let tile = 0; tile < tiles; tile++) {
      const [x, y] = step.copy().multiply(tile).toArray();
      expect(covers(footprint, [x, y])).toBe(true);
    }
  });

  it.each(FACINGS)("stops short of both ends of a belt facing %s", facing => {
    const footprint = conveyorFootprint(belt(facing, tiles));
    const step = facingDirOf[facing];

    const [beforeX, beforeY] = step.copy().multiply(-1).toArray();
    const [afterX, afterY] = step.copy().multiply(tiles).toArray();
    expect(covers(footprint, [beforeX, beforeY])).toBe(false);
    expect(covers(footprint, [afterX, afterY])).toBe(false);
  });

  it.each(FACINGS)("is one tile wide when facing %s", facing => {
    const { size } = conveyorFootprint(belt(facing, tiles));

    expect(size.toSorted((a, b) => a - b)).toEqual([1, tiles]);
  });
});

describe("conveyorSpan", () => {
  const tiles = 4;

  it.each(FACINGS)("is the whole footprint from end to end (%s)", facing => {
    expect(conveyorSpan(facing, 0, tiles)).toEqual(
      conveyorFootprint(belt(facing, tiles))
    );
  });

  it.each(FACINGS)("covers only the tiles it is given (%s)", facing => {
    const step = facingDirOf[facing];
    const span = conveyorSpan(facing, 1, tiles - 1);

    const at = (tile: number): [number, number] => {
      const [x, y] = step.copy().multiply(tile).toArray();
      return [x, y];
    };
    expect(covers(span, at(0))).toBe(false);
    expect(covers(span, at(1))).toBe(true);
    expect(covers(span, at(tiles - 2))).toBe(true);
    expect(covers(span, at(tiles - 1))).toBe(false);
  });

  it.each(FACINGS)(
    "is one tile wide, as long as the tiles it spans (%s)",
    facing => {
      const { size } = conveyorSpan(facing, 1, tiles);

      expect(size.toSorted((a, b) => a - b)).toEqual([1, tiles - 1]);
    }
  );
});

describe("conveyorSpriteName", () => {
  it.each(FACINGS)("names a straight belt facing %s after it", facing => {
    expect(conveyorSpriteName(facing)).toContain(facing);
    expect(conveyorSpriteName(facing, null)).toBe(conveyorSpriteName(facing));
  });

  it.each(FACINGS)("names the turns of a belt facing %s apart", facing => {
    const names = [
      conveyorSpriteName(facing),
      ...conveyorBends.map(bend => conveyorSpriteName(facing, bend)),
    ];

    expect(new Set(names).size).toBe(1 + conveyorBends.length);
    for (const bend of conveyorBends) {
      expect(conveyorSpriteName(facing, bend)).toContain(bend);
    }
  });

  it("lists a different sprite for every facing and bend", () => {
    expect(new Set(conveyorSpriteNames).size).toBe(
      FACINGS.length * (1 + conveyorBends.length)
    );
  });
});

describe("splitConveyor", () => {
  const boundary = REGION_SIDE_LENGTH;
  const across = REGION_SIDE_LENGTH / 2 + 0.5;

  // A belt starting `before` tiles upstream of the region boundary.
  const startingBefore = (facing: Facing, before: number) => {
    const sign = facingDirOf[facing].toArray().reduce((a, b) => a + b);
    // The upstream edge, then half a tile on to the centre of the first tile.
    return worldPosOf(facing, boundary - sign * before + sign * 0.5, across);
  };

  it.each(FACINGS)(
    "leaves a belt that stays in one region whole (%s)",
    facing => {
      const start = startingBefore(facing, 3);

      expect(splitConveyor(start, facing, 2)).toEqual([
        { worldPos: start, data: belt(facing, 2) },
      ]);
    }
  );

  it.each(FACINGS)("cuts a belt exactly at the boundary (%s)", facing => {
    const sign = facingDirOf[facing].toArray().reduce((a, b) => a + b);
    const pieces = splitConveyor(startingBefore(facing, 4), facing, 6);

    expect(pieces).toEqual([
      { worldPos: startingBefore(facing, 4), data: belt(facing, 4) },
      {
        worldPos: worldPosOf(facing, boundary + sign * 0.5, across),
        data: belt(facing, 2),
      },
    ]);
  });

  it.each(FACINGS)("keeps the whole length across the cuts (%s)", facing => {
    const tiles = 2.5 * REGION_SIDE_LENGTH;
    const pieces = splitConveyor(startingBefore(facing, 4), facing, tiles);

    expect(pieces?.reduce((sum, { data }) => sum + data.length, 0)).toBe(
      stepsOf(tiles)
    );
  });

  it("makes pieces no longer than a region", () => {
    const pieces = splitConveyor(
      startingBefore(FACINGS[0], 0.5 * REGION_SIDE_LENGTH),
      FACINGS[0],
      3 * REGION_SIDE_LENGTH
    );

    for (const { data } of pieces ?? []) {
      expect(data.length).toBeLessThanOrEqual(stepsOf(REGION_SIDE_LENGTH));
    }
  });

  it.each(FACINGS)(
    "refuses a belt that leaves a piece too short to hold its anchor (%s)",
    facing => {
      expect(splitConveyor(startingBefore(facing, 0.25), facing, 3)).toBeNull();
    }
  );
});
