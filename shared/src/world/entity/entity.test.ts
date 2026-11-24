import { Vector } from "vectyped";
import { describe, expect, it } from "vitest";

import { PLAYER_SPEED } from "../../constants.ts";
import { itemIds, type Item } from "../../item/types.ts";
import { World } from "../index.ts";
import { createItem } from "./item.ts";
import { createPlayer } from "./player.ts";
import {
  allEntityTypes,
  encEntityId,
  encEntityType,
  unsafeEntityId,
} from "./types.ts";

describe("createPlayer", () => {
  it("spawns a player at the origin by default", () => {
    const world = new World();
    const id = createPlayer(world);

    expect(world.entities.get(id, "type")).toBe("player");
    expect(world.entities.get(id, "position").toArray()).toEqual([0, 0]);
    expect(world.entities.get(id, "speed")).toBe(PLAYER_SPEED);
    expect(world.entities.optGet(id, "conveyable")).toBeUndefined();
  });

  it("spawns at the given position", () => {
    const world = new World();
    const id = createPlayer(world, Vector.create(4, 5));

    expect(world.entities.get(id, "position").toArray()).toEqual([4, 5]);
  });
});

describe("createItem", () => {
  const [itemId] = itemIds;
  const item: Item = { id: itemId, count: 1, data: false };

  it("spawns a pickable, conveyable item holding the given item", () => {
    const world = new World();
    const id = createItem(world, item, Vector.zero(2));

    expect(world.entities.get(id, "type")).toBe("item");
    expect(world.entities.get(id, "position").toArray()).toEqual([0, 0]);
    expect(world.entities.get(id, "canPickup")).toBe(true);
    expect(world.entities.get(id, "conveyable")).toBe(true);
    expect(world.entities.get(id, "inventory")).toEqual({
      [itemId]: { count: item.count, data: item.data },
    });
    expect(world.entities.optGet(id, "speed")).toBeUndefined();
  });

  it("spawns at the given position", () => {
    const world = new World();
    const id = createItem(world, item, Vector.create(-1, 2));

    expect(world.entities.get(id, "position").toArray()).toEqual([-1, 2]);
  });
});

describe("encEntityId", () => {
  it("accepts non-negative integers", () => {
    expect(encEntityId.guard(0)).toBe(true);
    expect(encEntityId.guard(12)).toBe(true);
  });

  it("rejects negatives, fractions, non-finite values and non-numbers", () => {
    expect(encEntityId.guard(-1)).toBe(false);
    expect(encEntityId.guard(1.5)).toBe(false);
    expect(encEntityId.guard(Infinity)).toBe(false);
    expect(encEntityId.guard("1")).toBe(false);
  });

  it("round-trips through four bytes", () => {
    const id = unsafeEntityId(70000);

    expect(encEntityId.encode(id)).toHaveLength(4);
    expect(encEntityId.decode(encEntityId.encode(id))).toBe(70000);
  });
});

describe("encEntityType", () => {
  it("lists every entity type", () => {
    expect(allEntityTypes).toEqual(["player", "robot", "item"]);
  });

  it.each(allEntityTypes)("round-trips %s", type => {
    expect(encEntityType.decode(encEntityType.encode(type))).toBe(type);
  });
});
