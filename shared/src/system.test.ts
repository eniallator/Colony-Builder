import { Vector } from "vectyped";
import { describe, expect, it } from "vitest";

import { REGION_SIDE_LENGTH } from "./constants.ts";
import { World } from "./stores/world.ts";
import {
  conveyorMovementSystem,
  predictionSystems,
  selfMovementSystem,
} from "./system.ts";
import { regionPosToId, tiles, type Tile } from "./terrain/index.ts";

const spawnMover = (
  world: World,
  position: [number, number],
  destination: [number, number],
  speed: number
) =>
  world.entities.spawn({
    position: Vector.create(...position),
    destination: Vector.create(...destination),
    speed,
  });

describe("movementSystem", () => {
  it("moves towards the destination by speed * dt", () => {
    const world = new World();
    const id = spawnMover(world, [0, 0], [10, 0], 2);

    selfMovementSystem({ world, dt: 1.5 });

    expect(world.entities.get(id, "position").toArray()).toEqual([3, 0]);
    expect(world.entities.optGet(id, "destination")).toBeDefined();
  });

  it("moves along a diagonal at the same speed", () => {
    const world = new World();
    const id = spawnMover(world, [0, 0], [30, 40], 5);

    selfMovementSystem({ world, dt: 1 });

    expect(world.entities.get(id, "position").toArray()).toEqual([3, 4]);
  });

  it("snaps to the destination and clears it when within reach", () => {
    const world = new World();
    const id = spawnMover(world, [0, 0], [1, 0], 2);

    selfMovementSystem({ world, dt: 1 });

    expect(world.entities.get(id, "position").toArray()).toEqual([1, 0]);
    expect(world.entities.optGet(id, "destination")).toBeUndefined();
  });

  it("arrives when exactly in reach", () => {
    const world = new World();
    const id = spawnMover(world, [0, 0], [2, 0], 2);

    selfMovementSystem({ world, dt: 1 });

    expect(world.entities.get(id, "position").toArray()).toEqual([2, 0]);
    expect(world.entities.optGet(id, "destination")).toBeUndefined();
  });

  it("does not move an entity that has arrived", () => {
    const world = new World();
    const id = spawnMover(world, [0, 0], [10, 0], 2);

    selfMovementSystem({ world, dt: 10 });
    selfMovementSystem({ world, dt: 10 });

    expect(world.entities.get(id, "position").toArray()).toEqual([10, 0]);
  });

  it("ignores entities without a destination or speed", () => {
    const world = new World();
    const noDestination = world.entities.spawn({
      position: Vector.create(1, 1),
      speed: 5,
    });
    const noSpeed = world.entities.spawn({
      position: Vector.create(1, 1),
      destination: Vector.create(9, 9),
    });

    selfMovementSystem({ world, dt: 1 });

    expect(world.entities.get(noDestination, "position").toArray()).toEqual([
      1, 1,
    ]);
    expect(world.entities.get(noSpeed, "position").toArray()).toEqual([1, 1]);
  });
});

describe("conveyorMovementSystem", () => {
  const worldWithTile = (tile: Tile) => {
    const world = new World();
    world.terrain.add(regionPosToId(0, 0), {
      tiles: Array.from({ length: REGION_SIDE_LENGTH ** 2 }, () => tile),
    });
    return world;
  };

  const spawnConveyable = (world: World) =>
    world.entities.spawn({
      position: Vector.create(1.5, 1.5),
      conveyable: true,
    });

  it("moves a conveyable entity in the direction of the conveyor", () => {
    const world = worldWithTile("conveyor_right");
    const id = spawnConveyable(world);

    conveyorMovementSystem({ world, dt: 0.5 });

    expect(world.entities.get(id, "position").toArray()).toEqual([2, 1.5]);
  });

  it("leaves an entity on a non-conveyor tile where it is", () => {
    const world = worldWithTile(tiles[0]);
    const id = spawnConveyable(world);

    conveyorMovementSystem({ world, dt: 1 });

    expect(world.entities.get(id, "position").toArray()).toEqual([1.5, 1.5]);
  });

  it("leaves an entity on unloaded terrain where it is", () => {
    const world = new World();
    const id = spawnConveyable(world);

    conveyorMovementSystem({ world, dt: 1 });

    expect(world.entities.get(id, "position").toArray()).toEqual([1.5, 1.5]);
  });

  it("ignores entities that are not conveyable", () => {
    const world = worldWithTile("conveyor_right");
    const id = world.entities.spawn({ position: Vector.create(1.5, 1.5) });

    conveyorMovementSystem({ world, dt: 1 });

    expect(world.entities.get(id, "position").toArray()).toEqual([1.5, 1.5]);
  });
});

describe("predictionSystems", () => {
  it("includes the movement system", () => {
    expect(predictionSystems).toContain(selfMovementSystem);
  });
});
