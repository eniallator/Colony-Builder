import { Vector } from "vectyped";
import { describe, expect, it } from "vitest";

import {
  REGION_SIDE_LENGTH,
  TASK_DURATION,
  TASK_RADIUS,
} from "../../../shared/src/constants.ts";
import { createPlayer } from "../../../shared/src/entity/player.ts";
import { createRobot } from "../../../shared/src/entity/robot.ts";
import type { EntityId } from "../../../shared/src/entity/types.ts";
import { World } from "../../../shared/src/stores/world.ts";
import type { GatherResource, Task } from "../../../shared/src/task/types.ts";
import { regionPosToId, type Tile } from "../../../shared/src/terrain/types.ts";
import type { ServerSystem } from "../system.ts";
import { taskSystem as serverTaskSystem } from "./system.ts";

// The task system never reads the server state, so tests only supply the world.
const taskSystem = ({
  world,
  dt,
}: Omit<Parameters<ServerSystem>[0], "state">) => {
  serverTaskSystem({ world, dt, state: { world, players: new Map() } });
};

const target = Vector.create(5.5, 5.5);

const worldWithTile = (tile: Tile) => {
  const world = new World();
  world.terrain.add(
    regionPosToId(0, 0),
    Array.from({ length: REGION_SIDE_LENGTH ** 2 }, () => tile)
  );
  return world;
};

const stopRepeating = (world: World, id: EntityId): void => {
  world.entities.add(id, "taskList", {
    ...world.entities.get(id, "taskList"),
    repeat: false,
  });
};

const gather = (progress = 0): GatherResource => ({
  type: "gatherResource",
  target: target.copy(),
  progress,
});

const drop: Task = { type: "dropInventory", target: target.copy() };

// Tasks act on the centre of their target tile.
const centre = () => target.copy().add(0.5);
const nearTarget = centre;

describe("taskSystem", () => {
  describe("gatherResource", () => {
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

      expect(task.progress).toBe(1);
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

    it("accumulates progress while in reach without gathering early", () => {
      const world = worldWithTile("iron_deposit");
      const task = gather();
      const id = createRobot(world, nearTarget(), [task]);

      taskSystem({ world, dt: 1 });

      expect(task.progress).toBe(1);
      expect(world.entities.get(id, "inventory").size).toBe(0);
      expect(world.entities.optGet(id, "destination")).toBeUndefined();
    });

    it("gathers the resource once the duration has elapsed", () => {
      const world = worldWithTile("iron_deposit");
      const id = createRobot(world, nearTarget(), [gather()]);

      taskSystem({ world, dt: TASK_DURATION });

      expect(world.entities.get(id, "inventory")).toEqual(
        new Map([["iron_ore", { count: 5 }]])
      );
    });

    it("finishes the task after gathering without gathering twice", () => {
      const world = worldWithTile("iron_deposit");
      const id = createRobot(world, nearTarget(), [gather()]);
      stopRepeating(world, id);

      taskSystem({ world, dt: TASK_DURATION });
      taskSystem({ world, dt: 1 });

      expect(world.entities.get(id, "taskList").tasks).toHaveLength(0);
      expect(world.entities.get(id, "inventory").get("iron_ore")?.count).toBe(
        5
      );
    });

    it("gathers nothing from a tile with no resource", () => {
      const world = worldWithTile("conveyor_right");
      const id = createRobot(world, nearTarget(), [gather()]);

      taskSystem({ world, dt: TASK_DURATION * 2 });

      expect(world.entities.get(id, "inventory").size).toBe(0);
      expect(world.entities.get(id, "taskList").tasks).toHaveLength(1);
    });

    it("does not finish while the target terrain is unloaded", () => {
      const world = new World();
      const id = createRobot(world, nearTarget(), [gather(TASK_DURATION)]);

      taskSystem({ world, dt: 1 });

      expect(world.entities.get(id, "taskList").tasks).toHaveLength(1);
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
        "gatherResource",
        "dropInventory",
      ]);
    });

    it("keeps a task at the front until it is finished", () => {
      const world = new World();
      const id = createRobot(world, Vector.zero(2), [drop, gather()]);

      taskSystem({ world, dt: 1 });

      expect(
        world.entities.get(id, "taskList").tasks.map(({ type }) => type)
      ).toEqual(["dropInventory", "gatherResource"]);
    });

    it("resets gather progress when a finished task is repeated", () => {
      const world = worldWithTile("iron_deposit");
      const id = createRobot(world, nearTarget(), [gather()]);
      const { tasks } = world.entities.get(id, "taskList");

      taskSystem({ world, dt: TASK_DURATION });

      expect(tasks).toEqual([gather(0)]);
    });

    it("gathers again on every lap of a repeating list", () => {
      const world = worldWithTile("iron_deposit");
      const id = createRobot(world, nearTarget(), [gather(), drop]);
      const inventory = world.entities.get(id, "inventory");

      for (let lap = 0; lap < 2; lap++) {
        taskSystem({ world, dt: TASK_DURATION }); // gather
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
      ).toEqual(["gatherResource"]);
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

    it("ignores entities without a task list", () => {
      const world = new World();
      const id = createPlayer(world, nearTarget());

      taskSystem({ world, dt: 1 });

      expect(world.entities.optGet(id, "destination")).toBeUndefined();
    });
  });
});
