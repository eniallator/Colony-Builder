import { SOCKET_PORT } from "@colony-builder/shared";
import { isInstance } from "deep-guards";

import type { ClientTransport } from "./types.ts";

const isArrayBuffer = isInstance(ArrayBuffer);

export const connectWebSocket = (): ClientTransport => {
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  const socket = new WebSocket(
    `${protocol}://${location.hostname}:${SOCKET_PORT}`
  );
  socket.binaryType = "arraybuffer";

  return {
    send: bytes => {
      socket.send(bytes);
    },
    onMessage: listener => {
      socket.addEventListener("message", ({ data }) => {
        if (isArrayBuffer(data)) listener(new Uint8Array(data));
      });
    },
  };
};
