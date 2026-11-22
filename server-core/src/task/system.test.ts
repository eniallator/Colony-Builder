import {
  createPlayer,
  createRobot,
  REGION_SIDE_LENGTH,
  regionIdsToWorldPos,
  regionPosToId,
  TASK_DURATION,
  TASK_RADIUS,
  tiles,
  tileToId,
  World,
  worldPosToRegionIds,
  type EntityId,
  type GatherStructure,
  type GatherTile,
  type StructureType,
  type Task,
  type Tile,
  type Time,
} from "@colony-builder/shared";
import { Vector } from "vectyped";
import { describe, expect, it } from "vitest";

import { taskSystem as serverTaskSystem } from "./system.ts";

// Only ever moves forwards, and tasks are relative to it, so tests share it.
const time: Time = { start: 0, lastFrame: 0, now: 0, delta: 0 };

// The task system never reads the server state, so tests only supply the world.
// Like the game, it moves the clock on by `dt` before running.
const taskSystem = ({ world, dt }: { world: World; dt: number }) => {
  time.lastFrame = time.now;
  time.now += dt;
  time.delta = dt;
  serverTaskSystem({
    world,
    dt,
    time,
    state: { world, time, players: new Map() },
  });
};

// A gather task starts its timer on the first tick in reach, then finishes
// once the duration has elapsed.
const runGather = (world: World) => {
  taskSystem({ world, dt: 0 });
  taskSystem({ world, dt: TASK_DURATION });
};

const target = Vector.create(5.5, 5.5);

const worldWithTile = (tile: Tile) => {
  const world = new World();
  world.terrain.add(
    regionPosToId(0, 0),
    Array.from({ length: REGION_SIDE_LENGTH ** 2 }, () => tileToId(tile))
  );
  return world;
};

const stopRepeating = (world: World, id: EntityId): void => {
  world.entities.add(id, "taskList", {
    ...world.entities.get(id, "taskList"),
    repeat: false,
  });
};

const gather = (endsAt?: number): GatherTile => ({
  type: "gatherTile",
  target: target.copy(),
  endsAt,
});

const drop: Task = { type: "dropInventory", target: target.copy() };

// Tasks act on the centre of their target tile.
const centre = () => target.copy().add(0.5);
const nearTarget = centre;

describe("taskSystem", () => {
  describe("gatherTile", () => {
    it("sends the entity to within reach of the target", () => {
      const world = worldWithTile("iron_deposit");
      const id = createRobot(world, Vector.zero(2), [gather()]);

      taskSystem({ world, dt: 1 });

      const destination = world.entities.get(id, "destination");
      expect(destination.distTo(centre())).toBeCloseTo(TASK_RADIUS, 2);
      expect(destination.distTo(centre())).toBeLessThan(TASK_RADIUS);
    });

    it("starts gathering once it arrives at the destination it was sent to", () => {
      const world = worldWithTile("iron_deposit");
      const task = gather();
      const id = createRobot(world, Vector.zero(2), [task]);

      taskSystem({ world, dt: 1 });
      world.entities.add(id, "position", world.entities.get(id, "destination"));
      world.entities.delete(id, "destination");
      taskSystem({ world, dt: 1 });

      expect(task.endsAt).toBe(time.now + TASK_DURATION);
      expect(world.entities.optGet(id, "destination")).toBeUndefined();
    });

    it("does not set a new destination while one is pending", () => {
      const world = worldWithTile("iron_deposit");
      const id = createRobot(world, Vector.zero(2), [gather()]);
      const pending = Vector.create(1, 1);
      world.entities.add(id, "destination", pending);

      taskSystem({ world, dt: 1 });

      expect(world.entities.get(id, "destination")).toBe(pending);
    });

    it("starts the timer in reach without gathering early", () => {
      const world = worldWithTile("iron_deposit");
      const task = gather();
      const id = createRobot(world, nearTarget(), [task]);

      taskSystem({ world, dt: 1 });

      expect(task.endsAt).toBe(time.now + TASK_DURATION);
      expect(world.entities.get(id, "inventory").size).toBe(0);
      expect(world.entities.optGet(id, "destination")).toBeUndefined();
    });

    it("does not gather before the timer has run out", () => {
      const world = worldWithTile("iron_deposit");
      const id = createRobot(world, nearTarget(), [gather()]);

      taskSystem({ world, dt: 0 });
      taskSystem({ world, dt: TASK_DURATION / 2 });

      expect(world.entities.get(id, "inventory").size).toBe(0);
    });

    it("gathers the tile once the duration has elapsed", () => {
      const world = worldWithTile("iron_deposit");
      const id = createRobot(world, nearTarget(), [gather()]);

      runGather(world);

      expect(world.entities.get(id, "inventory")).toEqual(
        new Map([["iron_ore", { count: 5 }]])
      );
    });

    it("restarts the timer when the entity leaves reach", () => {
      const world = worldWithTile("iron_deposit");
      const task = gather();
      const id = createRobot(world, nearTarget(), [task]);
      taskSystem({ world, dt: 1 });

      world.entities.add(id, "position", Vector.zero(2));
      taskSystem({ world, dt: 1 });

      expect(task.endsAt).toBeUndefined();
    });

    it("finishes the task after gathering without gathering twice", () => {
      const world = worldWithTile("iron_deposit");
      const id = createRobot(world, nearTarget(), [gather()]);
      stopRepeating(world, id);

      runGather(world);
      taskSystem({ world, dt: 1 });

      expect(world.entities.get(id, "taskList").tasks).toHaveLength(0);
      expect(world.entities.get(id, "inventory").get("iron_ore")?.count).toBe(
        5
      );
    });

    it("gathers nothing from a tile with no tile", () => {
      const world = worldWithTile(tiles[0]);
      const id = createRobot(world, nearTarget(), [gather()]);

      runGather(world);

      expect(world.entities.get(id, "inventory").size).toBe(0);
      expect(world.entities.get(id, "taskList").tasks).toHaveLength(1);
    });

    it("does not finish while the target terrain is unloaded", () => {
      const world = new World();
      const id = createRobot(world, nearTarget(), [gather(time.now)]);

      taskSystem({ world, dt: 1 });

      expect(world.entities.get(id, "taskList").tasks).toHaveLength(1);
    });
  });

  describe("gatherStructure", () => {
    // A structure on a world position, plus the task that gathers it.
    const structureOf = (
      world: World,
      type: Exclude<StructureType, "conveyor">
    ) => {
      world.structures.addStructureAt(30, 40, { type, data: true });
      const [regionId, subRegionId] = worldPosToRegionIds(30, 40);
      return {
        regionId,
        subRegionId,
        position: Vector.create(...regionIdsToWorldPos(regionId, subRegionId)),
        task: (endsAt?: number): GatherStructure => ({
          type: "gatherStructure",
          regionId,
          subRegionId,
          endsAt,
        }),
      };
    };

    it("sends the entity to within reach of the structure", () => {
      const world = new World();
      const { position, task } = structureOf(world, "tree");
      const id = createRobot(world, Vector.zero(2), [task()]);

      taskSystem({ world, dt: 1 });

      const destination = world.entities.get(id, "destination");
      expect(destination.distTo(position.copy().add(0.5))).toBeLessThan(
        TASK_RADIUS
      );
    });

    it("does not set a new destination while one is pending", () => {
      const world = new World();
      const { task } = structureOf(world, "tree");
      const id = createRobot(world, Vector.zero(2), [task()]);
      const pending = Vector.create(1, 1);
      world.entities.add(id, "destination", pending);

      taskSystem({ world, dt: 1 });

      expect(world.entities.get(id, "destination")).toBe(pending);
    });

    it("starts the timer in reach without gathering early", () => {
      const world = new World();
      const { position, task } = structureOf(world, "tree");
      const gathering = task();
      const id = createRobot(world, position.copy().add(0.5), [gathering]);

      taskSystem({ world, dt: 1 });

      expect(gathering.endsAt).toBe(time.now + TASK_DURATION);
      expect(world.entities.get(id, "inventory").size).toBe(0);
      expect(world.entities.optGet(id, "destination")).toBeUndefined();
    });

    it("gathers logs from a tree once the duration has elapsed", () => {
      const world = new World();
      const { position, task } = structureOf(world, "tree");
      const id = createRobot(world, position.copy().add(0.5), [task()]);

      runGather(world);

      expect(world.entities.get(id, "inventory")).toEqual(
        new Map([["log", { count: 5 }]])
      );
    });

    it("gathers cactus from a cactus once the duration has elapsed", () => {
      const world = new World();
      const { position, task } = structureOf(world, "cactus");
      const id = createRobot(world, position.copy().add(0.5), [task()]);

      runGather(world);

      expect(world.entities.get(id, "inventory")).toEqual(
        new Map([["cactus", { count: 5 }]])
      );
    });

    it("removes the structure once it has been gathered", () => {
      const world = new World();
      const { position, task, regionId, subRegionId } = structureOf(
        world,
        "tree"
      );
      createRobot(world, position.copy().add(0.5), [task()]);

      runGather(world);

      expect(
        world.structures.optGetStructure(regionId, subRegionId)
      ).toBeUndefined();
    });

    it("keeps the structure until it has been gathered", () => {
      const world = new World();
      const { position, task, regionId, subRegionId } = structureOf(
        world,
        "tree"
      );
      createRobot(world, position.copy().add(0.5), [task()]);

      taskSystem({ world, dt: 0 });
      taskSystem({ world, dt: TASK_DURATION / 2 });

      expect(
        world.structures.optGetStructure(regionId, subRegionId)
      ).toBeDefined();
    });

    describe("changed regions", () => {
      it("marks the region it was in dirty once gathered, and only that one", () => {
        const world = new World();
        const { position, task, regionId } = structureOf(world, "tree");
        world.structures.addStructureAt(30 + REGION_SIDE_LENGTH, 40, {
          type: "cactus",
          data: true,
        });
        createRobot(world, position.copy().add(0.5), [task()]);
        world.flushAllDirtyRegions();

        runGather(world);

        expect(world.flushAllDirtyRegions()).toEqual([regionId]);
      });

      it("leaves the region clean until the structure has been gathered", () => {
        const world = new World();
        const { position, task } = structureOf(world, "tree");
        createRobot(world, position.copy().add(0.5), [task()]);
        world.flushAllDirtyRegions();

        taskSystem({ world, dt: TASK_DURATION / 2 });

        expect(world.flushAllDirtyRegions()).toEqual([]);
      });

      it("leaves a region clean when its structure is already gone", () => {
        const world = new World();
        const { position, task, regionId, subRegionId } = structureOf(
          world,
          "tree"
        );
        createRobot(world, position.copy().add(0.5), [task()]);
        world.structures.deleteStructure(regionId, subRegionId);
        world.flushAllDirtyRegions();

        taskSystem({ world, dt: TASK_DURATION });

        expect(world.flushAllDirtyRegions()).toEqual([]);
      });
    });

    it("clears its end time when the finished task is repeated", () => {
      const world = new World();
      const { position, task } = structureOf(world, "tree");
      const id = createRobot(world, position.copy().add(0.5), [task()]);
      const { tasks } = world.entities.get(id, "taskList");

      runGather(world);

      expect(tasks).toEqual([task()]);
    });

    it("drops the task for good when the structure no longer exists", () => {
      const world = new World();
      const { task } = structureOf(new World(), "tree");
      const id = createRobot(world, Vector.zero(2), [task()]);

      taskSystem({ world, dt: 1 });

      expect(world.entities.get(id, "taskList").tasks).toEqual([]);
      expect(world.entities.optGet(id, "destination")).toBeUndefined();
    });
  });

  describe("dropInventory", () => {
    const robotHolding = (world: World, position: Vector<2>) => {
      const id = createRobot(world, position, [drop]);
      world.entities.get(id, "inventory").set("log", { count: 2 });
      return id;
    };

    it("sends the entity to within reach of the drop target", () => {
      const world = new World();
      const id = robotHolding(world, Vector.zero(2));

      taskSystem({ world, dt: 1 });

      expect(
        world.entities.get(id, "destination").distTo(centre())
      ).toBeLessThan(TASK_RADIUS);
      expect(world.entities.get(id, "inventory").size).toBe(1);
    });

    it("does not set a new destination while one is pending", () => {
      const world = new World();
      const id = robotHolding(world, Vector.zero(2));
      const pending = Vector.create(1, 1);
      world.entities.add(id, "destination", pending);

      taskSystem({ world, dt: 1 });

      expect(world.entities.get(id, "destination")).toBe(pending);
    });

    it("drops everything as pickable items once in reach", () => {
      const world = new World();
      const id = robotHolding(world, nearTarget());

      taskSystem({ world, dt: 1 });

      expect(world.entities.get(id, "inventory").size).toBe(0);
      const dropped = world.entities.query("canPickup");
      expect(dropped).toHaveLength(1);
      const [item] = dropped;
      expect(world.entities.get(item ?? id, "inventory")).toEqual(
        new Map([["log", { count: 2 }]])
      );
    });

    it("is finished once it has dropped everything", () => {
      const world = new World();
      const id = robotHolding(world, nearTarget());
      stopRepeating(world, id);

      taskSystem({ world, dt: 1 });

      expect(world.entities.get(id, "taskList").tasks).toHaveLength(0);
    });

    it("is not finished while still travelling to the drop target", () => {
      const world = new World();
      const id = robotHolding(world, Vector.zero(2));
      stopRepeating(world, id);

      taskSystem({ world, dt: 1 });

      expect(world.entities.get(id, "taskList").tasks).toHaveLength(1);
    });
  });

  describe("task list", () => {
    it("moves a finished task to the back when repeating", () => {
      const world = new World();
      const id = createRobot(world, nearTarget(), [drop, gather()]);
      const { tasks } = world.entities.get(id, "taskList");

      taskSystem({ world, dt: 1 });

      expect(tasks.map(({ type }) => type)).toEqual([
        "gatherTile",
        "dropInventory",
      ]);
    });

    it("keeps a task at the front until it is finished", () => {
      const world = new World();
      const id = createRobot(world, Vector.zero(2), [drop, gather()]);

      taskSystem({ world, dt: 1 });

      expect(
        world.entities.get(id, "taskList").tasks.map(({ type }) => type)
      ).toEqual(["dropInventory", "gatherTile"]);
    });

    it("clears the gather end time when a finished task is repeated", () => {
      const world = worldWithTile("iron_deposit");
      const id = createRobot(world, nearTarget(), [gather()]);
      const { tasks } = world.entities.get(id, "taskList");

      runGather(world);

      expect(tasks).toEqual([gather()]);
    });

    it("gathers again on every lap of a repeating list", () => {
      const world = worldWithTile("iron_deposit");
      const id = createRobot(world, nearTarget(), [gather(), drop]);
      const inventory = world.entities.get(id, "inventory");

      for (let lap = 0; lap < 2; lap++) {
        runGather(world); // gather
        taskSystem({ world, dt: 1 }); // drop
      }

      expect(inventory.size).toBe(0);
      const dropped = world.entities
        .query("canPickup", "inventory")
        .map(item => world.entities.get(item, "inventory").get("iron_ore"));
      expect(dropped).toEqual([{ count: 5 }, { count: 5 }]);
    });

    it("discards a finished task when not repeating", () => {
      const world = new World();
      const id = createRobot(world, nearTarget(), [drop, gather()]);
      stopRepeating(world, id);

      taskSystem({ world, dt: 1 });

      expect(
        world.entities.get(id, "taskList").tasks.map(({ type }) => type)
      ).toEqual(["gatherTile"]);
    });

    it("does nothing for an empty task list", () => {
      const world = new World();
      const id = createRobot(world);

      taskSystem({ world, dt: 1 });

      expect(world.entities.optGet(id, "destination")).toBeUndefined();
      expect(world.entities.get(id, "taskList").tasks).toEqual([]);
    });

    it("throws on a task it does not know", () => {
      const world = new World();
      const id = createRobot(world);
      world.entities.add(id, "taskList", {
        tasks: [{ type: "unknown" } as never],
        repeat: true,
      });

      expect(() => {
        taskSystem({ world, dt: 1 });
      }).toThrow(TypeError);
    });

    describe("changed entities", () => {
      const robotInReach = () => {
        const world = worldWithTile("iron_deposit");
        const id = createRobot(world, nearTarget(), [gather()]);
        world.entities.flushDirtyEntities();
        return { world, id };
      };

      it("marks the entity dirty when its timer starts", () => {
        const { world, id } = robotInReach();

        taskSystem({ world, dt: 1 });

        expect(world.entities.flushDirtyEntities()).toEqual([id]);
      });

      it("leaves the entity clean while its timer runs", () => {
        const { world } = robotInReach();
        taskSystem({ world, dt: 0 });
        world.entities.flushDirtyEntities();

        taskSystem({ world, dt: TASK_DURATION / 2 });

        expect(world.entities.flushDirtyEntities()).toEqual([]);
      });

      it("marks the entity dirty when the task finishes", () => {
        const { world, id } = robotInReach();
        taskSystem({ world, dt: 0 });
        world.entities.flushDirtyEntities();

        taskSystem({ world, dt: TASK_DURATION });

        expect(world.entities.flushDirtyEntities()).toEqual([id]);
      });

      it("marks the entity dirty when its timer is dropped", () => {
        const { world, id } = robotInReach();
        taskSystem({ world, dt: 0 });
        world.entities.add(id, "position", Vector.zero(2));
        world.entities.flushDirtyEntities();

        taskSystem({ world, dt: 1 });

        expect(world.entities.flushDirtyEntities()).toContain(id);
      });

      it("leaves an entity with no tasks clean", () => {
        const world = new World();
        createRobot(world);
        world.entities.flushDirtyEntities();

        taskSystem({ world, dt: 1 });

        expect(world.entities.flushDirtyEntities()).toEqual([]);
      });
    });

    it("ignores entities without a task list", () => {
      const world = new World();
      const id = createPlayer(world, nearTarget());

      taskSystem({ world, dt: 1 });

      expect(world.entities.optGet(id, "destination")).toBeUndefined();
    });
  });
});
