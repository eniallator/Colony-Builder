import { raise } from "niall-utils";
import { Vector } from "vectyped";
import { describe, expect, it } from "vitest";

import { componentNames } from "./component.ts";
import { PLAYER_SPEED } from "./constants.ts";
import { unsafeEntityId, type EntityId } from "./entity/index.ts";
import { EntityStore } from "./entityStore.ts";
import { worldSnapshot, type EntitySnapshot } from "./protocol/index.ts";

const a = unsafeEntityId(0);
const b = unsafeEntityId(1);
const c = unsafeEntityId(2);

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

  describe("applySnapshot", () => {
    const entity = (
      id: EntityId,
      overrides: Partial<EntitySnapshot> = {}
    ): EntitySnapshot => ({
      id,
      type: "player",
      position: Vector.create(1, 2),
      destination: undefined,
      speed: undefined,
      conveyable: undefined,
      ...overrides,
    });

    it("creates the described entities", () => {
      const store = new EntityStore();

      store.applySnapshot({
        entities: [
          entity(a, { destination: Vector.create(7, 8), speed: PLAYER_SPEED }),
          entity(b, {
            type: "item",
            position: Vector.create(3, 4),
            conveyable: true,
          }),
        ],
      });

      expect(store.get(a, "type")).toBe("player");
      expect(store.get(a, "position").toArray()).toEqual([1, 2]);
      expect(store.get(a, "destination").toArray()).toEqual([7, 8]);
      expect(store.get(a, "speed")).toBe(PLAYER_SPEED);
      expect(store.optGet(a, "conveyable")).toBeUndefined();
      expect(store.get(b, "type")).toBe("item");
      expect(store.get(b, "position").toArray()).toEqual([3, 4]);
      expect(store.get(b, "conveyable")).toBe(true);
      expect(store.optGet(b, "speed")).toBeUndefined();
    });

    it("updates existing entities in place", () => {
      const store = new EntityStore();
      store.applySnapshot({ entities: [entity(a)] });

      store.applySnapshot({
        entities: [entity(a, { position: Vector.create(9, 9) })],
      });

      expect(store.get(a, "position").toArray()).toEqual([9, 9]);
    });

    it("removes entities missing from the snapshot", () => {
      const store = new EntityStore();
      store.applySnapshot({ entities: [entity(a), entity(b)] });

      store.applySnapshot({ entities: [entity(a)] });

      expect(store.query("position")).toEqual([a]);
      expect(store.optGet(b, "type")).toBeUndefined();
    });

    it("removes every component of an entity missing from the snapshot", () => {
      const store = new EntityStore();
      store.applySnapshot({
        entities: [
          entity(a),
          entity(b, {
            destination: Vector.create(7, 8),
            speed: PLAYER_SPEED,
            conveyable: true,
          }),
        ],
      });

      store.applySnapshot({ entities: [entity(a)] });

      expect(
        componentNames.flatMap(name => store.query(name)).includes(b)
      ).toBe(false);
    });

    it("removes everything for an empty snapshot", () => {
      const store = new EntityStore();
      store.applySnapshot({ entities: [entity(a), entity(b)] });

      store.applySnapshot({ entities: [] });

      expect(store.query("position")).toEqual([]);
    });

    describe("components missing from the snapshot", () => {
      const populated = () => {
        const store = new EntityStore();
        store.applySnapshot({
          entities: [
            entity(a, {
              destination: Vector.create(7, 8),
              speed: PLAYER_SPEED,
            }),
            entity(b, { type: "item", conveyable: true }),
          ],
        });
        return store;
      };

      it("clears a destination the snapshot no longer has", () => {
        const store = populated();

        store.applySnapshot({
          entities: [entity(a, { speed: PLAYER_SPEED })],
        });

        expect(store.query("destination")).toEqual([]);
        expect(store.get(a, "speed")).toBe(PLAYER_SPEED);
      });

      it("clears a speed the snapshot no longer has", () => {
        const store = populated();

        store.applySnapshot({
          entities: [entity(a, { destination: Vector.create(7, 8) })],
        });

        expect(store.query("speed")).toEqual([]);
        expect(store.get(a, "destination").toArray()).toEqual([7, 8]);
      });

      it("clears a conveyable the snapshot no longer has", () => {
        const store = populated();

        store.applySnapshot({ entities: [entity(b, { type: "item" })] });

        expect(store.query("conveyable")).toEqual([]);
      });

      it("clears components omitted from a decoded snapshot", () => {
        const store = populated();
        const decoded = worldSnapshot.decode(
          worldSnapshot.encode({ entities: [entity(a)] })
        );

        store.applySnapshot(decoded ?? raise(new Error("Did not decode")));

        expect(store.query("destination")).toEqual([]);
        expect(store.query("speed")).toEqual([]);
      });
    });
  });
});
