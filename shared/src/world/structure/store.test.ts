import { describe, expect, it } from "vitest";

import { REGION_SIDE_LENGTH } from "../../constants.ts";
import { facingDirOf, FACINGS } from "../../facing.ts";
import {
  regionPosToId,
  subRegionPosToId,
  worldPosToRegionIds,
} from "../region.ts";
import { StructureStore } from "./store.ts";
import type { RegionStructures, StructureData } from "./types.ts";

const structure: StructureData = { type: "tree", data: true };
const otherStructure: StructureData = { type: "cactus", data: true };

const [facing] = FACINGS;
const belt = (tiles: number): StructureData => ({
  type: "conveyor",
  data: { facing, length: tiles * REGION_SIDE_LENGTH },
});

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
      const first = regionWith([1, 2, structure]);
      const second = regionWith([3, 4, otherStructure]);
      store.add(origin, first);
      store.add(other, second);

      expect(store.get(origin)).toBe(first);
      expect(store.optGet(other)).toBe(second);
    });

    it("overwrites the structures at an id", () => {
      const store = new StructureStore();
      const replacement = regionWith([5, 6, otherStructure]);
      store.add(origin, regionWith([1, 2, structure]));
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
    it("puts a structure at a region and sub-region id", () => {
      const store = new StructureStore();
      const sub = subRegionPosToId(1, 2);
      store.addStructure(other, sub, structure);

      expect(store.get(other).get(sub)).toBe(structure);
    });

    it("adds to a region that already has structures", () => {
      const store = new StructureStore();
      store.add(origin, regionWith([0, 0, structure]));
      store.addStructure(origin, subRegionPosToId(1, 1), otherStructure);

      expect(store.get(origin).size).toBe(2);
    });
  });

  describe("addStructureAt", () => {
    it("puts a structure at a world position", () => {
      const store = new StructureStore();
      store.addStructureAt(1.5, 3, structure);

      const [region, sub] = worldPosToRegionIds(1.5, 3);
      expect(store.optGetStructure(region, sub)).toEqual({
        ...structure,
        worldPos: [1.5, 3],
      });
    });

    it("adds to a region that already has structures", () => {
      const store = new StructureStore();
      store.add(origin, regionWith([0, 0, structure]));
      store.addStructureAt(2, 2, otherStructure);

      expect(store.get(origin).size).toBe(2);
    });

    it("finds the region containing a negative position", () => {
      const store = new StructureStore();
      store.addStructureAt(-0.5, -REGION_SIDE_LENGTH - 0.5, structure);

      expect(store.optGet(regionPosToId(-1, -2))?.size).toBe(1);
    });
  });

  describe("optGetStructure", () => {
    it("returns the structure with its world position", () => {
      const store = new StructureStore();
      const [x, y] = [REGION_SIDE_LENGTH + 2.5, 4];
      store.addStructureAt(x, y, structure);

      const [region, sub] = worldPosToRegionIds(x, y);
      expect(store.optGetStructure(region, sub)).toEqual({
        ...structure,
        worldPos: [x, y],
      });
    });

    it("returns undefined when there is no structure there", () => {
      const store = new StructureStore();
      store.add(origin, regionWith([1, 1, structure]));

      expect(
        store.optGetStructure(origin, subRegionPosToId(2, 2))
      ).toBeUndefined();
      expect(
        store.optGetStructure(other, subRegionPosToId(1, 1))
      ).toBeUndefined();
    });
  });

  describe("structuresAround", () => {
    const near = [REGION_SIDE_LENGTH / 4, REGION_SIDE_LENGTH / 4] as const;
    const behind = [-REGION_SIDE_LENGTH / 4, -REGION_SIDE_LENGTH / 4] as const;
    const far = [3 * REGION_SIDE_LENGTH + 1, 0] as const;

    const store = new StructureStore();
    store.addStructureAt(...near, structure);
    store.addStructureAt(...behind, otherStructure);
    store.addStructureAt(...far, structure);

    it("returns the structures of the regions around the position", () => {
      // Two regions across, so regions -1 and 0 in each direction.
      const found = store.structuresAround(0, 0, 2 * REGION_SIDE_LENGTH);

      const [nearRegion, nearSub] = worldPosToRegionIds(...near);
      const [behindRegion, behindSub] = worldPosToRegionIds(...behind);
      expect(found).toHaveLength(2);
      expect(found).toContainEqual({
        ...structure,
        worldPos: near,
        regionId: nearRegion,
        id: nearSub,
      });
      expect(found).toContainEqual({
        ...otherStructure,
        worldPos: behind,
        regionId: behindRegion,
        id: behindSub,
      });
    });

    it("leaves out structures in regions that are too far", () => {
      const found = store.structuresAround(0, 0, 2 * REGION_SIDE_LENGTH);

      expect(found.map(({ worldPos }) => worldPos[0])).not.toContain(far[0]);
    });

    it("reaches as far in every direction when the window is centred on a region", () => {
      const reach = 2;
      const centred = new StructureStore();
      const offsets = [-reach, reach].flatMap(dx =>
        [-reach, reach].map(dy => [dx, dy] as const)
      );
      for (const [dx, dy] of offsets) {
        centred.addStructureAt(
          (dx + 0.5) * REGION_SIDE_LENGTH,
          (dy + 0.5) * REGION_SIDE_LENGTH,
          structure
        );
      }

      expect(
        centred.structuresAround(
          REGION_SIDE_LENGTH / 2,
          REGION_SIDE_LENGTH / 2,
          (2 * reach + 1) * REGION_SIDE_LENGTH
        )
      ).toHaveLength(offsets.length);
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

  describe("structureAt", () => {
    // A belt of `length` tiles whose first tile is centred on (1.5, 1.5).
    const length = 3;
    const [dx, dy] = facingDirOf[facing].toArray();
    const storeWithBelt = (x = 1.5, y = 1.5) => {
      const store = new StructureStore();
      store.addStructureAt(x, y, belt(length));
      return store;
    };

    it("finds the belt covering a position, with where it is", () => {
      const store = storeWithBelt();
      const [region, sub] = worldPosToRegionIds(1.5, 1.5);

      expect(
        store.structureAt(
          "conveyor",
          1.5 + dx * (length - 1),
          1.5 + dy * (length - 1)
        )
      ).toEqual({
        ...belt(length),
        worldPos: [1.5, 1.5],
        regionId: region,
        id: sub,
      });
    });

    it("finds nothing past the end of the belt", () => {
      expect(
        storeWithBelt().structureAt(
          "conveyor",
          1.5 + dx * length,
          1.5 + dy * length
        )
      ).toBeNull();
    });

    it("finds nothing beside the belt", () => {
      // One tile to the side of the first tile.
      expect(
        storeWithBelt().structureAt("conveyor", 1.5 + dy, 1.5 + dx)
      ).toBeNull();
    });

    it("finds a belt that sticks out into a neighbouring region", () => {
      // Centred half a tile from the region's edge, so it spills sideways.
      const edge = REGION_SIDE_LENGTH - 0.25;
      const store = storeWithBelt(edge, edge);

      expect(
        store.structureAt("conveyor", edge + 0.4, edge + 0.4)
      ).not.toBeNull();
    });

    it("finds the belt among structures of other types", () => {
      // They go in first, so the lookup has to get past them.
      const store = new StructureStore();
      store.addStructureAt(4.5, 4.5, structure);
      store.addStructureAt(5.5, 4.5, otherStructure);
      store.addStructureAt(1.5, 1.5, belt(length));

      expect(store.structureAt("conveyor", 1.5, 1.5)?.type).toBe("conveyor");
    });

    it("finds nothing of a type with no footprint", () => {
      const store = new StructureStore();
      store.addStructureAt(1.5, 1.5, structure);

      expect(store.structureAt(structure.type, 1.5, 1.5)).toBeNull();
    });

    it("finds nothing when there is no region", () => {
      expect(new StructureStore().structureAt("conveyor", 1.5, 1.5)).toBeNull();
    });
  });

  describe("delete / deleteStructure", () => {
    it("removes a region and reports whether it existed", () => {
      const store = new StructureStore();
      store.add(origin, regionWith([1, 2, structure]));

      expect(store.delete(origin)).toBe(true);
      expect(store.delete(origin)).toBe(false);
      expect(store.optGet(origin)).toBeUndefined();
    });

    it("removes one structure and reports whether it existed", () => {
      const store = new StructureStore();
      store.add(origin, regionWith([1, 2, structure], [3, 4, otherStructure]));

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

  describe("dirty regions", () => {
    const sub = subRegionPosToId(1, 2);

    const cleanStoreWith = (
      ...entries: [reg: typeof origin, structures: RegionStructures][]
    ) => {
      const store = new StructureStore();
      for (const [reg, structures] of entries) store.add(reg, structures);
      store.flushDirtyRegions();
      return store;
    };

    it("starts with nothing dirty", () => {
      expect(new StructureStore().flushDirtyRegions()).toEqual([]);
    });

    it("marks a region dirty when it is added", () => {
      const store = new StructureStore();
      store.add(origin, regionWith([1, 2, structure]));

      expect(store.flushDirtyRegions()).toEqual([origin]);
    });

    it("marks a region dirty when it replaces an existing one", () => {
      const store = cleanStoreWith([origin, regionWith([1, 2, structure])]);
      store.add(origin, regionWith([3, 4, otherStructure]));

      expect(store.flushDirtyRegions()).toEqual([origin]);
    });

    it("leaves a region clean when it is added as not dirty", () => {
      const store = new StructureStore();
      const structures = regionWith([1, 2, structure]);
      store.add(origin, structures, false);

      expect(store.flushDirtyRegions()).toEqual([]);
      expect(store.get(origin)).toBe(structures);
    });

    it("keeps a region dirty that is added as not dirty over a dirty one", () => {
      const store = new StructureStore();
      store.add(origin, regionWith([1, 2, structure]));
      store.add(origin, regionWith([3, 4, otherStructure]), false);

      expect(store.flushDirtyRegions()).toEqual([origin]);
    });

    it("marks only the region a structure is added to", () => {
      const store = cleanStoreWith([origin, new Map()], [other, new Map()]);
      store.addStructure(other, sub, structure);

      expect(store.flushDirtyRegions()).toEqual([other]);
    });

    it("marks a region that did not exist when a structure is added to it", () => {
      const store = new StructureStore();
      store.addStructure(other, sub, structure);

      expect(store.flushDirtyRegions()).toEqual([other]);
    });

    it("marks the region a structure is added to by world position", () => {
      const store = cleanStoreWith([origin, new Map()], [other, new Map()]);
      store.addStructureAt(-0.5, 2 * REGION_SIDE_LENGTH + 0.5, structure);

      expect(store.flushDirtyRegions()).toEqual([other]);
    });

    it("marks the next region for a position just over a region's edge", () => {
      const store = cleanStoreWith([origin, new Map()]);
      store.addStructureAt(REGION_SIDE_LENGTH, 0, structure);

      expect(store.flushDirtyRegions()).toEqual([regionPosToId(1, 0)]);
    });

    it("marks a region dirty when one of its structures is deleted", () => {
      const store = cleanStoreWith(
        [origin, regionWith([1, 2, structure])],
        [other, regionWith([1, 2, structure])]
      );
      store.deleteStructure(origin, sub);

      expect(store.flushDirtyRegions()).toEqual([origin]);
    });

    it("marks a region dirty when it is deleted", () => {
      const store = cleanStoreWith([origin, regionWith([1, 2, structure])]);
      store.delete(origin);

      expect(store.flushDirtyRegions()).toEqual([origin]);
    });

    it("marks nothing dirty when deleting a region that does not exist", () => {
      const store = cleanStoreWith([origin, regionWith([1, 2, structure])]);

      expect(store.delete(other)).toBe(false);
      expect(store.flushDirtyRegions()).toEqual([]);
    });

    it("marks nothing dirty when deleting a structure that is not there", () => {
      const store = cleanStoreWith([origin, regionWith([1, 2, structure])]);

      expect(store.deleteStructure(origin, subRegionPosToId(9, 9))).toBe(false);
      expect(store.deleteStructure(other, sub)).toBe(false);
      expect(store.flushDirtyRegions()).toEqual([]);
    });

    it("keeps a deleted region dirty when it is added again as not dirty", () => {
      const store = cleanStoreWith([origin, regionWith([1, 2, structure])]);
      store.delete(origin);
      store.add(origin, new Map(), false);

      expect(store.flushDirtyRegions()).toEqual([origin]);
    });

    it("does not mark anything dirty when reading", () => {
      const store = cleanStoreWith([origin, regionWith([1, 2, structure])]);

      store.optGet(origin);
      store.get(origin);
      store.optGetStructure(origin, sub);
      store.structuresAround(0, 0, REGION_SIDE_LENGTH);
      store.structureAt("conveyor", 1.5, 1.5);
      store.ids.toArray();

      expect(store.flushDirtyRegions()).toEqual([]);
    });

    it("lists a region once however many times it changed", () => {
      const store = cleanStoreWith([origin, new Map()]);
      store.addStructureAt(1.5, 1.5, structure);
      store.addStructure(origin, sub, otherStructure);
      store.deleteStructure(origin, sub);
      store.add(origin, new Map());

      expect(store.flushDirtyRegions()).toEqual([origin]);
    });

    it("lists every region that changed", () => {
      const store = new StructureStore();
      store.add(origin, regionWith([1, 2, structure]));
      store.addStructure(other, sub, structure);

      expect(new Set(store.flushDirtyRegions())).toEqual(
        new Set([origin, other])
      );
    });

    it("clears the dirty regions when they are flushed", () => {
      const store = new StructureStore();
      store.add(origin, regionWith([1, 2, structure]));
      store.flushDirtyRegions();

      expect(store.flushDirtyRegions()).toEqual([]);
    });

    it("marks a region dirty again when it changes after a flush", () => {
      const store = cleanStoreWith([origin, regionWith([1, 2, structure])]);
      store.deleteStructure(origin, sub);
      store.flushDirtyRegions();
      store.addStructure(origin, sub, structure);

      expect(store.flushDirtyRegions()).toEqual([origin]);
    });
  });
});
