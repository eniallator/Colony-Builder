import { type ClientMessage, type EntityId } from "@colony-builder/shared";
import { checkExhausted, raise } from "niall-utils/core";

import type { State } from "../state.ts";

export const messageHandler = (
  state: State,
  playerId: EntityId,
  message: ClientMessage
): void => {
  switch (message.type) {
    case "unload": {
      const playerState =
        state.players.get(playerId) ??
        raise(new Error(`Player ${playerId} not found`));

      playerState.loadedRegions = playerState.loadedRegions.difference(
        new Set(message.ids)
      );
      break;
    }

    case "unloadEntities": {
      const playerState =
        state.players.get(playerId) ??
        raise(new Error(`Player ${playerId} not found`));

      playerState.loadedEntities = playerState.loadedEntities.difference(
        new Set(message.ids)
      );
      break;
    }

    case "move": {
      state.world.entities.add(playerId, "destination", message.position);
      state.world.entities.get(playerId, "taskList").tasks.length = 0;
      break;
    }

    case "place": {
      state.world.terrain.addTile(
        message.position.x(),
        message.position.y(),
        message.tile
      );
      state.world.entities.get(playerId, "taskList").tasks.length = 0;
      break;
    }

    case "gatherTile": {
      const taskList = state.world.entities.get(playerId, "taskList");
      state.world.entities.add(playerId, "taskList", {
        ...taskList,
        tasks: [
          {
            type: "gatherTile",
            target: message.position,
            endsAt: undefined,
          },
        ],
      });
      break;
    }

    case "gatherStructure": {
      const taskList = state.world.entities.get(playerId, "taskList");
      state.world.entities.add(playerId, "taskList", {
        ...taskList,
        tasks: [
          {
            type: "gatherStructure",
            regionId: message.regionId,
            subRegionId: message.subRegionId,
            endsAt: undefined,
          },
        ],
      });
      break;
    }

    default:
      return checkExhausted(message);
  }
};
