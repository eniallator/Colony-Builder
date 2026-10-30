import { Vector } from "vectyped";
import { describe, expect, it } from "vitest";

import { movementSystem, predictionSystems } from "./system.ts";
import { World } from "./world.ts";

const spawnMover = (
  world: World,
  position: [number, number],
  destination: [number, number],
  speed: number
) =>
  world.spawn({
    position: Vector.create(...position),
    destination: Vector.create(...destination),
    speed,
  });

describe("movementSystem", () => {
  it("moves towards the destination by speed * dt", () => {
    const world = new World();
    const id = spawnMover(world, [0, 0], [10, 0], 2);

    movementSystem({ store: world, dt: 1.5 });

    expect(world.get(id, "position").toArray()).toEqual([3, 0]);
    expect(world.optGet(id, "destination")).toBeDefined();
  });

  it("moves along a diagonal at the same speed", () => {
    const world = new World();
    const id = spawnMover(world, [0, 0], [30, 40], 5);

    movementSystem({ store: world, dt: 1 });

    expect(world.get(id, "position").toArray()).toEqual([3, 4]);
  });

  it("snaps to the destination and clears it when within reach", () => {
    const world = new World();
    const id = spawnMover(world, [0, 0], [1, 0], 2);

    movementSystem({ store: world, dt: 1 });

    expect(world.get(id, "position").toArray()).toEqual([1, 0]);
    expect(world.optGet(id, "destination")).toBeUndefined();
  });

  it("arrives when exactly in reach", () => {
    const world = new World();
    const id = spawnMover(world, [0, 0], [2, 0], 2);

    movementSystem({ store: world, dt: 1 });

    expect(world.get(id, "position").toArray()).toEqual([2, 0]);
    expect(world.optGet(id, "destination")).toBeUndefined();
  });

  it("does not move an entity that has arrived", () => {
    const world = new World();
    const id = spawnMover(world, [0, 0], [10, 0], 2);

    movementSystem({ store: world, dt: 10 });
    movementSystem({ store: world, dt: 10 });

    expect(world.get(id, "position").toArray()).toEqual([10, 0]);
  });

  it("ignores entities without a destination or speed", () => {
    const world = new World();
    const noDestination = world.spawn({
      position: Vector.create(1, 1),
      speed: 5,
    });
    const noSpeed = world.spawn({
      position: Vector.create(1, 1),
      destination: Vector.create(9, 9),
    });

    movementSystem({ store: world, dt: 1 });

    expect(world.get(noDestination, "position").toArray()).toEqual([1, 1]);
    expect(world.get(noSpeed, "position").toArray()).toEqual([1, 1]);
  });
});

describe("predictionSystems", () => {
  it("includes the movement system", () => {
    expect(predictionSystems).toContain(movementSystem);
  });
});
