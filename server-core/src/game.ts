import {
  createPlayer,
  encClientMessage,
  encServerMessage,
  World,
  type ServerMessage,
  type WorldGenerator,
} from "@colony-builder/shared";

import { messageHandler } from "./message/handler.ts";
import type { State } from "./state.ts";
import { streamToPlayers } from "./stream.ts";
import { serverSystems, type ServerSystem } from "./system.ts";
import { createWorldGenerator } from "./terrain/worldGenerator.ts";

export interface Connection {
  send: (bytes: Uint8Array<ArrayBuffer>) => void;
}

export interface PlayerSession {
  receive: (bytes: Uint8Array) => void;
  disconnect: () => void;
}

export interface Game {
  connect: (connection: Connection) => PlayerSession;
  tick: (dt: number) => void;
}

const randomSeed = (): string => Math.random().toString(36).slice(2);

/** Takes the `worldGenerator` so tests can swap the costly real one for a cheap one. */
export const createGame = (
  worldGenerator: WorldGenerator = createWorldGenerator(randomSeed())
): Game => {
  const state: State = { world: new World(), players: new Map() };

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

      streamToPlayers(state, worldGenerator);
    },
  };
};
