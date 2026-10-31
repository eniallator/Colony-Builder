import type { ClientMessage, EntityId, World } from "@colony-builder/shared";

export const messageHandler = (
  world: World,
  playerId: EntityId,
  message: ClientMessage
): void => {
  // switch (message.type) {
  //   case "destination":
  //     world.entities.add(playerId, "destination", message.position);
  //     break;
  //   default:
  //     return checkExhausted(message);
  // }
  world.entities.add(playerId, "destination", message.position);
};
