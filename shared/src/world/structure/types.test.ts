import { describe, expect, it } from "vitest";

import { REGION_SIDE_LENGTH } from "../../constants.ts";
import { FACINGS } from "../../facing.ts";
import { subRegionPosToId } from "../region.ts";
import {
  encConveyorLength,
  encRegionStructures,
  type RegionStructures,
} from "./types.ts";

describe("encConveyorLength", () => {
  const longest = REGION_SIDE_LENGTH ** 2;

  it("accepts whole numbers of steps up to a region's side in tiles", () => {
    expect(encConveyorLength.guard(1)).toBe(true);
    expect(encConveyorLength.guard(longest)).toBe(true);
  });

  it("rejects zero, fractions, and anything past a region", () => {
    expect(encConveyorLength.guard(0)).toBe(false);
    expect(encConveyorLength.guard(1.5)).toBe(false);
    expect(encConveyorLength.guard(longest + 1)).toBe(false);
  });

  it("round-trips", () => {
    expect(encConveyorLength.decode(encConveyorLength.encode(longest))).toBe(
      longest
    );
  });
});

describe("encRegionStructures", () => {
  it("round-trips the structures of a region", () => {
    const [facing] = FACINGS;
    const structures: RegionStructures = new Map([
      [subRegionPosToId(1, 2), { type: "tree", data: true }],
      [subRegionPosToId(200, 9), { type: "cactus", data: true }],
      [
        subRegionPosToId(7, 7),
        { type: "conveyor", data: { facing, length: 3 } },
      ],
    ]);

    expect(
      encRegionStructures.decode(encRegionStructures.encode(structures))
    ).toEqual(structures);
  });

  it("round-trips a region with none", () => {
    expect(
      encRegionStructures.decode(encRegionStructures.encode(new Map()))
    ).toEqual(new Map());
  });

  it("rejects a structure that is not in the registry", () => {
    expect(
      encRegionStructures.guard(
        new Map([[subRegionPosToId(0, 0), { type: "rock", data: true }]])
      )
    ).toBe(false);
  });
});
