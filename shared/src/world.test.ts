import { Vector } from "vectyped";
import { describe, expect, it } from "vitest";

import { componentNames } from "./component.ts";
import { PLAYER_SPEED } from "./constants.ts";
import { createItem, createPlayer } from "./entity/index.ts";
import { EntityStore } from "./entityStore.ts";
import { worldSnapshot } from "./protocol/index.ts";
import { World } from "./world.ts";

describe("World", () => {
  it("is an EntityStore", () => {
    expect(new World()).toBeInstanceOf(EntityStore);
  });

  describe("spawn", () => {
    it("hands out sequential ids", () => {
      const world = new World();

      expect(world.spawn()).toBe(0);
      expect(world.spawn()).toBe(1);
      expect(world.spawn()).toBe(2);
    });

    it("spawns an entity without components by default", () => {
      const world = new World();
      const id = world.spawn();

      expect(componentNames.some(name => world.optGet(id, name) != null)).toBe(
        false
      );
    });

    it("adds the given components", () => {
      const world = new World();

      const id = world.spawn({ speed: 3, position: Vector.create(1, 2) });

      expect(world.get(id, "speed")).toBe(3);
      expect(world.get(id, "position").toArray()).toEqual([1, 2]);
    });

    it("skips components that are undefined", () => {
      const world = new World();

      const id = world.spawn({ speed: undefined });

      expect(world.optGet(id, "speed")).toBeUndefined();
    });

    it("does not reuse the id of a despawned entity", () => {
      const world = new World();
      const gone = world.spawn();
      world.despawn(gone);

      expect(world.spawn()).not.toBe(gone);
    });
  });

  describe("despawn", () => {
    it("removes every component of the entity only", () => {
      const world = new World();
      const gone = world.spawn({ speed: 1, position: Vector.zero(2) });
      const kept = world.spawn({ speed: 1, position: Vector.zero(2) });

      world.despawn(gone);

      expect(world.optGet(gone, "speed")).toBeUndefined();
      expect(world.optGet(gone, "position")).toBeUndefined();
      expect(world.query("speed")).toEqual([kept]);
    });
  });

  describe("takeSnapshot", () => {
    it("captures players and items", () => {
      const world = new World();
      const player = createPlayer(world, Vector.create(1, 2));
      const item = createItem(world, Vector.create(3, 4));

      expect(world.takeSnapshot().entities).toEqual([
        {
          id: player,
          type: "player",
          position: Vector.create(1, 2),
          destination: undefined,
          speed: PLAYER_SPEED,
          conveyable: undefined,
        },
        {
          id: item,
          type: "item",
          position: Vector.create(3, 4),
          destination: undefined,
          speed: undefined,
          conveyable: true,
        },
      ]);
    });

    it("includes the destination when there is one", () => {
      const world = new World();
      const player = createPlayer(world);
      world.add(player, "destination", Vector.create(5, 6));

      expect(world.takeSnapshot().entities[0]?.destination).toEqual(
        Vector.create(5, 6)
      );
    });

    it("skips entities without a position", () => {
      const world = new World();
      world.spawn({ speed: 1 });

      expect(world.takeSnapshot().entities).toEqual([]);
    });

    it("throws for an entity with a position but no type", () => {
      const world = new World();
      world.spawn({ position: Vector.zero(2) });

      expect(() => world.takeSnapshot()).toThrow(
        'Entity 0 has no "type" component'
      );
    });

    it("survives an encode / decode round trip", () => {
      const world = new World();
      createPlayer(world, Vector.create(1.5, 2.5));
      createItem(world);

      const snapshot = world.takeSnapshot();

      expect(worldSnapshot.decode(worldSnapshot.encode(snapshot))).toEqual(
        snapshot
      );
    });

    it("can be applied to an EntityStore", () => {
      const world = new World();
      const player = createPlayer(world, Vector.create(1, 2));
      const item = createItem(world, Vector.create(3, 4));
      const store = new EntityStore();

      store.applySnapshot(world.takeSnapshot());

      expect(store.get(player, "position").toArray()).toEqual([1, 2]);
      expect(store.get(item, "position").toArray()).toEqual([3, 4]);
      expect(store.get(item, "conveyable")).toBe(true);
    });
  });
});
