import type { ClientMessage, ServerMessage } from "./message.ts";

export const formatClientMessage = (message: ClientMessage) =>
  JSON.stringify(message);

export const formatServerMessage = (message: ServerMessage) =>
  JSON.stringify(message);
