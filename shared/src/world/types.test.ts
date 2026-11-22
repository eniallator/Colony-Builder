import { describe, expect, it } from "vitest";

import { REGION_SIDE_LENGTH } from "../constants.ts";
import { FACINGS } from "../facing.ts";
import { regionPosToId, subRegionPosToId } from "./region.ts";
import { tiles, tileToId, type RegionTiles } from "./terrain/types.ts";
import { encWorldSnapshot, type WorldSnapshot } from "./types.ts";

describe("encWorldSnapshot", () => {
  const [tile] = tiles;
  const [facing] = FACINGS;
  const regionTiles: RegionTiles = Array.from(
    { length: REGION_SIDE_LENGTH ** 2 },
    () => tileToId(tile)
  );

  it("round-trips the tiles and structures of several regions", () => {
    const snapshot: WorldSnapshot = new Map([
      [
        regionPosToId(0, 0),
        {
          tiles: regionTiles,
          structures: new Map([
            [subRegionPosToId(1, 2), { type: "tree", data: true }],
          ]),
        },
      ],
      [
        regionPosToId(-1, 3),
        {
          tiles: regionTiles,
          structures: new Map([
            [
              subRegionPosToId(4, 5),
              { type: "conveyor", data: { facing, length: 2 } },
            ],
          ]),
        },
      ],
    ]);

    expect(encWorldSnapshot.decode(encWorldSnapshot.encode(snapshot))).toEqual(
      snapshot
    );
  });

  it("round-trips an empty snapshot", () => {
    expect(encWorldSnapshot.decode(encWorldSnapshot.encode(new Map()))).toEqual(
      new Map()
    );
  });
});
