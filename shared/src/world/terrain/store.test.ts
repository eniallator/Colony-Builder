import { describe, expect, it } from "vitest";

import { REGION_SIDE_LENGTH } from "../../constants.ts";
import { regionPosToId } from "../region.ts";
import { tiles, tileToId, type RegionTiles, type Tile } from "./index.ts";
import { TerrainStore } from "./store.ts";

const [baseTile, altTile, markerTile] = tiles;

const region = (
  tileAt: (x: number, y: number) => Tile = () => baseTile
): RegionTiles =>
  Array.from({ length: REGION_SIDE_LENGTH ** 2 }, (_, i) =>
    tileToId(tileAt(i % REGION_SIDE_LENGTH, Math.floor(i / REGION_SIDE_LENGTH)))
  );

const baseRegion = region();
const altRegion = region(() => altTile);

const origin = regionPosToId(0, 0);
const other = regionPosToId(-1, 2);

const storeWith = (
  ...entries: [x: number, y: number, region: RegionTiles][]
): TerrainStore => {
  const store = new TerrainStore();
  for (const [x, y, tilesOfRegion] of entries) {
    store.add(regionPosToId(x, y), tilesOfRegion);
  }
  return store;
};

describe("TerrainStore", () => {
  describe("add / optGet / get", () => {
    it("stores and returns regions by id", () => {
      const store = new TerrainStore();
      store.add(origin, baseRegion);
      store.add(other, altRegion);

      expect(store.get(origin)).toBe(baseRegion);
      expect(store.optGet(other)).toBe(altRegion);
    });

    it("overwrites the region at an id", () => {
      const store = new TerrainStore();
      store.add(origin, baseRegion);
      store.add(origin, altRegion);

      expect(store.get(origin)).toBe(altRegion);
    });

    it("returns undefined from optGet when there is no region", () => {
      expect(new TerrainStore().optGet(origin)).toBeUndefined();
    });

    it("throws from get when there is no region", () => {
      expect(() => new TerrainStore().get(regionPosToId(3, -4))).toThrow(
        "No region exists at 3,-4"
      );
    });
  });

  describe("delete", () => {
    it("removes a region and reports whether it existed", () => {
      const store = storeWith([0, 0, baseRegion]);

      expect(store.delete(origin)).toBe(true);
      expect(store.delete(origin)).toBe(false);
      expect(store.optGet(origin)).toBeUndefined();
    });
  });

  describe("ids / positions", () => {
    it("lists the ids of its regions", () => {
      const store = storeWith([0, 0, baseRegion], [-1, 2, altRegion]);

      expect([...store.ids]).toEqual([origin, other]);
    });

    it("lists the positions of its regions as numbers", () => {
      const store = storeWith([0, 0, baseRegion], [-1, 2, altRegion]);

      expect([...store.positions]).toEqual([
        [0, 0],
        [-1, 2],
      ]);
    });
  });

  describe("optTileAt / tileAt", () => {
    const marked = region((x, y) =>
      x === 3 && y === 5 ? markerTile : baseTile
    );

    it("indexes the tile within its region", () => {
      const store = storeWith([0, 0, marked]);

      expect(store.tileAt(3, 5)).toBe(markerTile);
      expect(store.tileAt(5, 3)).toBe(baseTile);
    });

    it("finds the region that contains the position", () => {
      const store = storeWith([1, 2, marked]);

      expect(
        store.tileAt(REGION_SIDE_LENGTH + 3, 2 * REGION_SIDE_LENGTH + 5)
      ).toBe(markerTile);
      expect(store.optTileAt(3, 5)).toBeUndefined();
    });

    it("handles negative positions", () => {
      const store = storeWith([-1, -1, marked]);

      expect(store.tileAt(3 - REGION_SIDE_LENGTH, 5 - REGION_SIDE_LENGTH)).toBe(
        markerTile
      );
      expect(store.optTileAt(-1, -1)).toBe(baseTile);
    });

    it("returns undefined from optTileAt when there is no region", () => {
      expect(new TerrainStore().optTileAt(0, 0)).toBeUndefined();
    });

    it("throws from tileAt when there is no region", () => {
      expect(() => new TerrainStore().tileAt(-2, 7)).toThrow(
        "No region exists for position -2, 7"
      );
    });
  });

  describe("addTile", () => {
    it("sets the tile at a world position", () => {
      const store = storeWith([0, 0, region()]);
      store.addTile(3, 5, tileToId(markerTile));

      expect(store.tileAt(3, 5)).toBe(markerTile);
      expect(store.tileAt(5, 3)).toBe(baseTile);
    });

    it("finds the region containing a negative position", () => {
      const store = storeWith([-1, -1, region()]);
      store.addTile(-1, -1, tileToId(markerTile));

      expect(store.tileAt(-1, -1)).toBe(markerTile);
      expect(store.tileAt(-2, -1)).toBe(baseTile);
    });

    it("throws when there is no region for the position", () => {
      expect(() => {
        new TerrainStore().addTile(-2, 7, tileToId(markerTile));
      }).toThrow("No region exists for world pos -2,7");
    });
  });

  describe("dirty regions", () => {
    const cleanStoreWith = (
      ...entries: [x: number, y: number, region: RegionTiles][]
    ) => {
      const store = storeWith(...entries);
      store.flushDirtyRegions();
      return store;
    };

    it("marks a region dirty when it is added", () => {
      const store = new TerrainStore();
      store.add(origin, baseRegion);

      expect(store.flushDirtyRegions()).toEqual([origin]);
    });

    it("marks a region dirty when it replaces an existing one", () => {
      const store = cleanStoreWith([0, 0, baseRegion]);
      store.add(origin, altRegion);

      expect(store.flushDirtyRegions()).toEqual([origin]);
    });

    it("leaves a region clean when it is added as not dirty", () => {
      const store = new TerrainStore();
      store.add(origin, baseRegion, false);

      expect(store.flushDirtyRegions()).toEqual([]);
      expect(store.get(origin)).toBe(baseRegion);
    });

    it("keeps a region dirty that is added as not dirty over a dirty one", () => {
      const store = new TerrainStore();
      store.add(origin, baseRegion);
      store.add(origin, altRegion, false);

      expect(store.flushDirtyRegions()).toEqual([origin]);
    });

    it("marks only the region a tile is in", () => {
      const store = cleanStoreWith([0, 0, region()], [-1, -1, region()]);
      store.addTile(-1, -1, tileToId(markerTile));

      expect(store.flushDirtyRegions()).toEqual([regionPosToId(-1, -1)]);
    });

    it("leaves a region clean when the tile is already that tile", () => {
      const store = cleanStoreWith([0, 0, region()]);
      store.addTile(3, 5, tileToId(baseTile));

      expect(store.flushDirtyRegions()).toEqual([]);
    });

    it("marks a region dirty when a tile is changed back", () => {
      const store = cleanStoreWith([0, 0, region()]);
      store.addTile(3, 5, tileToId(markerTile));
      store.flushDirtyRegions();
      store.addTile(3, 5, tileToId(baseTile));

      expect(store.flushDirtyRegions()).toEqual([origin]);
    });

    it("marks nothing when a tile has no region to go in", () => {
      const store = cleanStoreWith([0, 0, region()]);

      expect(() => {
        store.addTile(-2, 7, tileToId(markerTile));
      }).toThrow();
      expect(store.flushDirtyRegions()).toEqual([]);
    });

    it("marks a region dirty when it is deleted", () => {
      const store = cleanStoreWith([0, 0, region()]);
      store.delete(origin);

      expect(store.flushDirtyRegions()).toEqual([origin]);
    });

    it("marks nothing dirty when deleting a region that does not exist", () => {
      const store = cleanStoreWith([0, 0, region()]);

      expect(store.delete(other)).toBe(false);
      expect(store.flushDirtyRegions()).toEqual([]);
    });

    it("does not mark anything dirty when reading", () => {
      const store = cleanStoreWith([0, 0, region()]);

      store.optGet(origin);
      store.get(origin);
      store.optTileAt(1, 1);
      store.tileAt(1, 1);
      store.optTileAt(-1, -1);
      store.ids.toArray();
      store.positions.toArray();

      expect(store.flushDirtyRegions()).toEqual([]);
    });
  });
});
