import {
  LOADED_SIDE_LENGTH,
  type WorldGenerator,
} from "@colony-builder/shared";

import type { State } from "./state.ts";

export const streamToPlayers = (
  { world, players }: State,
  worldGenerator: WorldGenerator
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

    player.send({
      type: "entities",
      snapshot: world.entities.takeSnapshot(
        world.entitiesAround(position.x(), position.y(), LOADED_SIDE_LENGTH)
      ),
    });
  }
};
