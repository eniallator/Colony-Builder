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
  unsafeRegionId,
  worldToRegionPos,
} from "./types.ts";

describe("regionPosToId / regionIdToPos", () => {
  it("formats a position as comma separated numbers", () => {
    expect(regionPosToId(0, 0)).toBe("0,0");
    expect(regionPosToId(-3, 7)).toBe("-3,7");
  });

  it("parses an id back into numbers", () => {
    expect(regionIdToPos(unsafeRegionId("-3,7"))).toEqual([-3, 7]);
  });

  it("round-trips", () => {
    expect(regionIdToPos(regionPosToId(12, -34))).toEqual([12, -34]);
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
    expect(regionsAround(0, 0, 2)).toEqual(["-1,-1", "-1,0", "0,-1", "0,0"]);
  });

  it("is centred on the given region", () => {
    const ids = regionsAround(3, -2, 4);

    expect(ids).toHaveLength(16);
    expect(ids[0]).toBe("1,-4");
    expect(ids.at(-1)).toBe("4,-1");
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
  it("accepts a pair of integers, including negative ones", () => {
    expect(encRegionId.guard("0,0")).toBe(true);
    expect(encRegionId.guard("3,-4")).toBe(true);
  });

  it("rejects values that are not a pair of integers", () => {
    expect(encRegionId.guard(0)).toBe(false);
    expect(encRegionId.guard("1")).toBe(false);
    expect(encRegionId.guard("1,2,3")).toBe(false);
    expect(encRegionId.guard("1.5,2")).toBe(false);
    expect(encRegionId.guard("a,b")).toBe(false);
  });

  it("encodes as two little-endian i32s", () => {
    expect(encRegionId.encode(unsafeRegionId("1,-2"))).toEqual(
      Uint8Array.of(1, 0, 0, 0, 0xfe, 0xff, 0xff, 0xff)
    );
  });

  it("round-trips", () => {
    const id = unsafeRegionId("-70000,123456");

    expect(encRegionId.decode(encRegionId.encode(id))).toBe(id);
  });

  it("returns undefined for truncated bytes", () => {
    expect(encRegionId.decode(Uint8Array.of(1, 0, 0, 0))).toBeUndefined();
  });
});

describe("encTile", () => {
  it("lists every tile", () => {
    expect(tiles).toEqual(["grass", "dirt", "water", "sand", "stone"]);
  });

  it.each(tiles)("round-trips %s", tile => {
    expect(encTile.decode(encTile.encode(tile))).toBe(tile);
  });

  it("rejects an unknown tile", () => {
    expect(encTile.guard("lava")).toBe(false);
  });
});
