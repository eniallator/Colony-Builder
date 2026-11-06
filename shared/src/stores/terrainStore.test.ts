import { describe, expect, it } from "vitest";

import { LOADED_SIDE_LENGTH, REGION_SIDE_LENGTH } from "../constants.ts";
import type { RegionTiles, TerrainSnapshot } from "../protocol/index.ts";
import {
  regionPosToId,
  tiles,
  type TerrainGenerator,
  type Tile,
} from "../terrain/index.ts";
import { TerrainStore } from "./terrainStore.ts";

const [baseTile, altTile, markerTile] = tiles;

const region = (
  tileAt: (x: number, y: number) => Tile = () => baseTile
): RegionTiles =>
  Array.from({ length: REGION_SIDE_LENGTH ** 2 }, (_, i) =>
    tileAt(i % REGION_SIDE_LENGTH, Math.floor(i / REGION_SIDE_LENGTH))
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
      store.addTile(3, 5, markerTile);

      expect(store.tileAt(3, 5)).toBe(markerTile);
      expect(store.tileAt(5, 3)).toBe(baseTile);
    });

    it("finds the region containing a negative position", () => {
      const store = storeWith([-1, -1, region()]);
      store.addTile(-1, -1, markerTile);

      expect(store.tileAt(-1, -1)).toBe(markerTile);
      expect(store.tileAt(-2, -1)).toBe(baseTile);
    });

    it("throws when there is no region for the position", () => {
      expect(() => {
        new TerrainStore().addTile(-2, 7, markerTile);
      }).toThrow("No region exists for world pos -2,7");
    });
  });

  describe("unloadOutside", () => {
    it("removes regions outside the square and returns their ids", () => {
      const store = storeWith(
        [0, 0, baseRegion],
        [-3, 0, baseRegion],
        [2, 0, baseRegion],
        [0, -3, baseRegion],
        [0, 2, baseRegion]
      );

      expect(store.unloadOutside(0, 0, 4)).toEqual([
        regionPosToId(-3, 0),
        regionPosToId(2, 0),
        regionPosToId(0, -3),
        regionPosToId(0, 2),
      ]);
      expect([...store.ids]).toEqual([origin]);
    });

    it("keeps the square's inclusive lower edge and exclusive upper edge", () => {
      const store = storeWith([-2, -2, baseRegion], [1, 1, baseRegion]);

      expect(store.unloadOutside(0, 0, 4)).toEqual([]);
      expect([...store.ids]).toEqual([
        regionPosToId(-2, -2),
        regionPosToId(1, 1),
      ]);
    });

    it("is centred on the given region position", () => {
      const store = storeWith([10, 10, baseRegion], [0, 0, baseRegion]);

      expect(store.unloadOutside(10, 10, 4)).toEqual([origin]);
      expect([...store.ids]).toEqual([regionPosToId(10, 10)]);
    });

    it("returns nothing for an empty store", () => {
      expect(new TerrainStore().unloadOutside(0, 0, 4)).toEqual([]);
    });
  });

  describe("takeSnapshot", () => {
    it("captures the requested regions by id", () => {
      const store = storeWith([0, 0, baseRegion], [-1, 2, altRegion]);

      expect(store.takeSnapshot([origin, other])).toEqual(
        new Map([
          [origin, baseRegion],
          [other, altRegion],
        ])
      );
    });

    it("only includes the requested regions", () => {
      const store = storeWith([0, 0, baseRegion], [-1, 2, altRegion]);

      expect([...store.takeSnapshot([other]).keys()]).toEqual([other]);
    });

    it("is empty when no ids are requested", () => {
      expect(storeWith([0, 0, baseRegion]).takeSnapshot([])).toEqual(new Map());
    });

    it("shares the region objects rather than copying them", () => {
      const store = storeWith([0, 0, baseRegion]);

      expect(store.takeSnapshot([origin]).get(origin)).toBe(baseRegion);
    });

    it("is a copy of the map, so later changes do not leak into it", () => {
      const store = storeWith([0, 0, baseRegion]);

      const snapshot = store.takeSnapshot([origin]);
      store.add(other, altRegion);
      store.delete(origin);

      expect([...snapshot.keys()]).toEqual([origin]);
    });

    it("throws for a region that is not loaded", () => {
      expect(() => new TerrainStore().takeSnapshot([origin])).toThrow(
        "Region 0,0 not loaded yet!"
      );
    });
  });

  describe("applySnapshot", () => {
    const snapshotOf = (
      ...entries: [x: number, y: number, region: RegionTiles][]
    ): TerrainSnapshot =>
      new Map(entries.map(([x, y, r]) => [regionPosToId(x, y), r]));

    it("creates the described regions", () => {
      const store = new TerrainStore();

      store.applySnapshot(snapshotOf([0, 0, baseRegion], [-1, 2, altRegion]));

      expect(store.get(origin)).toBe(baseRegion);
      expect(store.get(other)).toBe(altRegion);
    });

    it("updates existing regions", () => {
      const store = storeWith([0, 0, baseRegion]);

      store.applySnapshot(snapshotOf([0, 0, altRegion]));

      expect(store.get(origin)).toBe(altRegion);
    });

    it("keeps regions missing from the snapshot", () => {
      const store = storeWith([0, 0, baseRegion], [1, 1, altRegion]);

      store.applySnapshot(snapshotOf([0, 0, altRegion]));

      expect([...store.ids]).toEqual([origin, regionPosToId(1, 1)]);
      expect(store.get(regionPosToId(1, 1))).toBe(altRegion);
    });

    it("leaves the store unchanged for an empty snapshot", () => {
      const store = storeWith([0, 0, baseRegion]);

      store.applySnapshot(new Map());

      expect([...store.ids]).toEqual([origin]);
    });
  });

  describe("loadTerrain", () => {
    const half = LOADED_SIDE_LENGTH / 2;
    const allBase: TerrainGenerator = () => baseTile;

    it("returns the ids of the square of regions around the position", () => {
      const ids = new TerrainStore().loadTerrain(0, 0, allBase);

      expect(ids.size).toBe(LOADED_SIDE_LENGTH ** 2);
      expect(ids.has(regionPosToId(-half, -half))).toBe(true);
      expect(ids.has(regionPosToId(half - 1, half - 1))).toBe(true);
      expect(ids.has(regionPosToId(half, 0))).toBe(false);
      expect(ids.has(regionPosToId(0, -half - 1))).toBe(false);
    });

    it("centres the square on the region containing the position", () => {
      const ids = new TerrainStore().loadTerrain(
        2.5 * REGION_SIDE_LENGTH,
        -0.5 * REGION_SIDE_LENGTH,
        allBase
      );

      expect(ids.has(regionPosToId(2 - half, -1 - half))).toBe(true);
      expect(ids.has(regionPosToId(2 + half - 1, -1 + half - 1))).toBe(true);
      expect(ids.has(regionPosToId(2 + half, -1))).toBe(false);
    });

    it("generates every region it returns", () => {
      const store = new TerrainStore();

      const ids = store.loadTerrain(0, 0, allBase);

      expect(new Set(store.ids)).toEqual(ids);
      for (const id of ids) {
        const generated = store.get(id);
        expect(generated).toHaveLength(REGION_SIDE_LENGTH ** 2);
        expect(generated.every(tile => tiles.includes(tile))).toBe(true);
      }
    });

    it("does not regenerate regions that already exist", () => {
      const store = storeWith([0, 0, altRegion]);

      store.loadTerrain(0, 0, allBase);

      expect(store.get(origin)).toBe(altRegion);
    });

    it("returns the same ids when called again", () => {
      const store = new TerrainStore();

      expect(store.loadTerrain(0, 0, allBase)).toEqual(
        store.loadTerrain(0, 0, allBase)
      );
    });

    it("asks the generator for world coordinates", () => {
      const store = new TerrainStore();
      const marked: TerrainGenerator = (x, y) =>
        x === REGION_SIDE_LENGTH + 3 && y === -REGION_SIDE_LENGTH + 5
          ? markerTile
          : baseTile;

      store.loadTerrain(0, 0, marked);

      expect(store.tileAt(REGION_SIDE_LENGTH + 3, 5 - REGION_SIDE_LENGTH)).toBe(
        markerTile
      );
      expect(store.tileAt(REGION_SIDE_LENGTH + 4, 5 - REGION_SIDE_LENGTH)).toBe(
        baseTile
      );
    });

    it("only calls the generator for regions that do not exist yet", () => {
      const store = storeWith([0, 0, altRegion]);
      const calls: [number, number][] = [];

      store.loadTerrain(0, 0, (x, y) => {
        calls.push([x, y]);
        return baseTile;
      });

      expect(calls).toHaveLength(
        (LOADED_SIDE_LENGTH ** 2 - 1) * REGION_SIDE_LENGTH ** 2
      );
    });

    it("only adds the new regions when the position moves", () => {
      const store = new TerrainStore();
      store.loadTerrain(0, 0, allBase);

      store.loadTerrain(REGION_SIDE_LENGTH, 0, allBase);

      expect(store.ids.toArray()).toHaveLength(
        LOADED_SIDE_LENGTH * (LOADED_SIDE_LENGTH + 1)
      );
    });
  });
});
