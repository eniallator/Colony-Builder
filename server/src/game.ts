import {
  createPlayer,
  createRobot,
  encClientMessage,
  encServerMessage,
  World,
  type ServerMessage,
} from "@colony-builder/shared";
import { Vector } from "vectyped";

import { messageHandler } from "./message/handler.ts";
import type { State } from "./state.ts";
import { streamToPlayers } from "./stream.ts";
import { serverSystems, type ServerSystem } from "./system.ts";

export interface Connection {
  send: (bytes: Uint8Array) => void;
}

export interface PlayerSession {
  receive: (bytes: Uint8Array) => void;
  disconnect: () => void;
}

export interface Game {
  connect: (connection: Connection) => PlayerSession;
  tick: (dt: number) => void;
}

const seedWorld = (world: World) => {
  createRobot(world, Vector.zero(2), [
    { type: "gatherResource", target: Vector.create(30, -10), progress: 0 },
    { type: "dropInventory", target: Vector.create(30.5, -4.5) },
  ]);
};

export const createGame = (): Game => {
  const state: State = { world: new World(), players: new Map() };
  seedWorld(state.world);

  return {
    connect: connection => {
      const playerId = createPlayer(state.world);
      const send = (message: ServerMessage): void => {
        connection.send(encServerMessage.encode(message));
      };

      state.players.set(playerId, { send, loadedRegions: new Set() });
      send({ type: "init", id: playerId });

      return {
        receive: bytes => {
          const message = encClientMessage.decode(bytes);
          if (message != null) messageHandler(state, playerId, message);
        },
        disconnect: () => {
          state.players.delete(playerId);
          state.world.entities.despawn(playerId);
        },
      };
    },

    tick: dt => {
      const ctx: Parameters<ServerSystem>[0] = {
        world: state.world,
        dt,
        state,
      };
      for (const system of serverSystems) system(ctx);

      streamToPlayers(state);
    },
  };
};
