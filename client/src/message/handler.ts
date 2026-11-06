import type { ServerMessage } from "@colony-builder/shared";
import { checkExhausted } from "niall-utils/core";

import type { State } from "../state.ts";

export const messageHandler = (state: State, message: ServerMessage): void => {
  switch (message.type) {
    case "init":
      state.playerId = message.id;
      break;

    case "entities":
      state.world.entities.applySnapshot(message.snapshot);
      break;

    case "terrain":
      state.world.terrain.applySnapshot(message.snapshot);
      break;

    default:
      return checkExhausted(message);
  }
};
