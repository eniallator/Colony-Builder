import { selfMovementSystem } from "./entity/index.ts";
import type { System } from "./system/index.ts";
import { taskSystem } from "./task/index.ts";
import { conveyorMovementSystem } from "./terrain/index.ts";

export const reindexEntities: System = ({ world }) => {
  world.indexEntities();
};

export const predictionSystems: System[] = [
  reindexEntities,
  taskSystem,
  selfMovementSystem,
  conveyorMovementSystem,
];
