import {
  LOADED_SIDE_LENGTH,
  regionPosToId,
  regionsAround,
  worldToRegionPos,
  type EntityId,
} from "@colony-builder/shared";

import type { State } from "./state.ts";
import type { ServerSystem } from "./system.ts";

export const indexEntities: ServerSystem = ({ world, state }) => {
  state.entityRegions = Map.groupBy(world.entities.query("position"), id =>
    regionPosToId(
      ...worldToRegionPos(...world.entities.get(id, "position").toArray())
    )
  );
};

export const entitiesAround = (
  state: State,
  worldX: number,
  worldY: number
): EntityId[] =>
  regionsAround(
    ...worldToRegionPos(worldX, worldY),
    LOADED_SIDE_LENGTH
  ).flatMap(id => state.entityRegions.get(id) ?? []);
