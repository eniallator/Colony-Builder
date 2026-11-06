import { Vector } from "vectyped";
import { describe, expect, it } from "vitest";

import { REGION_SIDE_LENGTH } from "../constants.ts";
import { EntityStore } from "./entityStore.ts";
import { TerrainStore } from "./terrainStore.ts";
import { World } from "./world.ts";

describe("World", () => {
  it("exposes an entity store and a terrain store", () => {
    const world = new World();

    expect(world.entities).toBeInstanceOf(EntityStore);
    expect(world.terrain).toBeInstanceOf(TerrainStore);
  });

  it("returns the same stores on every access", () => {
    const world = new World();

    expect(world.entities).toBe(world.entities);
    expect(world.terrain).toBe(world.terrain);
  });

  it("does not share stores between worlds", () => {
    expect(new World().entities).not.toBe(new World().entities);
    expect(new World().terrain).not.toBe(new World().terrain);
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
});
