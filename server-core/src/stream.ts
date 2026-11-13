import { LOADED_SIDE_LENGTH } from "@colony-builder/shared";

import type { State } from "./state.ts";
import { terrainGenerator } from "./terrainGenerator.ts";

export const streamToPlayers = ({ world, players }: State): void => {
  for (const [id, player] of players) {
    const position = world.entities.get(id, "position");

    const unsent = world.terrain
      .loadTerrain(position.x(), position.y(), terrainGenerator)
      .difference(player.loadedRegions);

    if (unsent.size > 0) {
      player.send({
        type: "terrain",
        snapshot: world.terrain.takeSnapshot([...unsent]),
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
