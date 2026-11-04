import { describe, expect, it } from "vitest";

import { REGION_SIDE_LENGTH } from "../constants.ts";
import {
  encRegionId,
  encTile,
  regionIdToPos,
  regionPosToId,
  regionsAround,
  regionToWorldPos,
  tiles,
  worldToRegionPos,
  type RegionId,
} from "./types.ts";

describe("regionPosToId / regionIdToPos", () => {
  it("packs x into the high 32 bits and y into the low 32 bits", () => {
    expect(regionPosToId(0, 0)).toBe(0n);
    expect(regionPosToId(1, 2)).toBe((1n << 32n) | 2n);
    expect(regionPosToId(-3, 7)).toBe((0xfffffffdn << 32n) | 7n);
  });

  it("unpacks an id back into numbers", () => {
    const id = ((0xfffffffdn << 32n) | 7n) as RegionId;

    expect(regionIdToPos(id)).toEqual([-3, 7]);
  });

  it("round-trips", () => {
    expect(regionIdToPos(regionPosToId(12, -34))).toEqual([12, -34]);
  });

  it("round-trips the full i32 range", () => {
    const min = -(2 ** 31);
    const max = 2 ** 31 - 1;

    expect(regionIdToPos(regionPosToId(min, max))).toEqual([min, max]);
    expect(regionIdToPos(regionPosToId(max, min))).toEqual([max, min]);
  });
});

describe("worldToRegionPos", () => {
  it("maps every position in a region to that region", () => {
    expect(worldToRegionPos(0, 0)).toEqual([0, 0]);
    expect(worldToRegionPos(REGION_SIDE_LENGTH - 0.5, 1)).toEqual([0, 0]);
    expect(
      worldToRegionPos(REGION_SIDE_LENGTH, 2 * REGION_SIDE_LENGTH)
    ).toEqual([1, 2]);
  });

  it("rounds towards negative infinity", () => {
    expect(worldToRegionPos(-0.5, -REGION_SIDE_LENGTH)).toEqual([-1, -1]);
    expect(worldToRegionPos(-REGION_SIDE_LENGTH - 0.5, 0)).toEqual([-2, 0]);
  });
});

describe("regionsAround", () => {
  it("lists the square of regions in x-major order", () => {
    expect(regionsAround(0, 0, 2).map(regionIdToPos)).toEqual([
      [-1, -1],
      [-1, 0],
      [0, -1],
      [0, 0],
    ]);
  });

  it("is centred on the given region", () => {
    const ids = regionsAround(3, -2, 4);

    expect(ids).toHaveLength(16);
    expect(ids[0]).toBe(regionPosToId(1, -4));
    expect(ids.at(-1)).toBe(regionPosToId(4, -1));
  });

  it("is empty for a side length of zero", () => {
    expect(regionsAround(0, 0, 0)).toEqual([]);
  });
});

describe("regionToWorldPos", () => {
  it("gives the world position of a region's corner", () => {
    expect(regionToWorldPos(0, 0)).toEqual([0, 0]);
    expect(regionToWorldPos(2, -1)).toEqual([
      2 * REGION_SIDE_LENGTH,
      -REGION_SIDE_LENGTH,
    ]);
  });

  it("is inverted by worldToRegionPos", () => {
    expect(worldToRegionPos(...regionToWorldPos(-3, 5))).toEqual([-3, 5]);
  });
});

describe("encRegionId", () => {
  it("accepts a u64 bigint", () => {
    expect(encRegionId.guard(0n)).toBe(true);
    expect(encRegionId.guard(regionPosToId(3, -4))).toBe(true);
    expect(encRegionId.guard(2n ** 64n - 1n)).toBe(true);
  });

  it("rejects values that are not a u64 bigint", () => {
    expect(encRegionId.guard(0)).toBe(false);
    expect(encRegionId.guard("0,0")).toBe(false);
    expect(encRegionId.guard(-1n)).toBe(false);
    expect(encRegionId.guard(2n ** 64n)).toBe(false);
  });

  it("encodes as two little-endian i32s", () => {
    expect(encRegionId.encode(regionPosToId(1, -2))).toEqual(
      Uint8Array.of(1, 0, 0, 0, 0xfe, 0xff, 0xff, 0xff)
    );
  });

  it("round-trips", () => {
    const id = regionPosToId(-70000, 123456);

    expect(encRegionId.decode(encRegionId.encode(id))).toBe(id);
  });

  it("returns undefined for truncated bytes", () => {
    expect(encRegionId.decode(Uint8Array.of(1, 0, 0, 0))).toBeUndefined();
  });
});

describe("encTile", () => {
  it("lists every tile", () => {
    expect(tiles).toEqual([
      "grass",
      "swampland",
      "jungle",
      "water",
      "sand",
      "stone",
      "conveyor_up",
      "conveyor_down",
      "conveyor_left",
      "conveyor_right",
    ]);
  });

  it.each(tiles)("round-trips %s", tile => {
    expect(encTile.decode(encTile.encode(tile))).toBe(tile);
  });

  it("rejects an unknown tile", () => {
    expect(encTile.guard("lava")).toBe(false);
  });
});
