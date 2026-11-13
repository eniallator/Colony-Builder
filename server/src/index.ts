import { SOCKET_PORT, TPS } from "@colony-builder/shared";
import { WebSocketServer } from "ws";

import { createGame } from "./game.ts";
import { createTicker } from "./ticker.ts";

const game = createGame();
const server = new WebSocketServer({ port: SOCKET_PORT });

server.on("connection", socket => {
  const session = game.connect({
    send: bytes => {
      if (socket.readyState === socket.OPEN) socket.send(bytes);
    },
  });

  socket.on("message", data => {
    session.receive(
      Array.isArray(data) ? Buffer.concat(data) : new Uint8Array(data)
    );
  });

  socket.on("close", session.disconnect);
});

setInterval(createTicker(game, Date.now), 1000 / TPS);
