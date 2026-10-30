import { Vector } from "vectyped";
import { describe, expect, it } from "vitest";

import { PLAYER_SPEED } from "../constants.ts";
import { World } from "../world.ts";
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

    expect(world.get(id, "type")).toBe("player");
    expect(world.get(id, "position").toArray()).toEqual([0, 0]);
    expect(world.get(id, "speed")).toBe(PLAYER_SPEED);
    expect(world.optGet(id, "conveyable")).toBeUndefined();
  });

  it("spawns at the given position", () => {
    const world = new World();
    const id = createPlayer(world, Vector.create(4, 5));

    expect(world.get(id, "position").toArray()).toEqual([4, 5]);
  });
});

describe("createItem", () => {
  it("spawns a conveyable item at the origin by default", () => {
    const world = new World();
    const id = createItem(world);

    expect(world.get(id, "type")).toBe("item");
    expect(world.get(id, "position").toArray()).toEqual([0, 0]);
    expect(world.get(id, "conveyable")).toBe(true);
    expect(world.optGet(id, "speed")).toBeUndefined();
  });

  it("spawns at the given position", () => {
    const world = new World();
    const id = createItem(world, Vector.create(-1, 2));

    expect(world.get(id, "position").toArray()).toEqual([-1, 2]);
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
    expect(allEntityTypes).toEqual(["player", "item"]);
  });

  it.each(allEntityTypes)("round-trips %s", type => {
    expect(encEntityType.decode(encEntityType.encode(type))).toBe(type);
  });
});
