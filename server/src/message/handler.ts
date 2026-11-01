import type { ClientMessage, EntityId } from "@colony-builder/shared";
import { checkExhausted, raise } from "niall-utils/core";

import type { State } from "../state.ts";

export const messageHandler = (
  state: State,
  playerId: EntityId,
  message: ClientMessage
): void => {
  switch (message.type) {
    case "move":
      state.world.entities.add(playerId, "destination", message.position);
      break;

    case "unload": {
      const playerState =
        state.players.get(playerId) ??
        raise(new Error(`Player ${playerId} not found`));

      playerState.loadedRegions = playerState.loadedRegions.difference(
        new Set(message.ids)
      );
      break;
    }

    default:
      return checkExhausted(message);
  }
};
