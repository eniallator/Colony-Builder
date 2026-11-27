import { describe, expect, it } from "vitest";

import { REGION_SIDE_LENGTH } from "../../constants.ts";
import {
  encRegionTiles,
  encTileId,
  idToTile,
  tiles,
  tileToId,
  type RegionTiles,
  type TileId,
} from "./types.ts";

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

describe("encRegionTiles", () => {
  const count = REGION_SIDE_LENGTH ** 2;
  const region = (tileAt: (i: number) => TileId): RegionTiles =>
    Array.from({ length: count }, (_, i) => tileAt(i));

  const firstTile = tileToId(tiles[0]);
  const secondTile = tileToId(tiles[1]);
  const uniform = region(() => firstTile);
  const checkerboard = region(i => (i % 2 ? secondTile : firstTile));

  it("round-trips a region", () => {
    expect(encRegionTiles.decode(encRegionTiles.encode(uniform))).toEqual(
      uniform
    );
    expect(encRegionTiles.decode(encRegionTiles.encode(checkerboard))).toEqual(
      checkerboard
    );
  });

  it("run-length encodes runs of the same tile", () => {
    // The fixedrle mode, then 256 uniform tiles as a run of 255 and a run of 1.
    expect(encRegionTiles.encode(uniform)).toEqual(
      Uint8Array.of(3, 255, 0, 1, 0)
    );
  });

  it("stores one byte per tile when no neighbours match", () => {
    // The fixed mode, then every tile.
    const encoded = encRegionTiles.encode(checkerboard);

    expect(encoded).toHaveLength(1 + count);
    expect(encoded[0]).toBe(2);
  });

  it("rejects a region with the wrong number of tiles", () => {
    expect(encRegionTiles.guard(uniform.slice(1))).toBe(false);
    expect(encRegionTiles.guard([...uniform, firstTile])).toBe(false);
  });

  it("rejects an unknown tile", () => {
    expect(encRegionTiles.guard(uniform.map(() => "not a tile"))).toBe(false);
  });
});
