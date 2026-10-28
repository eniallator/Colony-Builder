import {
  clientMessage,
  createItem,
  createPlayer,
  DEFAULT_PORT,
  initMessage,
  serverMessage,
  snapshotMessage,
  takeSnapshot,
  TPS,
  World,
  type EntityId,
  type ServerMessage,
} from "@colony-builder/shared";
import { Vector } from "vectyped";
import { WebSocketServer, type WebSocket } from "ws";

import { messageHandler } from "./message/handler.ts";
import { serverSystems, type ServerSystemContext } from "./system.ts";

const world = new World();

createItem(world, Vector.UP.multiply(5));

const send = (socket: WebSocket, message: ServerMessage) => {
  socket.send(serverMessage.encode(message));
};

const port = Number(process.env["PORT"] ?? DEFAULT_PORT);
const server = new WebSocketServer({ port });
const players = new Map<WebSocket, EntityId>();

server.on("connection", socket => {
  const playerId = createPlayer(world);
  players.set(socket, playerId);

  send(socket, initMessage.create(playerId));
  socket.on("message", data => {
    const message = clientMessage.decode(
      Array.isArray(data) ? Buffer.concat(data) : new Uint8Array(data)
    );
    if (message === undefined) return;

    messageHandler(world, playerId, message);
  });

  socket.on("close", () => {
    players.delete(socket);
    world.despawn(playerId);
  });
});

let lastTick = Date.now();

setInterval(() => {
  const now = Date.now();
  const dt = Math.min((now - lastTick) / 1000, 2 / TPS);
  lastTick = now;

  const systemCtx: ServerSystemContext = { world, dt };

  for (const system of serverSystems) system(systemCtx);

  const snapshot = serverMessage.create(
    snapshotMessage.create(takeSnapshot(world))
  );

  for (const socket of players.keys()) {
    if (socket.readyState === socket.OPEN) send(socket, snapshot);
  }
}, 1000 / TPS);
