import {
  addItemToInventory,
  dropInventory,
  TASK_DURATION,
  type DropInventory,
  type GatherResource,
  type Item,
  type ItemId,
  type Tile,
} from "@colony-builder/shared";

import type { ServerSystem } from "../system.ts";
import { destinationFor, isInRange } from "./helpers.ts";
import type { EntityParams, TaskRunner, TaskRunners } from "./types.ts";

const tileDrops: Partial<Record<Tile, { id: ItemId; item: Item }>> = {
  iron_deposit: { id: "iron_ore", item: { count: 5 } },
};

const gatherResourceTask: TaskRunner<GatherResource> = (
  entity,
  task,
  world,
  dt
) => {
  if (!isInRange(entity, task.target)) {
    if (world.entities.optGet(entity.id, "destination") == null) {
      world.entities.add(
        entity.id,
        "destination",
        destinationFor(entity, task.target)
      );
    }

    return { done: false };
  }

  task.progress += dt;

  const targetTile = world.terrain.optTileAt(task.target.x(), task.target.y());
  const gatheredItem = targetTile != null ? tileDrops[targetTile] : null;

  if (task.progress >= TASK_DURATION && gatheredItem != null) {
    addItemToInventory(entity.inventory, gatheredItem.id, gatheredItem.item);
    return { done: true, resetTask: { ...task, progress: 0 } };
  } else return { done: false };
};

const dropInventoryTask: TaskRunner<DropInventory> = (entity, task, world) => {
  if (!isInRange(entity, task.target)) {
    if (world.entities.optGet(entity.id, "destination") == null) {
      world.entities.add(
        entity.id,
        "destination",
        destinationFor(entity, task.target)
      );
    }

    return { done: false };
  }

  if (entity.inventory.size > 0) {
    dropInventory(entity.inventory, task.target, world);
  }
  return { done: true, resetTask: task };
};

const taskRunners: TaskRunners = {
  dropInventory: dropInventoryTask,
  gatherResource: gatherResourceTask,
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
    const result = taskRunners[first.type](entity, first as never, world, dt);

    if (result.done) {
      taskList.tasks.shift();
      if (taskList.repeat) taskList.tasks.push(result.resetTask);
    }
  }
};
