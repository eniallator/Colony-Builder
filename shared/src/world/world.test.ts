import { Vector } from "vectyped";
import { describe, expect, it } from "vitest";

import { LOADED_SIDE_LENGTH, REGION_SIDE_LENGTH } from "../constants.ts";
import { EntityStore } from "./entity/index.ts";
import { regionPosToId, type RegionId } from "./region.ts";
import { StructureStore } from "./structure/index.ts";
import {
  TerrainStore,
  tiles,
  tileToId,
  type RegionTiles,
  type Tile,
} from "./terrain/index.ts";
import type { WorldGenerator } from "./types.ts";
import { World } from "./world.ts";

const [generatedTile, otherTile] = tiles;

const flatTiles = (tile: Tile): RegionTiles =>
  Array.from({ length: REGION_SIDE_LENGTH ** 2 }, () => tileToId(tile));

/** Generates flat regions of one tile with no structures. */
const flatGenerator: WorldGenerator = () => ({
  tiles: flatTiles(generatedTile),
  structures: new Map(),
});

describe("World", () => {
  it("exposes an entity, terrain and structure store", () => {
    const world = new World();

    expect(world.entities).toBeInstanceOf(EntityStore);
    expect(world.terrain).toBeInstanceOf(TerrainStore);
    expect(world.structures).toBeInstanceOf(StructureStore);
  });

  it("returns the same stores on every access", () => {
    const world = new World();

    expect(world.entities).toBe(world.entities);
    expect(world.terrain).toBe(world.terrain);
    expect(world.structures).toBe(world.structures);
  });

  it("does not share stores between worlds", () => {
    expect(new World().entities).not.toBe(new World().entities);
    expect(new World().terrain).not.toBe(new World().terrain);
    expect(new World().structures).not.toBe(new World().structures);
  });

  describe("entitiesAround", () => {
    it("returns the indexed entities near the position", () => {
      const world = new World();
      const near = world.entities.spawn({ position: Vector.create(1, 1) });
      world.entities.spawn({
        position: Vector.create(REGION_SIDE_LENGTH * 10, 0),
      });
      world.indexEntities();

      expect(world.entitiesAround(0, 0, 3)).toEqual([near]);
    });

    it("only returns entities that have the given components", () => {
      const world = new World();
      world.entities.spawn({ position: Vector.create(1, 1) });
      const conveyable = world.entities.spawn({
        position: Vector.create(2, 2),
        conveyable: true,
      });
      world.indexEntities();

      expect(world.entitiesAround(0, 0, 3, ["conveyable"])).toEqual([
        conveyable,
      ]);
    });

    it("leaves out entities despawned since the index was built", () => {
      const world = new World();
      const gone = world.entities.spawn({ position: Vector.create(1, 1) });
      const kept = world.entities.spawn({ position: Vector.create(2, 2) });
      world.indexEntities();

      world.entities.despawn(gone);

      expect(world.entitiesAround(0, 0, 3)).toEqual([kept]);
    });
  });

  describe("loadWorld", () => {
    const half = LOADED_SIDE_LENGTH / 2;

    it("returns the ids of the square of regions around the position", () => {
      const ids = new World().loadWorld(0, 0, flatGenerator);

      expect(ids).toHaveLength(LOADED_SIDE_LENGTH ** 2);
      expect(ids).toContain(regionPosToId(-half, -half));
      expect(ids).toContain(regionPosToId(half - 1, half - 1));
      expect(ids).not.toContain(regionPosToId(half, 0));
      expect(ids).not.toContain(regionPosToId(0, -half - 1));
    });

    it("centres the square on the region containing the position", () => {
      const ids = new World().loadWorld(
        2.5 * REGION_SIDE_LENGTH,
        -0.5 * REGION_SIDE_LENGTH,
        flatGenerator
      );

      expect(ids).toContain(regionPosToId(2 - half, -1 - half));
      expect(ids).toContain(regionPosToId(2 + half - 1, -1 + half - 1));
      expect(ids).not.toContain(regionPosToId(2 + half, -1));
    });

    it("loads the generated tiles of every region it returns", () => {
      const world = new World();

      const ids = world.loadWorld(0, 0, flatGenerator);

      expect(world.terrain.ids.toArray()).toEqual(ids);
      for (const id of ids) {
        expect(world.terrain.get(id)).toEqual(flatTiles(generatedTile));
      }
    });

    it("keeps regions that already exist", () => {
      const world = new World();
      const existing = flatTiles(otherTile);
      world.terrain.add(regionPosToId(0, 0), existing);

      world.loadWorld(0, 0, flatGenerator);

      expect(world.terrain.get(regionPosToId(0, 0))).toBe(existing);
    });

    it("only calls the generator for regions that do not exist yet", () => {
      const world = new World();
      world.terrain.add(regionPosToId(0, 0), flatTiles(otherTile));
      const generated: RegionId[] = [];

      world.loadWorld(0, 0, id => {
        generated.push(id);
        return flatGenerator(id);
      });

      expect(generated).toHaveLength(LOADED_SIDE_LENGTH ** 2 - 1);
      expect(generated).not.toContain(regionPosToId(0, 0));
    });

    it("returns the same ids when called again", () => {
      const world = new World();

      expect(world.loadWorld(0, 0, flatGenerator)).toEqual(
        world.loadWorld(0, 0, flatGenerator)
      );
    });

    it("only adds the new regions when the position moves", () => {
      const world = new World();
      world.loadWorld(0, 0, flatGenerator);

      world.loadWorld(REGION_SIDE_LENGTH, 0, flatGenerator);

      expect(world.terrain.ids.toArray()).toHaveLength(
        LOADED_SIDE_LENGTH * (LOADED_SIDE_LENGTH + 1)
      );
    });
  });

  describe("flushAllDirtyRegions", () => {
    const dirtyAfter = (world: World) => new Set(world.flushAllDirtyRegions());

    it("starts with nothing dirty", () => {
      expect(new World().flushAllDirtyRegions()).toEqual([]);
    });

    it("leaves the regions it generates clean", () => {
      const world = new World();
      world.loadWorld(0, 0, flatGenerator);

      expect(world.flushAllDirtyRegions()).toEqual([]);
    });

    it("keeps a region dirty when loading around it", () => {
      const world = new World();
      const id = regionPosToId(0, 0);
      world.terrain.add(id, flatTiles(otherTile));
      world.loadWorld(0, 0, flatGenerator);

      expect(dirtyAfter(world)).toEqual(new Set([id]));
    });

    it("includes a region whose terrain changed", () => {
      const world = new World();
      world.loadWorld(0, 0, flatGenerator);
      world.terrain.addTile(1, 1, tileToId(otherTile));

      expect(dirtyAfter(world)).toEqual(new Set([regionPosToId(0, 0)]));
    });

    it("includes a region whose structures changed", () => {
      const world = new World();
      world.loadWorld(0, 0, flatGenerator);
      world.structures.addStructureAt(1.5, 1.5, { type: "tree", data: true });

      expect(dirtyAfter(world)).toEqual(new Set([regionPosToId(0, 0)]));
    });

    it("includes the regions of both stores when they differ", () => {
      const world = new World();
      world.loadWorld(0, 0, flatGenerator);
      world.terrain.addTile(1, 1, tileToId(otherTile));
      world.structures.addStructureAt(REGION_SIDE_LENGTH + 1.5, 1.5, {
        type: "tree",
        data: true,
      });

      expect(dirtyAfter(world)).toEqual(
        new Set([regionPosToId(0, 0), regionPosToId(1, 0)])
      );
    });

    it("clears both stores", () => {
      const world = new World();
      world.loadWorld(0, 0, flatGenerator);
      world.terrain.addTile(1, 1, tileToId(otherTile));
      world.structures.addStructureAt(1.5, 1.5, { type: "tree", data: true });
      world.flushAllDirtyRegions();

      expect(world.flushAllDirtyRegions()).toEqual([]);
    });

    it("leaves the regions of an applied snapshot clean", () => {
      const source = new World();
      const ids = source.loadWorld(0, 0, flatGenerator);
      const target = new World();

      target.applySnapshot(source.takeSnapshot(ids));

      expect(target.flushAllDirtyRegions()).toEqual([]);
      expect(target.terrain.ids.toArray()).toEqual(ids);
    });

    it("includes the regions that were unloaded and not the ones kept", () => {
      const world = new World();
      world.loadWorld(0, 0, flatGenerator);
      world.flushAllDirtyRegions();

      const unloaded = world.unloadOutside(0, 0, 2);

      expect(unloaded.length).toBeGreaterThan(0);
      expect(dirtyAfter(world)).toEqual(new Set(unloaded));
      expect(world.terrain.ids.toArray().length).toBeGreaterThan(0);
    });

    it("keeps an unloaded region dirty when it is generated again", () => {
      const world = new World();
      world.loadWorld(0, 0, flatGenerator);
      world.flushAllDirtyRegions();
      const unloaded = world.unloadOutside(0, 0, 2);

      world.loadWorld(0, 0, flatGenerator);

      expect(dirtyAfter(world)).toEqual(new Set(unloaded));
    });
  });

  describe("trackChanges", () => {
    const changeEverything = (world: World) => {
      world.entities.spawn({ position: Vector.zero(2) });
      world.loadWorld(0, 0, flatGenerator);
      world.terrain.addTile(0, 0, tileToId(otherTile));
      world.structures.addStructureAt(1, 1, { type: "tree", data: true });
    };

    it("tracks changes to every store by default", () => {
      const world = new World();

      changeEverything(world);

      expect(world.entities.flushDirtyEntities()).toHaveLength(1);
      expect(world.terrain.flushDirtyRegions()).toHaveLength(1);
      expect(world.structures.flushDirtyRegions()).toHaveLength(1);
    });

    it("tracks changes to every store when turned on", () => {
      const world = new World({ trackChanges: true });

      changeEverything(world);

      expect(world.entities.flushDirtyEntities()).toHaveLength(1);
      expect(world.flushAllDirtyRegions().length).toBeGreaterThan(0);
    });

    it("tracks nothing in any store when turned off", () => {
      const world = new World({ trackChanges: false });

      changeEverything(world);

      expect(world.entities.flushDirtyEntities()).toEqual([]);
      expect(world.flushAllDirtyRegions()).toEqual([]);
    });
  });
});
