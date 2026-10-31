import { describe, expect, it } from "vitest";

import { encRegionId, encTile, tiles, unsafeRegionId } from "./types.ts";

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
