import type { ServerMessage } from "@colony-builder/shared";
import { checkExhausted } from "niall-utils";

import type { State } from "../state.ts";

export const messageHandler = (state: State, message: ServerMessage): void => {
  switch (message.type) {
    case "init":
      state.playerId = message.id;
      break;

    case "snapshot":
      state.store.applySnapshot(message.snapshot);
      break;

    default:
      return checkExhausted(message);
  }
};
