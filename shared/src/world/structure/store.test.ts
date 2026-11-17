import { describe, expect, it } from "vitest";

import { REGION_SIDE_LENGTH } from "../../constants.ts";
import { regionPosToId } from "../terrain/index.ts";
import { StructureStore } from "./store.ts";
import {
  subRegionPosToId,
  worldPosToRegionIds,
  type RegionStructures,
  type StructureData,
} from "./types.ts";

const tree: StructureData = { id: "tree", data: true };
const cactus: StructureData = { id: "cactus", data: true };

const origin = regionPosToId(0, 0);
const other = regionPosToId(-1, 2);

const regionWith = (
  ...entries: [x: number, y: number, data: StructureData][]
): RegionStructures =>
  new Map(entries.map(([x, y, data]) => [subRegionPosToId(x, y), data]));

describe("StructureStore", () => {
  describe("add / optGet / get", () => {
    it("stores and returns the structures of a region by id", () => {
      const store = new StructureStore();
      const first = regionWith([1, 2, tree]);
      const second = regionWith([3, 4, cactus]);
      store.add(origin, first);
      store.add(other, second);

      expect(store.get(origin)).toBe(first);
      expect(store.optGet(other)).toBe(second);
    });

    it("overwrites the structures at an id", () => {
      const store = new StructureStore();
      const replacement = regionWith([5, 6, cactus]);
      store.add(origin, regionWith([1, 2, tree]));
      store.add(origin, replacement);

      expect(store.get(origin)).toBe(replacement);
    });

    it("returns undefined from optGet when there is no region", () => {
      expect(new StructureStore().optGet(origin)).toBeUndefined();
    });

    it("throws from get when there is no region", () => {
      expect(() => new StructureStore().get(regionPosToId(3, -4))).toThrow(
        "No region exists at 3,-4"
      );
    });
  });

  describe("ids", () => {
    it("lists the ids of its regions", () => {
      const store = new StructureStore();
      store.add(origin, new Map());
      store.add(other, new Map());

      expect([...store.ids]).toEqual([origin, other]);
    });
  });

  describe("addStructure", () => {
    it("puts a structure at a world position", () => {
      const store = new StructureStore();
      store.addStructure(1.5, 3, tree);

      const [region, sub] = worldPosToRegionIds(1.5, 3);
      expect(store.optGetStructure(region, sub)).toEqual({
        ...tree,
        worldPos: [1.5, 3],
      });
    });

    it("adds to a region that already has structures", () => {
      const store = new StructureStore();
      store.add(origin, regionWith([0, 0, tree]));
      store.addStructure(2, 2, cactus);

      expect(store.get(origin).size).toBe(2);
    });

    it("finds the region containing a negative position", () => {
      const store = new StructureStore();
      store.addStructure(-0.5, -REGION_SIDE_LENGTH - 0.5, cactus);

      expect(store.optGet(regionPosToId(-1, -2))?.size).toBe(1);
    });
  });

  describe("optGetStructure", () => {
    it("returns the structure with its world position", () => {
      const store = new StructureStore();
      store.addStructure(REGION_SIDE_LENGTH + 2.5, 4, tree);

      const [region, sub] = worldPosToRegionIds(REGION_SIDE_LENGTH + 2.5, 4);
      expect(store.optGetStructure(region, sub)).toEqual({
        ...tree,
        worldPos: [REGION_SIDE_LENGTH + 2.5, 4],
      });
    });

    it("returns undefined when there is no structure there", () => {
      const store = new StructureStore();
      store.add(origin, regionWith([1, 1, tree]));

      expect(
        store.optGetStructure(origin, subRegionPosToId(2, 2))
      ).toBeUndefined();
      expect(
        store.optGetStructure(other, subRegionPosToId(1, 1))
      ).toBeUndefined();
    });
  });

  describe("structuresAround", () => {
    const store = new StructureStore();
    store.addStructure(5.5, 5.5, tree);
    store.addStructure(-3.5, -3.5, cactus);
    store.addStructure(3 * REGION_SIDE_LENGTH + 1, 0, tree);

    it("returns the structures of the regions around the position", () => {
      // Two regions across, so regions -1 and 0 in each direction.
      const found = store.structuresAround(0, 0, 2 * REGION_SIDE_LENGTH);

      expect(found).toHaveLength(2);
      expect(found).toContainEqual({ ...tree, worldPos: [5.5, 5.5] });
      expect(found).toContainEqual({ ...cactus, worldPos: [-3.5, -3.5] });
    });

    it("leaves out structures in regions that are too far", () => {
      const found = store.structuresAround(0, 0, 2 * REGION_SIDE_LENGTH);

      expect(found.map(({ worldPos }) => worldPos[0])).not.toContain(
        3 * REGION_SIDE_LENGTH + 1
      );
    });

    it("rounds the side length up to whole regions", () => {
      expect(store.structuresAround(0, 0, REGION_SIDE_LENGTH + 1)).toHaveLength(
        2
      );
    });

    it("is empty when no region around has structures", () => {
      expect(
        store.structuresAround(
          100 * REGION_SIDE_LENGTH,
          0,
          2 * REGION_SIDE_LENGTH
        )
      ).toEqual([]);
    });
  });

  describe("delete / deleteStructure", () => {
    it("removes a region and reports whether it existed", () => {
      const store = new StructureStore();
      store.add(origin, regionWith([1, 2, tree]));

      expect(store.delete(origin)).toBe(true);
      expect(store.delete(origin)).toBe(false);
      expect(store.optGet(origin)).toBeUndefined();
    });

    it("removes one structure and reports whether it existed", () => {
      const store = new StructureStore();
      store.add(origin, regionWith([1, 2, tree], [3, 4, cactus]));

      expect(store.deleteStructure(origin, subRegionPosToId(1, 2))).toBe(true);
      expect(store.deleteStructure(origin, subRegionPosToId(1, 2))).toBe(false);
      expect(store.get(origin).size).toBe(1);
    });

    it("reports false for a region that does not exist", () => {
      expect(
        new StructureStore().deleteStructure(origin, subRegionPosToId(1, 2))
      ).toBe(false);
    });
  });
});
