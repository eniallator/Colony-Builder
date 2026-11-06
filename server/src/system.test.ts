import {
  createItem,
  createPlayer,
  mergeInventories,
  PICKUP_SQR_RADIUS,
  selfMovementSystem,
  World,
} from "@colony-builder/shared";
import { Vector } from "vectyped";
import { describe, expect, it, vi } from "vitest";

import type { State } from "./state.ts";
import { pickupSystem, serverSystems } from "./system.ts";

vi.mock(import("@colony-builder/shared"), async importOriginal => {
  const original = await importOriginal();
  return { ...original, mergeInventories: vi.fn(original.mergeInventories) };
});

const runPickup = (world: World) => {
  world.indexEntities();
  const ctx: Parameters<typeof pickupSystem>[0] = {
    world,
    dt: 0.05,
    state: { players: new Map() } as unknown as State,
  };
  pickupSystem(ctx);
};

describe("serverSystems", () => {
  it("includes the movement system", () => {
    expect(serverSystems).toContain(selfMovementSystem);
  });

  it("includes the pickup system", () => {
    expect(serverSystems).toContain(pickupSystem);
  });
});

describe("pickupSystem", () => {
  it("moves nearby items into the player's inventory and despawns them", () => {
    const world = new World();
    const player = createPlayer(world, Vector.create(5, 5));
    const item = createItem(
      world,
      { id: "log", count: 3 },
      Vector.create(5, 5)
    );

    runPickup(world);

    expect(world.entities.get(player, "inventory").get("log")).toEqual({
      count: 3,
    });
    expect(world.entities.optGet(item, "position")).toBeUndefined();
  });

  it("stacks onto items the player already holds", () => {
    const world = new World();
    const player = createPlayer(world, Vector.create(5, 5));
    world.entities.get(player, "inventory").set("log", { count: 2 });
    createItem(world, { id: "log", count: 3 }, Vector.create(5, 5));

    runPickup(world);

    expect(world.entities.get(player, "inventory").get("log")).toEqual({
      count: 5,
    });
  });

  it("leaves items outside the pickup radius", () => {
    const world = new World();
    const player = createPlayer(world, Vector.create(5, 5));
    const item = createItem(
      world,
      { id: "log", count: 3 },
      Vector.create(5 + Math.sqrt(PICKUP_SQR_RADIUS) + 0.5, 5)
    );

    runPickup(world);

    expect(world.entities.get(player, "inventory").size).toBe(0);
    expect(world.entities.optGet(item, "position")).toBeDefined();
  });

  it("ignores non-player entities with an inventory", () => {
    const world = new World();
    const holder = createItem(world, { id: "log", count: 1 }, Vector.zero(2));
    const other = createItem(world, { id: "log", count: 4 }, Vector.zero(2));

    runPickup(world);

    expect(world.entities.get(holder, "inventory").get("log")).toEqual({
      count: 1,
    });
    expect(world.entities.optGet(other, "position")).toBeDefined();
  });

  it("keeps the pickup with what is left over when not everything fits", () => {
    const world = new World();
    createPlayer(world, Vector.zero(2));
    const item = createItem(world, { id: "log", count: 3 }, Vector.zero(2));
    const leftover = new Map([["log", { count: 1 }]] as const);
    vi.mocked(mergeInventories).mockReturnValueOnce(leftover);

    runPickup(world);

    expect(world.entities.get(item, "inventory")).toBe(leftover);
  });
});
