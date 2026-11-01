import {
  createItem,
  createPlayer,
  encClientMessage,
  encServerMessage,
  SOCKET_PORT,
  TPS,
  World,
  type EntitiesMessage,
  type ServerMessage,
} from "@colony-builder/shared";
import { Vector } from "vectyped";
import { WebSocketServer, type WebSocket } from "ws";

import { messageHandler } from "./message/handler.ts";
import { entitiesAround } from "./spatial.ts";
import type { State } from "./state.ts";
import { serverSystems, type ServerSystem } from "./system.ts";

const state: State = {
  world: new World(),
  players: new Map(),
  entityRegions: new Map(),
};

createItem(state.world, Vector.UP.multiply(5));

const send = (socket: WebSocket, message: ServerMessage) => {
  socket.send(encServerMessage.encode(message));
};

const server = new WebSocketServer({ port: SOCKET_PORT });

server.on("connection", socket => {
  const playerId = createPlayer(state.world);
  state.players.set(playerId, { socket, loadedRegions: new Set() });

  send(socket, { type: "init", id: playerId });

  socket.on("message", data => {
    const message = encClientMessage.decode(
      Array.isArray(data) ? Buffer.concat(data) : new Uint8Array(data)
    );
    if (message === undefined) return;

    messageHandler(state, playerId, message);
  });

  socket.on("close", () => {
    state.players.delete(playerId);
    state.world.entities.despawn(playerId);
  });
});

let lastTick = Date.now();

setInterval(() => {
  const now = Date.now();
  const dt = Math.min((now - lastTick) / 1000, 2 / TPS);
  lastTick = now;

  const ctx: Parameters<ServerSystem>[0] = { world: state.world, dt, state };

  for (const system of serverSystems) system(ctx);

  for (const [id, playerState] of state.players) {
    if (playerState.socket.readyState !== playerState.socket.OPEN) continue;
    const position = state.world.entities.get(id, "position");
    const ids = state.world.terrain.loadTerrain(position.x(), position.y());
    const idsDiff = ids.difference(playerState.loadedRegions);

    if (idsDiff.size > 0) {
      send(playerState.socket, {
        type: "terrain",
        snapshot: state.world.terrain.takeSnapshot(idsDiff.values().toArray()),
      });
      for (const id of idsDiff) playerState.loadedRegions.add(id);
    }

    const [x, y] = state.world.entities.get(id, "position").toArray();
    const entities: EntitiesMessage = {
      type: "entities",
      snapshot: state.world.entities.takeSnapshot(entitiesAround(state, x, y)),
    };
    send(playerState.socket, entities);
  }
}, 1000 / TPS);
