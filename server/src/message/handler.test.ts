import {
  createPlayer,
  regionPosToId,
  World,
  type EntityId,
  type RegionId,
} from "@colony-builder/shared";
import { Vector } from "vectyped";
import { describe, expect, it } from "vitest";
import type { WebSocket } from "ws";

import type { State } from "../state.ts";
import { messageHandler } from "./handler.ts";

const origin = regionPosToId(0, 0);
const east = regionPosToId(1, 0);
const north = regionPosToId(0, -1);

const stateWith = (
  world: World,
  ...players: [EntityId, RegionId[]][]
): State => ({
  world,
  players: new Map(
    players.map(([id, regions]) => [
      id,
      // The handler never touches the socket, so a stand-in is enough.
      { socket: {} as unknown as WebSocket, loadedRegions: new Set(regions) },
    ])
  ),
});

describe("messageHandler", () => {
  describe("move", () => {
    it("sets the destination of the player", () => {
      const world = new World();
      const player = createPlayer(world);

      messageHandler(stateWith(world, [player, []]), player, {
        type: "move",
        position: Vector.create(3, 4),
      });

      expect(world.entities.get(player, "destination").toArray()).toEqual([
        3, 4,
      ]);
    });

    it("only affects the given player", () => {
      const world = new World();
      const player = createPlayer(world);
      const other = createPlayer(world);

      messageHandler(stateWith(world, [player, []], [other, []]), player, {
        type: "move",
        position: Vector.create(3, 4),
      });

      expect(world.entities.optGet(other, "destination")).toBeUndefined();
    });
  });

  describe("unload", () => {
    const loadedOf = (state: State, id: EntityId) => [
      ...(state.players.get(id)?.loadedRegions ?? []),
    ];

    it("forgets the unloaded regions of the player", () => {
      const world = new World();
      const player = createPlayer(world);
      const state = stateWith(world, [player, [origin, east, north]]);

      messageHandler(state, player, { type: "unload", ids: [origin, north] });

      expect(loadedOf(state, player)).toEqual([east]);
    });

    it("ignores ids the player has not loaded", () => {
      const world = new World();
      const player = createPlayer(world);
      const state = stateWith(world, [player, [origin]]);

      messageHandler(state, player, { type: "unload", ids: [east] });

      expect(loadedOf(state, player)).toEqual([origin]);
    });

    it("leaves everything loaded for an empty unload", () => {
      const world = new World();
      const player = createPlayer(world);
      const state = stateWith(world, [player, [origin, east]]);

      messageHandler(state, player, { type: "unload", ids: [] });

      expect(loadedOf(state, player)).toEqual([origin, east]);
    });

    it("only affects the given player", () => {
      const world = new World();
      const player = createPlayer(world);
      const other = createPlayer(world);
      const state = stateWith(
        world,
        [player, [origin, east]],
        [other, [origin, east]]
      );

      messageHandler(state, player, { type: "unload", ids: [origin] });

      expect(loadedOf(state, player)).toEqual([east]);
      expect(loadedOf(state, other)).toEqual([origin, east]);
    });

    it("throws for a player that is not connected", () => {
      const world = new World();
      const player = createPlayer(world);

      expect(() => {
        messageHandler(stateWith(world), player, { type: "unload", ids: [] });
      }).toThrow(`Player ${player} not found`);
    });
  });

  it("throws on a message it does not know", () => {
    const world = new World();
    const player = createPlayer(world);

    expect(() => {
      // @ts-expect-error the message type is not part of the protocol
      messageHandler(stateWith(world), player, { type: "unknown" });
    }).toThrow("Value not exhausted");
  });
});
