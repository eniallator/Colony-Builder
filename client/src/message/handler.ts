import type { ServerMessage } from "@colony-builder/shared";
import { checkExhausted } from "niall-utils/core";

import type { State } from "../state.ts";

export const messageHandler = (state: State, message: ServerMessage): void => {
  switch (message.type) {
    case "init":
      state.playerId = message.id;
      state.serverTime = message.time;
      break;

    case "entities":
      state.world.entities.applySnapshot(message.snapshot);
      for (const id of message.despawned) state.world.entities.despawn(id);
      break;

    case "load":
      state.world.applySnapshot(message.snapshot);
      break;

    default:
      return checkExhausted(message);
  }
};
