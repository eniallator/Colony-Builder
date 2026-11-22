import {
  addItemToInventory,
  dropInventory,
  regionIdsToWorldPos,
  TASK_DURATION,
  type DropInventory,
  type GatherStructure,
  type GatherTile,
  type Item,
  type ItemId,
  type StructureType,
  type Tile,
} from "@colony-builder/shared";
import { Vector } from "vectyped";

import type { ServerSystem } from "../system.ts";
import { destinationFor, isInRange } from "./helpers.ts";
import type { EntityParams, TaskRunner, TaskRunners } from "./types.ts";

const tileDrops: Partial<Record<Tile, { id: ItemId; item: Item }>> = {
  iron_deposit: { id: "iron_ore", item: { count: 5 } },
  copper_deposit: { id: "copper_ore", item: { count: 5 } },
};

const structureDrops: Partial<
  Record<StructureType, { id: ItemId; item: Item }>
> = {
  tree: { id: "log", item: { count: 5 } },
  cactus: { id: "cactus", item: { count: 5 } },
};

const tickTimer = (
  task: { endsAt: number | undefined },
  inRange: boolean,
  now: number
): { done: boolean; changed: boolean } => {
  if (!inRange) {
    const changed = task.endsAt != null;
    task.endsAt = undefined;
    return { done: false, changed };
  }

  if (task.endsAt == null) {
    task.endsAt = now + TASK_DURATION;
    return { done: false, changed: true };
  }

  return { done: now >= task.endsAt, changed: false };
};

const gatherTileTask: TaskRunner<GatherTile> = ctx => {
  const { entity, task, world, time } = ctx;
  const inRange = isInRange(entity, task.target);
  if (!inRange && world.entities.optGet(entity.id, "destination") == null) {
    world.entities.add(
      entity.id,
      "destination",
      destinationFor(entity, task.target)
    );
  }

  const { done, changed } = tickTimer(task, inRange, time.now);

  const targetTile = world.terrain.optTileAt(task.target.x(), task.target.y());
  const gatheredItem = targetTile != null ? tileDrops[targetTile] : null;

  if (done && gatheredItem != null) {
    addItemToInventory(entity.inventory, gatheredItem.id, gatheredItem.item);
    return { done: true, cleanTask: { ...task, endsAt: undefined } };
  } else return { done: false, changed };
};

const gatherStructureTask: TaskRunner<GatherStructure> = ctx => {
  const { entity, task, world, time } = ctx;
  const structure = world.structures.optGetStructure(
    task.regionId,
    task.subRegionId
  );
  if (structure == null) return { done: true, cleanTask: null };

  const worldPos = Vector.create(
    ...regionIdsToWorldPos(task.regionId, task.subRegionId)
  );
  const inRange = isInRange(entity, worldPos);
  if (!inRange && world.entities.optGet(entity.id, "destination") == null) {
    world.entities.add(
      entity.id,
      "destination",
      destinationFor(entity, worldPos)
    );
  }

  const { done, changed } = tickTimer(task, inRange, time.now);

  const gatheredItem = structureDrops[structure.type];
  if (done && gatheredItem != null) {
    addItemToInventory(entity.inventory, gatheredItem.id, gatheredItem.item);
    world.structures.deleteStructure(task.regionId, task.subRegionId);
    return { done: true, cleanTask: { ...task, endsAt: undefined } };
  } else return { done: false, changed };
};

const dropInventoryTask: TaskRunner<DropInventory> = ctx => {
  const { entity, task, world } = ctx;
  if (!isInRange(entity, task.target)) {
    if (world.entities.optGet(entity.id, "destination") == null) {
      world.entities.add(
        entity.id,
        "destination",
        destinationFor(entity, task.target)
      );
    }

    return { done: false, changed: false };
  }

  if (entity.inventory.size > 0) {
    dropInventory(entity.inventory, task.target, world);
  }
  return { done: true, cleanTask: task };
};

const taskRunners: TaskRunners = {
  gatherTile: gatherTileTask,
  gatherStructure: gatherStructureTask,
  dropInventory: dropInventoryTask,
};

export const taskSystem: ServerSystem = ({ world, time }) => {
  for (const id of world.entities.query("taskList", "inventory", "position")) {
    const taskList = world.entities.get(id, "taskList");
    const entity: EntityParams = {
      id,
      position: world.entities.get(id, "position"),
      inventory: world.entities.get(id, "inventory"),
    };

    const first = taskList.tasks[0];
    if (first == null) continue;
    const result = taskRunners[first.type]({
      entity,
      task: first as never,
      world,
      time,
    });

    // Components are only tracked as changed when re-added
    if (result.done) {
      taskList.tasks.shift();
      if (taskList.repeat && result.cleanTask) {
        taskList.tasks.push(result.cleanTask);
      }
      world.entities.add(id, "taskList", taskList);
      world.entities.add(id, "inventory", entity.inventory);
    } else if (result.changed) {
      world.entities.add(id, "taskList", taskList);
    }
  }
};
