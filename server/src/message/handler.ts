import type { ClientMessage, EntityId, World } from "@colony-builder/shared";

export const messageHandler = (
  world: World,
  playerId: EntityId,
  message: ClientMessage
): void => {
  // switch (message.type) {
  //   case "destination":
  //     world
  //       .get(playerId, "controller")
  //       .destination.setHead(...message.position);
  //     break;

  //   default:
  //     return checkExhausted(message);
  // }
  world.get(playerId, "controller").destination.setHead(...message.position);
};
