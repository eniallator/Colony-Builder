import { describe, expect, it } from "vitest";

import { REGION_SIDE_LENGTH } from "../constants.ts";
import type { RegionTiles, TerrainSnapshot } from "../protocol/index.ts";
import { unsafeRegionId, type RegionId, type Tile } from "../terrain/index.ts";
import { TerrainStore } from "./terrainStore.ts";

const region = (
  tileAt: (x: number, y: number) => Tile = () => "grass"
): RegionTiles => ({
  tiles: Array.from({ length: REGION_SIDE_LENGTH }, (_, x) =>
    Array.from({ length: REGION_SIDE_LENGTH }, (_, y) => tileAt(x, y))
  ) as unknown as RegionTiles["tiles"],
});

const grass = region();
const water = region(() => "water");

describe("TerrainStore", () => {
  describe("add / optGet / get", () => {
    it("stores and returns regions by position", () => {
      const store = new TerrainStore();
      store.add(0, 0, grass);
      store.add(-1, 2, water);

      expect(store.get(0, 0)).toBe(grass);
      expect(store.optGet(-1, 2)).toBe(water);
    });

    it("overwrites the region at a position", () => {
      const store = new TerrainStore();
      store.add(1, 1, grass);
      store.add(1, 1, water);

      expect(store.get(1, 1)).toBe(water);
    });

    it("returns undefined from optGet when there is no region", () => {
      expect(new TerrainStore().optGet(0, 0)).toBeUndefined();
    });

    it("throws from get when there is no region", () => {
      expect(() => new TerrainStore().get(3, -4)).toThrow(
        "No region exists at 3, -4"
      );
    });
  });

  describe("delete", () => {
    it("removes a region and reports whether it existed", () => {
      const store = new TerrainStore();
      store.add(0, 0, grass);

      expect(store.delete(0, 0)).toBe(true);
      expect(store.delete(0, 0)).toBe(false);
      expect(store.optGet(0, 0)).toBeUndefined();
    });
  });

  describe("ids / positions", () => {
    it("lists the ids of its regions", () => {
      const store = new TerrainStore();
      store.add(0, 0, grass);
      store.add(-1, 2, water);

      expect([...store.ids]).toEqual(["0,0", "-1,2"]);
    });

    it("lists the positions of its regions as numbers", () => {
      const store = new TerrainStore();
      store.add(0, 0, grass);
      store.add(-1, 2, water);

      expect([...store.positions]).toEqual([
        [0, 0],
        [-1, 2],
      ]);
    });
  });

  describe("optTileAt / tileAt", () => {
    const marked = region((x, y) => (x === 3 && y === 5 ? "stone" : "grass"));

    it("indexes the tile within its region", () => {
      const store = new TerrainStore();
      store.add(0, 0, marked);

      expect(store.tileAt(3, 5)).toBe("stone");
      expect(store.tileAt(5, 3)).toBe("grass");
    });

    it("finds the region that contains the position", () => {
      const store = new TerrainStore();
      store.add(1, 2, marked);

      expect(
        store.tileAt(REGION_SIDE_LENGTH + 3, 2 * REGION_SIDE_LENGTH + 5)
      ).toBe("stone");
      expect(store.optTileAt(3, 5)).toBeUndefined();
    });

    it("handles negative positions", () => {
      const store = new TerrainStore();
      store.add(-1, -1, marked);

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

  describe("takeSnapshot", () => {
    it("is empty for an empty store", () => {
      expect(new TerrainStore().takeSnapshot()).toEqual(new Map());
    });

    it("captures every region by id", () => {
      const store = new TerrainStore();
      store.add(0, 0, grass);
      store.add(-1, 2, water);

      expect(store.takeSnapshot()).toEqual(
        new Map([
          [unsafeRegionId("0,0"), grass],
          [unsafeRegionId("-1,2"), water],
        ])
      );
    });

    it("is a copy, so later changes do not leak into it", () => {
      const store = new TerrainStore();
      store.add(0, 0, grass);

      const snapshot = store.takeSnapshot();
      store.add(1, 1, water);
      store.delete(0, 0);

      expect([...snapshot.keys()]).toEqual(["0,0"]);
    });
  });

  describe("applySnapshot", () => {
    const origin = unsafeRegionId("0,0");
    const snapshotOf = (
      ...regions: [RegionId, RegionTiles][]
    ): TerrainSnapshot => new Map(regions);

    it("creates the described regions", () => {
      const store = new TerrainStore();

      store.applySnapshot(
        snapshotOf([origin, grass], [unsafeRegionId("-1,2"), water])
      );

      expect(store.get(0, 0)).toBe(grass);
      expect(store.get(-1, 2)).toBe(water);
    });

    it("updates existing regions", () => {
      const store = new TerrainStore();
      store.add(0, 0, grass);

      store.applySnapshot(snapshotOf([origin, water]));

      expect(store.get(0, 0)).toBe(water);
    });

    it("removes regions missing from the snapshot", () => {
      const store = new TerrainStore();
      store.add(0, 0, grass);
      store.add(1, 1, water);

      store.applySnapshot(snapshotOf([origin, grass]));

      expect([...store.ids]).toEqual(["0,0"]);
      expect(store.optGet(1, 1)).toBeUndefined();
    });

    it("removes everything for an empty snapshot", () => {
      const store = new TerrainStore();
      store.add(0, 0, grass);

      store.applySnapshot(new Map());

      expect([...store.ids]).toEqual([]);
    });
  });
});
