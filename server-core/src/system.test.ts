import {
  createItem,
  createPlayer,
  itemIds,
  mergeInventories,
  PICKUP_SQR_RADIUS,
  selfMovementSystem,
  World,
} from "@colony-builder/shared";
import { Vector } from "vectyped";
import { describe, expect, it, vi } from "vitest";

import type { State } from "./state.ts";
import { pickupSystem, serverSystems } from "./system.ts";
import { taskSystem } from "./task/system.ts";

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

  it("includes the task system", () => {
    expect(serverSystems).toContain(taskSystem);
  });

  it("includes the pickup system", () => {
    expect(serverSystems).toContain(pickupSystem);
  });
});

describe("pickupSystem", () => {
  const [itemId] = itemIds;
  const here = Vector.create(5, 5);

  it("moves nearby items into the player's inventory and despawns them", () => {
    const world = new World();
    const player = createPlayer(world, here.copy());
    const dropped = { count: 1 };
    const item = createItem(world, itemId, dropped, here.copy());

    runPickup(world);

    expect(world.entities.get(player, "inventory").get(itemId)).toEqual(
      dropped
    );
    expect(world.entities.optGet(item, "position")).toBeUndefined();
  });

  it("stacks onto items the player already holds", () => {
    const [held, dropped] = [1, 2];
    const world = new World();
    const player = createPlayer(world, here.copy());
    world.entities.get(player, "inventory").set(itemId, { count: held });
    createItem(world, itemId, { count: dropped }, here.copy());

    runPickup(world);

    expect(world.entities.get(player, "inventory").get(itemId)).toEqual({
      count: held + dropped,
    });
  });

  it("leaves items outside the pickup radius", () => {
    const world = new World();
    const player = createPlayer(world, here.copy());
    const item = createItem(
      world,
      itemId,
      { count: 1 },
      here.copy().add(Vector.create(Math.sqrt(PICKUP_SQR_RADIUS) + 0.5, 0))
    );

    runPickup(world);

    expect(world.entities.get(player, "inventory").size).toBe(0);
    expect(world.entities.optGet(item, "position")).toBeDefined();
  });

  it("ignores non-player entities with an inventory", () => {
    const world = new World();
    const heldCount = 1;
    const holder = createItem(
      world,
      itemId,
      { count: heldCount },
      Vector.zero(2)
    );
    const other = createItem(world, itemId, { count: 2 }, Vector.zero(2));

    runPickup(world);

    expect(world.entities.get(holder, "inventory").get(itemId)).toEqual({
      count: heldCount,
    });
    expect(world.entities.optGet(other, "position")).toBeDefined();
  });

  it("keeps the pickup with what is left over when not everything fits", () => {
    const world = new World();
    createPlayer(world, Vector.zero(2));
    const item = createItem(world, itemId, { count: 2 }, Vector.zero(2));
    const leftover = new Map([[itemId, { count: 1 }]]);
    vi.mocked(mergeInventories).mockReturnValueOnce(leftover);

    runPickup(world);

    expect(world.entities.get(item, "inventory")).toBe(leftover);
  });
});
