import { Vector } from "vectyped";
import { describe, expect, it } from "vitest";

import { createItem, createPlayer } from "../entity/index.ts";
import { encWorldSnapshot } from "../protocol/index.ts";
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

  describe("takeSnapshot", () => {
    it("wraps the entity store snapshot", () => {
      const world = new World();
      createPlayer(world, Vector.create(1, 2));
      createItem(world, Vector.create(3, 4));

      expect(world.takeSnapshot()).toEqual({
        entities: world.entities.takeSnapshot(),
        terrain: world.terrain.takeSnapshot(),
      });
    });

    it("is empty for an empty world", () => {
      expect(new World().takeSnapshot()).toEqual({
        entities: new Map(),
        terrain: new Map(),
      });
    });

    it("survives an encode / decode round trip", () => {
      const world = new World();
      createPlayer(world, Vector.create(1.5, 2.5));
      createItem(world);

      const snapshot = world.takeSnapshot();

      expect(
        encWorldSnapshot.decode(encWorldSnapshot.encode(snapshot))
      ).toEqual(snapshot);
    });
  });

  describe("applySnapshot", () => {
    it("replicates another world's entities", () => {
      const server = new World();
      const player = createPlayer(server, Vector.create(1, 2));
      const item = createItem(server, Vector.create(3, 4));
      const client = new World();

      client.applySnapshot(server.takeSnapshot());

      expect(client.entities.get(player, "position").toArray()).toEqual([1, 2]);
      expect(client.entities.get(item, "position").toArray()).toEqual([3, 4]);
      expect(client.entities.get(item, "conveyable")).toBe(true);
    });

    it("removes entities that are no longer in the snapshot", () => {
      const server = new World();
      const player = createPlayer(server);
      const client = new World();
      client.applySnapshot(server.takeSnapshot());

      server.entities.despawn(player);
      client.applySnapshot(server.takeSnapshot());

      expect(client.entities.query("position")).toEqual([]);
    });
  });
});
