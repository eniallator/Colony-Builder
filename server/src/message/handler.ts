import type {
  ClientMessage,
  EntityId,
  EntityStore,
} from "@colony-builder/shared";

export const messageHandler = (
  store: EntityStore,
  playerId: EntityId,
  message: ClientMessage
): void => {
  // switch (message.type) {
  //   case "destination":
  //     store.add(playerId, "destination", message.position);
  //     break;
  //   default:
  //     return checkExhausted(message);
  // }
  store.add(playerId, "destination", message.position);
};
