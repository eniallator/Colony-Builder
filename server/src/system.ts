import { predictionSystems, type System } from "@colony-builder/shared";

import { indexEntities } from "./spatial.ts";
import type { State } from "./state.ts";

export type ServerSystem = System<{ state: State }>;

export const serverSystems: ServerSystem[] = [
  indexEntities,
  ...predictionSystems,
];
