import {
  LOADED_SIDE_LENGTH,
  type EntityId,
  type WorldGenerator,
} from "@colony-builder/shared";

import type { State } from "./state.ts";

export const streamToPlayers = (
  { world, players }: State,
  worldGenerator: WorldGenerator,
  dirtyEntities: ReadonlySet<EntityId>
): void => {
  for (const [id, player] of players) {
    const position = world.entities.get(id, "position");

    const unsent = new Set(
      world.loadWorld(position.x(), position.y(), worldGenerator)
    ).difference(player.loadedRegions);

    if (unsent.size > 0) {
      player.send({
        type: "load",
        snapshot: world.takeSnapshot([...unsent]),
      });
      player.loadedRegions = player.loadedRegions.union(unsent);
    }

    // Entities the client has that changed since it was sent them
    const changed = player.loadedEntities.intersection(dirtyEntities);
    const despawned = new Set(
      changed
        .values()
        .filter(id => world.entities.optGet(id, "position") == null)
    );
    const upToDate = player.loadedEntities.difference(dirtyEntities);

    const unsentEntities = new Set(
      world.entitiesAround(position.x(), position.y(), LOADED_SIDE_LENGTH)
    ).difference(upToDate);

    if (unsentEntities.size > 0 || despawned.size > 0) {
      player.send({
        type: "entities",
        snapshot: world.entities.takeSnapshot([...unsentEntities]),
        despawned,
      });
    }
    player.loadedEntities = upToDate.union(unsentEntities);
  }
};
