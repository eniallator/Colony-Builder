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
});
