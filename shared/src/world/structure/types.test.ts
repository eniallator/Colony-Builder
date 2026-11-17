import { describe, expect, it } from "vitest";

import { REGION_SIDE_LENGTH } from "../../constants.ts";
import { regionPosToId } from "../terrain/index.ts";
import {
  encRegionStructures,
  encSubRegionId,
  regionIdsToWorldPos,
  relativePosToSubRegionPos,
  subRegionIdToPos,
  subRegionPosToId,
  subRegionPosToRelativePos,
  worldPosToRegionIds,
  type RegionStructures,
} from "./types.ts";

describe("subRegionPosToId / subRegionIdToPos", () => {
  it("packs x into the high byte and y into the low byte", () => {
    expect(subRegionPosToId(0, 0)).toBe(0);
    expect(subRegionPosToId(1, 2)).toBe(0x0102);
    expect(subRegionPosToId(255, 255)).toBe(0xffff);
  });

  it("unpacks an id back into its position", () => {
    expect(subRegionIdToPos(subRegionPosToId(1, 2))).toEqual([1, 2]);
    expect(subRegionIdToPos(subRegionPosToId(248, 17))).toEqual([248, 17]);
  });
});

describe("relativePosToSubRegionPos / subRegionPosToRelativePos", () => {
  it("measures a position in a region in 1/REGION_SIDE_LENGTH tiles", () => {
    expect(relativePosToSubRegionPos(0, 0)).toEqual([0, 0]);
    expect(relativePosToSubRegionPos(1.5, 3)).toEqual([
      1.5 * REGION_SIDE_LENGTH,
      3 * REGION_SIDE_LENGTH,
    ]);
  });

  it("rounds down to the sub-region position", () => {
    expect(relativePosToSubRegionPos(1 / REGION_SIDE_LENGTH + 0.01, 0)).toEqual(
      [1, 0]
    );
  });

  it("is inverted by subRegionPosToRelativePos", () => {
    expect(
      subRegionPosToRelativePos(...relativePosToSubRegionPos(2.5, 7))
    ).toEqual([2.5, 7]);
  });
});

describe("worldPosToRegionIds / regionIdsToWorldPos", () => {
  it("finds the region and the position inside it", () => {
    const [region, sub] = worldPosToRegionIds(
      REGION_SIDE_LENGTH + 1.5,
      2 * REGION_SIDE_LENGTH + 3
    );

    expect(region).toBe(regionPosToId(1, 2));
    expect(subRegionIdToPos(sub)).toEqual(relativePosToSubRegionPos(1.5, 3));
  });

  it("handles negative positions", () => {
    const [region, sub] = worldPosToRegionIds(-0.5, -REGION_SIDE_LENGTH - 0.5);

    expect(region).toBe(regionPosToId(-1, -2));
    expect(subRegionIdToPos(sub)).toEqual(
      relativePosToSubRegionPos(
        REGION_SIDE_LENGTH - 0.5,
        REGION_SIDE_LENGTH - 0.5
      )
    );
  });

  it("is inverted by regionIdsToWorldPos", () => {
    const positions: [x: number, y: number][] = [
      [0, 0],
      [17.5, 33.25],
      [-0.5, -16.5],
      [-40.75, 21],
    ];

    for (const pos of positions) {
      expect(regionIdsToWorldPos(...worldPosToRegionIds(...pos))).toEqual(pos);
    }
  });
});

describe("encSubRegionId", () => {
  it("accepts whole numbers that fit in two bytes", () => {
    expect(encSubRegionId.guard(0)).toBe(true);
    expect(encSubRegionId.guard(subRegionPosToId(255, 254))).toBe(true);
  });

  it("rejects anything else", () => {
    expect(encSubRegionId.guard(-1)).toBe(false);
    expect(encSubRegionId.guard(2 ** 16)).toBe(false);
    expect(encSubRegionId.guard(1.5)).toBe(false);
    expect(encSubRegionId.guard("1")).toBe(false);
  });
});

describe("encRegionStructures", () => {
  it("round-trips the structures of a region", () => {
    const structures: RegionStructures = new Map([
      [subRegionPosToId(1, 2), { id: "tree", data: true }],
      [subRegionPosToId(200, 9), { id: "cactus", data: true }],
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
        new Map([[subRegionPosToId(0, 0), { id: "rock", data: true }]])
      )
    ).toBe(false);
  });
});
