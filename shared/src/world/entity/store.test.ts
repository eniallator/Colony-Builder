import { raise } from "niall-utils/core";
import { Vector } from "vectyped";
import { describe, expect, it } from "vitest";

import { PLAYER_SPEED } from "../../constants.ts";
import {
  itemIds,
  type Inventory,
  type Item,
  type ItemData,
} from "../../item/types.ts";
import { World } from "../index.ts";
import {
  createItem,
  createPlayer,
  unsafeEntityId,
  type Components,
  type EntityId,
} from "./index.ts";
import { EntityStore } from "./store.ts";
import {
  allEntityTypes,
  componentNames,
  encEntitySnapshot,
  type EntitySnapshot,
} from "./types.ts";

const a = unsafeEntityId(0);
const b = unsafeEntityId(1);
const c = unsafeEntityId(2);

const [typeA, typeB] = allEntityTypes;
const [itemId] = itemIds;
const speed = 1;

const component = (overrides: Partial<Components> = {}): Components => ({
  type: typeA,
  position: Vector.create(1, 2),
  destination: undefined,
  speed: undefined,
  canPickup: undefined,
  conveyable: undefined,
  inventory: undefined,
  taskList: undefined,
  ...overrides,
});

const sampleData: ItemData<typeof itemId> = true;
const sampleItem: Item = { id: itemId, count: 1, data: sampleData };
const { id: _id, ...sampleContents } = sampleItem;

const snapshotOf = (...entities: [EntityId, Components][]): EntitySnapshot =>
  new Map(entities);

describe("EntityStore", () => {
  describe("add / optGet / get", () => {
    it("stores and returns components per entity", () => {
      const store = new EntityStore();
      store.add(a, "speed", 1);
      store.add(b, "speed", 2);

      expect(store.get(a, "speed")).toBe(1);
      expect(store.optGet(b, "speed")).toBe(2);
    });

    it("overwrites an existing component", () => {
      const store = new EntityStore();
      store.add(a, "speed", 1);
      store.add(a, "speed", 5);

      expect(store.get(a, "speed")).toBe(5);
    });

    it("returns undefined from optGet when the component is missing", () => {
      expect(new EntityStore().optGet(a, "speed")).toBeUndefined();
    });

    it("throws from get when the component is missing", () => {
      expect(() => new EntityStore().get(a, "speed")).toThrow(
        'Entity 0 has no "speed" component'
      );
    });
  });

  describe("delete", () => {
    it("removes one component and reports whether it existed", () => {
      const store = new EntityStore();
      store.add(a, "speed", 1);
      store.add(a, "position", Vector.zero(2));

      expect(store.delete(a, "speed")).toBe(true);
      expect(store.delete(a, "speed")).toBe(false);
      expect(store.optGet(a, "speed")).toBeUndefined();
      expect(store.optGet(a, "position")).toBeDefined();
    });
  });

  describe("query", () => {
    it("returns entities that have every requested component", () => {
      const store = new EntityStore();
      store.add(a, "speed", 1);
      store.add(a, "position", Vector.zero(2));
      store.add(b, "speed", 1);
      store.add(c, "position", Vector.zero(2));

      expect(store.query("speed")).toEqual([a, b]);
      expect(store.query("speed", "position")).toEqual([a]);
    });

    it("returns an empty list when nothing matches", () => {
      expect(new EntityStore().query("speed")).toEqual([]);
    });
  });

  describe("ids", () => {
    it("iterates the entities that have a position", () => {
      const store = new EntityStore();
      store.add(a, "position", Vector.zero(2));
      store.add(b, "speed", 1);
      store.add(c, "position", Vector.zero(2));

      expect([...store.ids]).toEqual([a, c]);
    });
  });

  describe("spawn", () => {
    it("hands out sequential ids", () => {
      const store = new EntityStore();

      expect(store.spawn()).toBe(0);
      expect(store.spawn()).toBe(1);
      expect(store.spawn()).toBe(2);
    });

    it("spawns an entity without components by default", () => {
      const store = new EntityStore();
      const id = store.spawn();

      expect(componentNames.some(name => store.optGet(id, name) != null)).toBe(
        false
      );
    });

    it("adds the given components", () => {
      const store = new EntityStore();

      const id = store.spawn({ speed: 3, position: Vector.create(1, 2) });

      expect(store.get(id, "speed")).toBe(3);
      expect(store.get(id, "position").toArray()).toEqual([1, 2]);
    });

    it("skips components that are undefined", () => {
      const store = new EntityStore();

      const id = store.spawn({ speed: undefined });

      expect(store.optGet(id, "speed")).toBeUndefined();
    });

    it("does not reuse the id of a despawned entity", () => {
      const store = new EntityStore();
      const gone = store.spawn();
      store.despawn(gone);

      expect(store.spawn()).not.toBe(gone);
    });
  });

  describe("despawn", () => {
    it("removes every component of the entity only", () => {
      const store = new EntityStore();
      const gone = store.spawn({ speed: 1, position: Vector.zero(2) });
      const kept = store.spawn({ speed: 1, position: Vector.zero(2) });

      store.despawn(gone);

      expect(store.optGet(gone, "speed")).toBeUndefined();
      expect(store.optGet(gone, "position")).toBeUndefined();
      expect(store.query("speed")).toEqual([kept]);
    });
  });

  describe("takeSnapshot", () => {
    it("captures players and items by id", () => {
      const world = new World();
      const player = createPlayer(world, Vector.create(1, 2));
      const item = createItem(world, sampleItem, Vector.create(3, 4));

      expect(world.entities.takeSnapshot([player, item])).toEqual(
        new Map([
          [
            player,
            {
              type: "player",
              position: Vector.create(1, 2),
              destination: undefined,
              speed: PLAYER_SPEED,
              canPickup: undefined,
              conveyable: undefined,
              // Starting inventory contents are temporary
              inventory: world.entities.get(player, "inventory"),
              taskList: { tasks: [], repeat: false },
            },
          ],
          [
            item,
            {
              type: "item",
              position: Vector.create(3, 4),
              destination: undefined,
              speed: undefined,
              canPickup: true,
              conveyable: true,
              inventory: { [itemId]: sampleContents },
              taskList: undefined,
            },
          ],
        ])
      );
    });

    it("captures the contents of an inventory", () => {
      const world = new World();
      const contents = { data: sampleItem.data, count: 3 };
      const item = createItem(
        world,
        { id: itemId, ...contents },
        Vector.zero(2)
      );

      expect(world.entities.takeSnapshot([item]).get(item)?.inventory).toEqual({
        [itemId]: contents,
      });
    });

    it("round-trips an inventory with items in it", () => {
      const world = new World();
      const item = createItem(
        world,
        { ...sampleItem, count: 3 },
        Vector.zero(2)
      );
      const snapshot = world.entities.takeSnapshot([item]);

      expect(
        encEntitySnapshot.decode(encEntitySnapshot.encode(snapshot))
      ).toEqual(snapshot);
    });

    it("includes the destination when there is one", () => {
      const world = new World();
      const player = createPlayer(world);
      world.entities.add(player, "destination", Vector.create(5, 6));

      expect(
        world.entities.takeSnapshot([player]).get(player)?.destination
      ).toEqual(Vector.create(5, 6));
    });

    it("only captures the requested ids", () => {
      const world = new World();
      createPlayer(world);
      const item = createItem(world, sampleItem, Vector.zero(2));

      expect([...world.entities.takeSnapshot([item]).keys()]).toEqual([item]);
    });

    it("is empty when no ids are requested", () => {
      const world = new World();
      createPlayer(world);

      expect(world.entities.takeSnapshot([])).toEqual(new Map());
    });

    it("survives an encode / decode round trip", () => {
      const world = new World();
      const player = createPlayer(world, Vector.create(1.5, 2.5));
      const item = createItem(world, sampleItem, Vector.zero(2));

      const snapshot = world.entities.takeSnapshot([player, item]);

      expect(
        encEntitySnapshot.decode(encEntitySnapshot.encode(snapshot))
      ).toEqual(snapshot);
    });

    it("can be applied to another EntityStore", () => {
      const world = new World();
      const player = createPlayer(world, Vector.create(1, 2));
      const item = createItem(world, sampleItem, Vector.create(3, 4));
      const store = new EntityStore();

      store.applySnapshot(world.entities.takeSnapshot([player, item]));

      expect(store.get(player, "position").toArray()).toEqual([1, 2]);
      expect(store.get(item, "position").toArray()).toEqual([3, 4]);
      expect(store.get(item, "conveyable")).toBe(true);
    });
  });

  describe("dirty entities", () => {
    const stored = () => {
      const store = new EntityStore();
      const id = store.spawn(component());
      store.flushDirtyEntities();
      return { store, id };
    };

    it("is empty for a new store", () => {
      expect(new EntityStore().flushDirtyEntities()).toEqual([]);
    });

    it("includes a spawned entity", () => {
      const store = new EntityStore();

      const id = store.spawn(component());

      expect(store.flushDirtyEntities()).toEqual([id]);
    });

    it("includes an entity a component was added to", () => {
      const { store, id } = stored();

      store.add(id, "speed", speed);

      expect(store.flushDirtyEntities()).toEqual([id]);
    });

    it("includes an entity a component was replaced on", () => {
      const { store, id } = stored();
      store.add(id, "speed", speed);
      store.flushDirtyEntities();

      store.add(id, "speed", speed + 1);

      expect(store.flushDirtyEntities()).toEqual([id]);
    });

    it("includes an entity a component was deleted from", () => {
      const { store, id } = stored();
      store.add(id, "speed", speed);
      store.flushDirtyEntities();

      store.delete(id, "speed");

      expect(store.flushDirtyEntities()).toEqual([id]);
    });

    it("leaves out an entity when the component to delete was not there", () => {
      const { store, id } = stored();

      store.delete(id, "speed");

      expect(store.flushDirtyEntities()).toEqual([]);
    });

    it("includes a despawned entity", () => {
      const { store, id } = stored();

      store.despawn(id);

      expect(store.flushDirtyEntities()).toEqual([id]);
    });

    it("leaves out an entity that was only read", () => {
      const { store, id } = stored();

      store.get(id, "position");
      store.query("position");
      store.takeSnapshot([id]);

      expect(store.flushDirtyEntities()).toEqual([]);
    });

    it("lists an entity once however many times it changed", () => {
      const { store, id } = stored();

      store.add(id, "speed", speed);
      store.add(id, "speed", speed + 1);
      store.delete(id, "speed");

      expect(store.flushDirtyEntities()).toEqual([id]);
    });

    it("lists every entity that changed", () => {
      const { store, id } = stored();
      const other = store.spawn(component());
      store.flushDirtyEntities();

      store.add(other, "speed", speed);
      store.add(id, "speed", speed);

      expect(store.flushDirtyEntities()).toEqual([other, id]);
    });

    it("is empty once flushed", () => {
      const { store, id } = stored();
      store.add(id, "speed", speed);
      store.flushDirtyEntities();

      expect(store.flushDirtyEntities()).toEqual([]);
    });

    describe("when not tracking changes", () => {
      it("never lists an entity", () => {
        const store = new EntityStore(false);

        const id = store.spawn(component());
        store.add(id, "speed", speed);
        store.delete(id, "speed");
        store.despawn(id);

        expect(store.flushDirtyEntities()).toEqual([]);
      });
    });
  });

  describe("applySnapshot", () => {
    it("creates the described entities", () => {
      const store = new EntityStore();

      store.applySnapshot(
        snapshotOf(
          [
            a,
            component({
              destination: Vector.create(7, 8),
              speed,
            }),
          ],
          [
            b,
            component({
              type: typeB,
              position: Vector.create(3, 4),
              conveyable: true,
            }),
          ]
        )
      );

      expect(store.get(a, "type")).toBe(typeA);
      expect(store.get(a, "position").toArray()).toEqual([1, 2]);
      expect(store.get(a, "destination").toArray()).toEqual([7, 8]);
      expect(store.get(a, "speed")).toBe(speed);
      expect(store.optGet(a, "conveyable")).toBeUndefined();
      expect(store.get(b, "type")).toBe(typeB);
      expect(store.get(b, "position").toArray()).toEqual([3, 4]);
      expect(store.get(b, "conveyable")).toBe(true);
      expect(store.optGet(b, "speed")).toBeUndefined();
    });

    it("updates existing entities in place", () => {
      const store = new EntityStore();
      store.applySnapshot(snapshotOf([a, component()]));

      store.applySnapshot(
        snapshotOf([a, component({ position: Vector.create(9, 9) })])
      );

      expect(store.get(a, "position").toArray()).toEqual([9, 9]);
    });

    // A snapshot only holds the entities that changed, so it never removes any.
    it("keeps entities missing from the snapshot", () => {
      const store = new EntityStore();
      store.applySnapshot(snapshotOf([a, component()], [b, component()]));

      store.applySnapshot(snapshotOf([a, component()]));

      expect(store.query("position")).toEqual([a, b]);
      expect(store.get(b, "type")).toBe(typeA);
    });

    it("keeps every component of an entity missing from the snapshot", () => {
      const store = new EntityStore();
      store.applySnapshot(
        snapshotOf(
          [a, component()],
          [
            b,
            component({
              destination: Vector.create(7, 8),
              speed,
              conveyable: true,
            }),
          ]
        )
      );

      store.applySnapshot(snapshotOf([a, component()]));

      expect(store.get(b, "destination").toArray()).toEqual([7, 8]);
      expect(store.get(b, "speed")).toBe(speed);
      expect(store.get(b, "conveyable")).toBe(true);
    });

    it("keeps everything for an empty snapshot", () => {
      const store = new EntityStore();
      store.applySnapshot(snapshotOf([a, component()], [b, component()]));

      store.applySnapshot(new Map());

      expect(store.query("position")).toEqual([a, b]);
    });

    it("does not mark the entities it applies as dirty", () => {
      const store = new EntityStore();

      store.applySnapshot(snapshotOf([a, component()]));

      expect(store.flushDirtyEntities()).toEqual([]);
    });

    describe("components missing from the snapshot", () => {
      const populated = () => {
        const store = new EntityStore();
        store.applySnapshot(
          snapshotOf(
            [
              a,
              component({
                destination: Vector.create(7, 8),
                speed,
              }),
            ],
            [b, component({ type: typeB, conveyable: true })]
          )
        );
        return store;
      };

      it("clears a destination the snapshot no longer has", () => {
        const store = populated();

        store.applySnapshot(snapshotOf([a, component({ speed })]));

        expect(store.query("destination")).toEqual([]);
        expect(store.get(a, "speed")).toBe(speed);
      });

      it("clears a speed the snapshot no longer has", () => {
        const store = populated();

        store.applySnapshot(
          snapshotOf([a, component({ destination: Vector.create(7, 8) })])
        );

        expect(store.query("speed")).toEqual([]);
        expect(store.get(a, "destination").toArray()).toEqual([7, 8]);
      });

      it("clears a conveyable the snapshot no longer has", () => {
        const store = populated();

        store.applySnapshot(snapshotOf([b, component({ type: typeB })]));

        expect(store.query("conveyable")).toEqual([]);
      });

      it("stores and then clears an inventory", () => {
        const store = populated();
        const inventory: Inventory = {
          [itemId]: { ...sampleContents, count: 2 },
        };

        store.applySnapshot(
          snapshotOf([b, component({ type: typeB, inventory })])
        );
        expect(store.get(b, "inventory")).toEqual(inventory);

        store.applySnapshot(snapshotOf([b, component({ type: typeB })]));
        expect(store.query("inventory")).toEqual([]);
      });

      it("clears components omitted from a decoded snapshot", () => {
        const store = populated();
        const decoded = encEntitySnapshot.decode(
          encEntitySnapshot.encode(snapshotOf([a, component()]))
        );

        store.applySnapshot(decoded ?? raise(new Error("Did not decode")));

        expect(store.query("destination")).toEqual([]);
        expect(store.query("speed")).toEqual([]);
      });
    });
  });
});
