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
  //     store
  //       .get(playerId, "controller")
  //       .destination.setHead(...message.position);
  //     break;

  //   default:
  //     return checkExhausted(message);
  // }
  // store.get(playerId, "controller").destination.setHead(...message.position);
  // store.get(playerId, "controller").destination.setHead(message.position);
  store.add(playerId, "destination", message.position);
};
