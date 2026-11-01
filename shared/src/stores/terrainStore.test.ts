import { describe, expect, it } from "vitest";

import { LOADED_SIDE_LENGTH, REGION_SIDE_LENGTH } from "../constants.ts";
import type { RegionTiles, TerrainSnapshot } from "../protocol/index.ts";
import {
  regionPosToId,
  tiles,
  unsafeRegionId,
  type Tile,
} from "../terrain/index.ts";
import { TerrainStore } from "./terrainStore.ts";

const region = (
  tileAt: (x: number, y: number) => Tile = () => "grass"
): RegionTiles => ({
  tiles: Array.from({ length: REGION_SIDE_LENGTH ** 2 }, (_, i) =>
    tileAt(i % REGION_SIDE_LENGTH, Math.floor(i / REGION_SIDE_LENGTH))
  ),
});

const grass = region();
const water = region(() => "water");

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
      store.add(origin, grass);
      store.add(other, water);

      expect(store.get(origin)).toBe(grass);
      expect(store.optGet(other)).toBe(water);
    });

    it("overwrites the region at an id", () => {
      const store = new TerrainStore();
      store.add(origin, grass);
      store.add(origin, water);

      expect(store.get(origin)).toBe(water);
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
      const store = storeWith([0, 0, grass]);

      expect(store.delete(origin)).toBe(true);
      expect(store.delete(origin)).toBe(false);
      expect(store.optGet(origin)).toBeUndefined();
    });
  });

  describe("ids / positions", () => {
    it("lists the ids of its regions", () => {
      const store = storeWith([0, 0, grass], [-1, 2, water]);

      expect([...store.ids]).toEqual(["0,0", "-1,2"]);
    });

    it("lists the positions of its regions as numbers", () => {
      const store = storeWith([0, 0, grass], [-1, 2, water]);

      expect([...store.positions]).toEqual([
        [0, 0],
        [-1, 2],
      ]);
    });
  });

  describe("optTileAt / tileAt", () => {
    const marked = region((x, y) => (x === 3 && y === 5 ? "stone" : "grass"));

    it("indexes the tile within its region", () => {
      const store = storeWith([0, 0, marked]);

      expect(store.tileAt(3, 5)).toBe("stone");
      expect(store.tileAt(5, 3)).toBe("grass");
    });

    it("finds the region that contains the position", () => {
      const store = storeWith([1, 2, marked]);

      expect(
        store.tileAt(REGION_SIDE_LENGTH + 3, 2 * REGION_SIDE_LENGTH + 5)
      ).toBe("stone");
      expect(store.optTileAt(3, 5)).toBeUndefined();
    });

    it("handles negative positions", () => {
      const store = storeWith([-1, -1, marked]);

      expect(store.tileAt(3 - REGION_SIDE_LENGTH, 5 - REGION_SIDE_LENGTH)).toBe(
        "stone"
      );
      expect(store.optTileAt(-1, -1)).toBe("grass");
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

  describe("unloadOutside", () => {
    it("removes regions outside the square and returns their ids", () => {
      const store = storeWith(
        [0, 0, grass],
        [-3, 0, grass],
        [2, 0, grass],
        [0, -3, grass],
        [0, 2, grass]
      );

      expect(store.unloadOutside(0, 0, 4)).toEqual([
        unsafeRegionId("-3,0"),
        unsafeRegionId("2,0"),
        unsafeRegionId("0,-3"),
        unsafeRegionId("0,2"),
      ]);
      expect([...store.ids]).toEqual(["0,0"]);
    });

    it("keeps the square's inclusive lower edge and exclusive upper edge", () => {
      const store = storeWith([-2, -2, grass], [1, 1, grass]);

      expect(store.unloadOutside(0, 0, 4)).toEqual([]);
      expect([...store.ids]).toEqual(["-2,-2", "1,1"]);
    });

    it("is centred on the given region position", () => {
      const store = storeWith([10, 10, grass], [0, 0, grass]);

      expect(store.unloadOutside(10, 10, 4)).toEqual([unsafeRegionId("0,0")]);
      expect([...store.ids]).toEqual(["10,10"]);
    });

    it("returns nothing for an empty store", () => {
      expect(new TerrainStore().unloadOutside(0, 0, 4)).toEqual([]);
    });
  });

  describe("takeSnapshot", () => {
    it("captures the requested regions by id", () => {
      const store = storeWith([0, 0, grass], [-1, 2, water]);

      expect(store.takeSnapshot([origin, other])).toEqual(
        new Map([
          [origin, grass],
          [other, water],
        ])
      );
    });

    it("only includes the requested regions", () => {
      const store = storeWith([0, 0, grass], [-1, 2, water]);

      expect([...store.takeSnapshot([other]).keys()]).toEqual(["-1,2"]);
    });

    it("is empty when no ids are requested", () => {
      expect(storeWith([0, 0, grass]).takeSnapshot([])).toEqual(new Map());
    });

    it("shares the region objects rather than copying them", () => {
      const store = storeWith([0, 0, grass]);

      expect(store.takeSnapshot([origin]).get(origin)).toBe(grass);
    });

    it("is a copy of the map, so later changes do not leak into it", () => {
      const store = storeWith([0, 0, grass]);

      const snapshot = store.takeSnapshot([origin]);
      store.add(other, water);
      store.delete(origin);

      expect([...snapshot.keys()]).toEqual(["0,0"]);
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

      store.applySnapshot(snapshotOf([0, 0, grass], [-1, 2, water]));

      expect(store.get(origin)).toBe(grass);
      expect(store.get(other)).toBe(water);
    });

    it("updates existing regions", () => {
      const store = storeWith([0, 0, grass]);

      store.applySnapshot(snapshotOf([0, 0, water]));

      expect(store.get(origin)).toBe(water);
    });

    it("keeps regions missing from the snapshot", () => {
      const store = storeWith([0, 0, grass], [1, 1, water]);

      store.applySnapshot(snapshotOf([0, 0, water]));

      expect([...store.ids]).toEqual(["0,0", "1,1"]);
      expect(store.get(regionPosToId(1, 1))).toBe(water);
    });

    it("leaves the store unchanged for an empty snapshot", () => {
      const store = storeWith([0, 0, grass]);

      store.applySnapshot(new Map());

      expect([...store.ids]).toEqual(["0,0"]);
    });
  });

  describe("loadTerrain", () => {
    const half = LOADED_SIDE_LENGTH / 2;

    it("returns the ids of the square of regions around the position", () => {
      const ids = new TerrainStore().loadTerrain(0, 0);

      expect(ids.size).toBe(LOADED_SIDE_LENGTH ** 2);
      expect(ids.has(regionPosToId(-half, -half))).toBe(true);
      expect(ids.has(regionPosToId(half - 1, half - 1))).toBe(true);
      expect(ids.has(regionPosToId(half, 0))).toBe(false);
      expect(ids.has(regionPosToId(0, -half - 1))).toBe(false);
    });

    it("centres the square on the region containing the position", () => {
      const ids = new TerrainStore().loadTerrain(
        2.5 * REGION_SIDE_LENGTH,
        -0.5 * REGION_SIDE_LENGTH
      );

      expect(ids.has(regionPosToId(2 - half, -1 - half))).toBe(true);
      expect(ids.has(regionPosToId(2 + half - 1, -1 + half - 1))).toBe(true);
      expect(ids.has(regionPosToId(2 + half, -1))).toBe(false);
    });

    it("generates every region it returns", () => {
      const store = new TerrainStore();

      const ids = store.loadTerrain(0, 0);

      expect(new Set(store.ids)).toEqual(ids);
      for (const id of ids) {
        const generated = store.get(id).tiles;
        expect(generated).toHaveLength(REGION_SIDE_LENGTH ** 2);
        expect(generated.every(tile => tiles.includes(tile))).toBe(true);
      }
    });

    it("does not regenerate regions that already exist", () => {
      const store = storeWith([0, 0, water]);

      store.loadTerrain(0, 0);

      expect(store.get(origin)).toBe(water);
    });

    it("returns the same ids when called again", () => {
      const store = new TerrainStore();

      expect(store.loadTerrain(0, 0)).toEqual(store.loadTerrain(0, 0));
    });

    it("only adds the new regions when the position moves", () => {
      const store = new TerrainStore();
      store.loadTerrain(0, 0);

      store.loadTerrain(REGION_SIDE_LENGTH, 0);

      expect(store.ids.toArray()).toHaveLength(
        LOADED_SIDE_LENGTH * (LOADED_SIDE_LENGTH + 1)
      );
    });
  });
});
