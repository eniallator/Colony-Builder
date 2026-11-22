import { Vector } from "vectyped";
import { describe, expect, it } from "vitest";

import {
  CONVEYOR_CENTER_SNAP_DISTANCE,
  CONVEYOR_SPEED,
  REGION_SIDE_LENGTH,
} from "../../constants.ts";
import { facingDirOf, type Facing } from "../../facing.ts";
import { World } from "../index.ts";
import { conveyorMovementSystem } from "./system.ts";

const FULL_REGION = REGION_SIDE_LENGTH ** 2;

const addBelt = (
  world: World,
  [x, y]: [number, number],
  facing: Facing,
  length = FULL_REGION
) => {
  world.structures.addStructureAt(x, y, {
    type: "conveyor",
    data: { facing, length },
  });
};

// A belt along y = 1.5 that covers the whole of the first region's width.
const worldWithBelt = (facing: Facing = "right") => {
  const world = new World();
  addBelt(world, [0.5, 1.5], facing);
  return world;
};

const spawnConveyable = (world: World, position = Vector.create(1.5, 1.5)) =>
  world.entities.spawn({ position, conveyable: true });

describe("conveyorMovementSystem", () => {
  it("moves a conveyable entity in the direction of the belt", () => {
    const world = worldWithBelt();
    const id = spawnConveyable(world);

    conveyorMovementSystem({ world, dt: 0.5 });

    expect(world.entities.get(id, "position").toArray()).toEqual([
      1.5 + 0.5 * CONVEYOR_SPEED,
      1.5,
    ]);
  });

  it.each<Facing>(["up", "down", "left", "right"])(
    "carries an entity %s along a belt facing that way",
    facing => {
      const starts: Record<Facing, [number, number]> = {
        right: [0.5, 8.5],
        left: [15.5, 8.5],
        down: [8.5, 0.5],
        up: [8.5, 15.5],
      };
      const [dx, dy] = facingDirOf[facing].toArray();
      const world = new World();
      addBelt(world, starts[facing], facing);
      const id = spawnConveyable(world, Vector.create(8.5, 8.5));

      conveyorMovementSystem({ world, dt: 0.5 });

      expect(world.entities.get(id, "position").toArray()).toEqual([
        8.5 + dx * 0.5 * CONVEYOR_SPEED,
        8.5 + dy * 0.5 * CONVEYOR_SPEED,
      ]);
    }
  );

  it("leaves an entity that is off the belt where it is", () => {
    const world = worldWithBelt();
    const id = spawnConveyable(world, Vector.create(1.5, 5.5));

    conveyorMovementSystem({ world, dt: 1 });

    expect(world.entities.get(id, "position").toArray()).toEqual([1.5, 5.5]);
  });

  it("leaves an entity past the end of the belt where it is", () => {
    const world = new World();
    addBelt(world, [0.5, 1.5], "right", 4 * REGION_SIDE_LENGTH);
    const id = spawnConveyable(world, Vector.create(4.5, 1.5));

    conveyorMovementSystem({ world, dt: 1 });

    expect(world.entities.get(id, "position").toArray()).toEqual([4.5, 1.5]);
  });

  it("leaves an entity in an unloaded world where it is", () => {
    const world = new World();
    const id = spawnConveyable(world);

    conveyorMovementSystem({ world, dt: 1 });

    expect(world.entities.get(id, "position").toArray()).toEqual([1.5, 1.5]);
  });

  it("keeps an entity on the belt's own centre line, wherever that is", () => {
    const world = new World();
    addBelt(world, [0.5, 3.25], "right");
    const id = spawnConveyable(world, Vector.create(1.5, 3.25));

    conveyorMovementSystem({ world, dt: 0.5 });

    expect(world.entities.get(id, "position").toArray()).toEqual([
      1.5 + 0.5 * CONVEYOR_SPEED,
      3.25,
    ]);
  });

  it("carries an entity from one belt segment into the next region's", () => {
    const world = new World();
    addBelt(world, [14.5, 1.5], "right", 2 * REGION_SIDE_LENGTH);
    addBelt(world, [16.5, 1.5], "right", 2 * REGION_SIDE_LENGTH);
    const id = spawnConveyable(world, Vector.create(15.5, 1.5));

    conveyorMovementSystem({ world, dt: 0.5 });
    conveyorMovementSystem({ world, dt: 0.5 });

    expect(world.entities.get(id, "position").x()).toBe(
      15.5 + 2 * 0.5 * CONVEYOR_SPEED
    );
  });

  it("snaps an entity within the threshold onto the centre line at full speed", () => {
    const world = worldWithBelt();
    const id = spawnConveyable(
      world,
      Vector.create(1.5, 1.5 + CONVEYOR_CENTER_SNAP_DISTANCE * 0.9)
    );

    conveyorMovementSystem({ world, dt: 0.5 });

    const [x, y] = world.entities.get(id, "position").toArray();
    expect(y).toBeCloseTo(1.5, 10);
    expect(x).toBeCloseTo(1.5 + 0.5 * CONVEYOR_SPEED, 10);
  });

  it("snaps from either side of the centre line", () => {
    const world = worldWithBelt();
    const id = spawnConveyable(
      world,
      Vector.create(1.5, 1.5 - CONVEYOR_CENTER_SNAP_DISTANCE * 0.9)
    );

    conveyorMovementSystem({ world, dt: 0.5 });

    expect(world.entities.get(id, "position").y()).toBeCloseTo(1.5, 10);
  });

  it("eases an entity beyond the threshold towards the centre line without snapping", () => {
    const world = worldWithBelt();
    const startY = 1.5 + CONVEYOR_CENTER_SNAP_DISTANCE * 3;
    const id = spawnConveyable(world, Vector.create(1.5, startY));

    conveyorMovementSystem({ world, dt: 0.05 });

    const y = world.entities.get(id, "position").y();
    expect(y).toBeLessThan(startY);
    expect(y).toBeGreaterThan(1.5);
  });

  it("brings an off-centre entity up to full belt speed", () => {
    const world = worldWithBelt();
    const id = spawnConveyable(world, Vector.create(1.5, 1.5 + 0.4));
    const dt = 0.05;

    // Run until it has had time to settle, then measure one more tick.
    for (let tick = 0; tick < 100; tick++)
      conveyorMovementSystem({ world, dt });
    const before = world.entities.get(id, "position").x();
    conveyorMovementSystem({ world, dt });

    const speed = (world.entities.get(id, "position").x() - before) / dt;
    expect(speed).toBeCloseTo(CONVEYOR_SPEED, 10);
  });

  it("never slows an entity as it turns onto a belt at a right angle", () => {
    const world = new World();
    // A belt going right, and one going down that it runs on to.
    addBelt(world, [2.5, 2.5], "right", 3 * REGION_SIDE_LENGTH);
    addBelt(world, [5.5, 2.5], "down", 3 * REGION_SIDE_LENGTH);
    const id = spawnConveyable(world, Vector.create(4.5, 2.5));
    const dt = 0.05;

    const speeds: number[] = [];
    for (let tick = 0; tick < 20; tick++) {
      const before = world.entities.get(id, "position").copy();
      conveyorMovementSystem({ world, dt });
      speeds.push(world.entities.get(id, "position").distTo(before) / dt);
    }

    // It did turn on to the second belt, and was never slower than a belt moves.
    expect(world.entities.get(id, "position").y()).toBeGreaterThan(2.5);
    for (const speed of speeds) {
      expect(speed).toBeGreaterThanOrEqual(CONVEYOR_SPEED - 1e-9);
    }
  });

  it("curves on to a belt along a circle half a tile in radius", () => {
    const world = new World();
    addBelt(world, [5.5, 2.5], "down", 3 * REGION_SIDE_LENGTH);
    // Half a tile off the belt's centre line, heading straight at it.
    const start = Vector.create(5, 2.5);
    const id = spawnConveyable(world, start.copy());
    // The centre of the circle, which meets the centre line side-on.
    const centre = start.copy().add(Vector.create(0, 0.5));

    let tracked = 0;
    for (let tick = 0; tick < 200; tick++) {
      conveyorMovementSystem({ world, dt: 0.005 });
      const position = world.entities.get(id, "position");
      // Close enough to the line, it snaps on to it.
      if (Math.abs(position.x() - 5.5) <= CONVEYOR_CENTER_SNAP_DISTANCE) break;

      expect(position.distTo(centre)).toBeCloseTo(0.5, 1);
      tracked++;
    }

    expect(tracked).toBeGreaterThan(10);
  });

  it("ignores entities that are not conveyable", () => {
    const world = worldWithBelt();
    const id = world.entities.spawn({ position: Vector.create(1.5, 1.5) });

    conveyorMovementSystem({ world, dt: 1 });

    expect(world.entities.get(id, "position").toArray()).toEqual([1.5, 1.5]);
  });
});
