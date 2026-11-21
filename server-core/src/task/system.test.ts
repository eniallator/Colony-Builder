import {
  createPlayer,
  createRobot,
  REGION_SIDE_LENGTH,
  regionIdsToWorldPos,
  regionPosToId,
  TASK_DURATION,
  TASK_RADIUS,
  tileToId,
  World,
  worldPosToRegionIds,
  type EntityId,
  type GatherStructure,
  type GatherTile,
  type RegionId,
  type StructureType,
  type Task,
  type Tile,
} from "@colony-builder/shared";
import { Vector } from "vectyped";
import { describe, expect, it, vi } from "vitest";

import type { State } from "../state.ts";
import type { ServerSystem } from "../system.ts";
import { taskSystem as serverTaskSystem } from "./system.ts";

// The task system never reads the server state, so tests only supply the world.
const taskSystem = ({
  world,
  dt,
  players = new Map(),
}: Omit<Parameters<ServerSystem>[0], "state"> & {
  players?: State["players"];
}) => {
  serverTaskSystem({ world, dt, state: { world, players } });
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

const gather = (progress = 0): GatherTile => ({
  type: "gatherTile",
  target: target.copy(),
  progress,
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

    it("gathers the tile once the duration has elapsed", () => {
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

    it("gathers nothing from a tile with no tile", () => {
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

  describe("gatherStructure", () => {
    // A structure on a world position, plus the task that gathers it.
    const structureOf = (world: World, type: StructureType) => {
      world.structures.addStructure(30, 40, { type, data: true });
      const [regionId, subRegionId] = worldPosToRegionIds(30, 40);
      return {
        regionId,
        subRegionId,
        position: Vector.create(...regionIdsToWorldPos(regionId, subRegionId)),
        task: (progress = 0): GatherStructure => ({
          type: "gatherStructure",
          regionId,
          subRegionId,
          progress,
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

    it("accumulates progress while in reach without gathering early", () => {
      const world = new World();
      const { position, task } = structureOf(world, "tree");
      const gathering = task();
      const id = createRobot(world, position.copy().add(0.5), [gathering]);

      taskSystem({ world, dt: 1 });

      expect(gathering.progress).toBe(1);
      expect(world.entities.get(id, "inventory").size).toBe(0);
      expect(world.entities.optGet(id, "destination")).toBeUndefined();
    });

    it("gathers logs from a tree once the duration has elapsed", () => {
      const world = new World();
      const { position, task } = structureOf(world, "tree");
      const id = createRobot(world, position.copy().add(0.5), [task()]);

      taskSystem({ world, dt: TASK_DURATION });

      expect(world.entities.get(id, "inventory")).toEqual(
        new Map([["log", { count: 5 }]])
      );
    });

    it("gathers cactus from a cactus once the duration has elapsed", () => {
      const world = new World();
      const { position, task } = structureOf(world, "cactus");
      const id = createRobot(world, position.copy().add(0.5), [task()]);

      taskSystem({ world, dt: TASK_DURATION });

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

      taskSystem({ world, dt: TASK_DURATION });

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

      taskSystem({ world, dt: TASK_DURATION / 2 });

      expect(
        world.structures.optGetStructure(regionId, subRegionId)
      ).toBeDefined();
    });

    describe("loaded regions", () => {
      const elsewhere = regionPosToId(9, 9);
      const playerState = (...regions: RegionId[]) => ({
        send: vi.fn(),
        loadedRegions: new Set(regions),
      });

      it("makes every player reload the region it was in, and only that one", () => {
        const world = new World();
        const { position, task, regionId } = structureOf(world, "tree");
        createRobot(world, position.copy().add(0.5), [task()]);
        const first = playerState(regionId, elsewhere);
        const second = playerState(regionId);
        const players: State["players"] = new Map([
          [createPlayer(world), first],
          [createPlayer(world), second],
        ]);

        taskSystem({ world, dt: TASK_DURATION, players });

        expect([...first.loadedRegions]).toEqual([elsewhere]);
        expect([...second.loadedRegions]).toEqual([]);
      });

      it("leaves them loaded until the structure has been gathered", () => {
        const world = new World();
        const { position, task, regionId } = structureOf(world, "tree");
        createRobot(world, position.copy().add(0.5), [task()]);
        const state = playerState(regionId);
        const players: State["players"] = new Map([
          [createPlayer(world), state],
        ]);

        taskSystem({ world, dt: TASK_DURATION / 2, players });

        expect([...state.loadedRegions]).toEqual([regionId]);
      });
    });

    it("resets its progress when the finished task is repeated", () => {
      const world = new World();
      const { position, task } = structureOf(world, "tree");
      const id = createRobot(world, position.copy().add(0.5), [task()]);
      const { tasks } = world.entities.get(id, "taskList");

      taskSystem({ world, dt: TASK_DURATION });

      expect(tasks).toEqual([task(0)]);
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

    it("ignores entities without a task list", () => {
      const world = new World();
      const id = createPlayer(world, nearTarget());

      taskSystem({ world, dt: 1 });

      expect(world.entities.optGet(id, "destination")).toBeUndefined();
    });
  });
});
