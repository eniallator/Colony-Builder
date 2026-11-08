import {
  addItemToInventory,
  dropInventory,
  TASK_DURATION,
  TASK_RADIUS,
  type EntityId,
  type Inventory,
  type Item,
  type ItemId,
  type Task,
  type Tile,
  type World,
} from "@colony-builder/shared";
import { checkExhausted } from "niall-utils/core";
import { Vector } from "vectyped";

import type { ServerSystem } from "../system.ts";

const tileDrops: Partial<Record<Tile, { id: ItemId; item: Item }>> = {
  iron_deposit: { id: "iron_ore", item: { count: 5 } },
};

interface EntityParams {
  id: EntityId;
  position: Vector<2>;
  inventory: Inventory;
}

const isTaskFinished = (
  entity: EntityParams,
  task: Task,
  world: World
): boolean => {
  switch (task.type) {
    case "gatherResource": {
      const targetTile = world.terrain.optTileAt(
        task.target.x(),
        task.target.y()
      );

      return (
        targetTile != null &&
        tileDrops[targetTile] != null &&
        task.progress >= TASK_DURATION
      );
    }

    case "dropInventory": {
      return entity.inventory.size === 0;
    }

    default:
      return checkExhausted(task);
  }
};

const DESTINATION_EPSILON = 1e-3;

const centreOf = (target: Vector<2>): Vector<2> =>
  Vector.fill(2, 0.5).add(target);

const isInRange = (entity: EntityParams, target: Vector<2>): boolean =>
  entity.position.sqrDistTo(centreOf(target)) <= TASK_RADIUS ** 2;

const destinationFor = (entity: EntityParams, target: Vector<2>): Vector<2> => {
  const centre = centreOf(target);

  return centre.lerp(
    (TASK_RADIUS - DESTINATION_EPSILON) / entity.position.distTo(centre),
    entity.position
  );
};

const resetTask = (task: Task): Task =>
  task.type === "gatherResource" ? { ...task, progress: 0 } : task;

const doTask = (
  entity: EntityParams,
  task: Task,
  world: World,
  dt: number
): void => {
  switch (task.type) {
    case "gatherResource": {
      if (world.entities.optGet(entity.id, "destination") != null) break;

      if (!isInRange(entity, task.target)) {
        world.entities.add(
          entity.id,
          "destination",
          destinationFor(entity, task.target)
        );
      } else {
        task.progress += dt;

        const targetTile = world.terrain.optTileAt(
          task.target.x(),
          task.target.y()
        );
        const gatheredItem = targetTile != null ? tileDrops[targetTile] : null;

        if (task.progress >= TASK_DURATION && gatheredItem != null) {
          addItemToInventory(
            entity.inventory,
            gatheredItem.id,
            gatheredItem.item
          );
        }
      }

      break;
    }

    case "dropInventory": {
      if (world.entities.optGet(entity.id, "destination") != null) break;

      if (!isInRange(entity, task.target)) {
        world.entities.add(
          entity.id,
          "destination",
          destinationFor(entity, task.target)
        );
      } else dropInventory(entity.inventory, task.target, world);

      break;
    }

    // Unreachable through taskSystem: isTaskFinished already rejects unknown tasks.
    /* v8 ignore next -- @preserve */
    default:
      return checkExhausted(task);
  }
};

export const taskSystem: ServerSystem = ({ world, dt }) => {
  for (const id of world.entities.query("taskList", "inventory", "position")) {
    const taskList = world.entities.get(id, "taskList");
    const entity: EntityParams = {
      id,
      position: world.entities.get(id, "position"),
      inventory: world.entities.get(id, "inventory"),
    };

    const first = taskList.tasks[0];
    if (first == null) continue;

    if (isTaskFinished(entity, first, world)) {
      taskList.tasks.shift();
      if (taskList.repeat) taskList.tasks.push(resetTask(first));
    } else {
      doTask(entity, first, world, dt);
    }
  }
};
