import { describe, expect, it } from "vitest";

import { encTileId, idToTile, tiles, tileToId } from "./types.ts";

describe("tiles", () => {
  it("lists every tile", () => {
    expect(tiles).toEqual([
      "grass",
      "swampland",
      "jungle",
      "water",
      "sand",
      "stone",
      "iron_deposit",
      "copper_deposit",
    ]);
  });
});

describe("tileToId / idToTile", () => {
  it("numbers the tiles in order", () => {
    expect(tiles.map(tileToId)).toEqual(tiles.map((_, idx) => idx));
  });

  it.each(tiles)("round-trips %s", tile => {
    expect(idToTile(tileToId(tile))).toBe(tile);
  });
});

describe("encTileId", () => {
  it.each(tiles)("round-trips %s", tile => {
    const id = tileToId(tile);

    expect(encTileId.decode(encTileId.encode(id))).toBe(id);
  });

  it("encodes as a single byte", () => {
    expect(encTileId.encode(tileToId("sand"))).toEqual(
      Uint8Array.of(tiles.indexOf("sand"))
    );
  });

  it("accepts only whole numbers that are a tile's index", () => {
    expect(encTileId.guard(0)).toBe(true);
    expect(encTileId.guard(tiles.length - 1)).toBe(true);
    expect(encTileId.guard(tiles.length)).toBe(false);
    expect(encTileId.guard(-1)).toBe(false);
    expect(encTileId.guard(1.5)).toBe(false);
    expect(encTileId.guard("grass")).toBe(false);
  });

  it("returns undefined for a byte that is not a tile's index", () => {
    expect(encTileId.decode(Uint8Array.of(tiles.length))).toBeUndefined();
  });
});
