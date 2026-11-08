import { selfMovementSystem } from "./entity/index.ts";
import type { System } from "./system/index.ts";
import { conveyorMovementSystem } from "./terrain/index.ts";

export const reindexEntities: System = ({ world }) => {
  world.indexEntities();
};

export const predictionSystems = (
  // oxlint-disable-next-line typescript/no-explicit-any
  ...preMoveSystems: System<any>[]
): System[] => [
  reindexEntities,
  ...preMoveSystems,
  selfMovementSystem,
  conveyorMovementSystem,
];
