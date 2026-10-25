import {
  createInitMessage,
  createPlayer,
  createSnapshotMessage,
  DEFAULT_PORT,
  isClientMessage,
  parseJson,
  takeSnapshot,
  TPS,
  World,
  type EntityId,
  type ServerMessage,
} from "@colony-builder/shared";
import { WebSocketServer, type WebSocket } from "ws";

import { serverSystems, type ServerSystemContext } from "./system.ts";

const world = new World();

const send = (socket: WebSocket, message: ServerMessage) => {
  socket.send(JSON.stringify(message));
};

const port = Number(process.env["PORT"] ?? DEFAULT_PORT);
const server = new WebSocketServer({ port });
const players = new Map<WebSocket, EntityId>();

server.on("connection", socket => {
  const playerId = createPlayer(world);
  players.set(socket, playerId);

  send(socket, createInitMessage(playerId));
  socket.on("message", (data, isBinary) => {
    // Our client only ever sends text, which ws delivers as a Buffer.
    if (isBinary || !Buffer.isBuffer(data)) return;

    const message = parseJson(data.toString(), isClientMessage);
    if (message === undefined) return;

    world.get(playerId, "controller").destination.setHead(...message.position);
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

  const snapshot = JSON.stringify(createSnapshotMessage(takeSnapshot(world)));

  for (const socket of players.keys()) {
    if (socket.readyState === socket.OPEN) socket.send(snapshot);
  }
}, 1000 / TPS);
