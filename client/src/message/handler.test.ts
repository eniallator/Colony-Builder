import {
  createItem,
  createPlayer,
  REGION_SIDE_LENGTH,
  regionPosToId,
  unsafeEntityId,
  World,
  type RegionTiles,
  type Tile,
} from "@colony-builder/shared";
import { Vector } from "vectyped";
import { describe, expect, it, vi } from "vitest";

import type { State } from "../state.ts";
import { messageHandler } from "./handler.ts";

const createState = (): State => ({
  camera: { center: Vector.zero(2), zoom: 0 },
  world: new World(),
  send: vi.fn(),
});

const region = (tile: Tile): RegionTiles => ({
  tiles: Array.from({ length: REGION_SIDE_LENGTH ** 2 }, () => tile),
});

describe("messageHandler", () => {
  it("stores the player id from an init message", () => {
    const state = createState();

    messageHandler(state, { type: "init", id: unsafeEntityId(3) });

    expect(state.playerId).toBe(3);
  });

  it("applies the entities from an entities message", () => {
    const server = new World();
    const player = createPlayer(server, Vector.create(1, 2));
    const item = createItem(server, Vector.create(3, 4));
    const state = createState();

    messageHandler(state, {
      type: "entities",
      snapshot: server.entities.takeSnapshot([player, item]),
    });

    expect(state.world.entities.get(player, "position").toArray()).toEqual([
      1, 2,
    ]);
    expect(state.world.entities.get(item, "position").toArray()).toEqual([
      3, 4,
    ]);
    expect(state.playerId).toBeUndefined();
  });

  it("removes entities missing from a later entities message", () => {
    const server = new World();
    const player = createPlayer(server);
    const state = createState();
    messageHandler(state, {
      type: "entities",
      snapshot: server.entities.takeSnapshot([player]),
    });

    server.entities.despawn(player);
    messageHandler(state, {
      type: "entities",
      snapshot: server.entities.takeSnapshot([]),
    });

    expect(state.world.entities.query("position")).toEqual([]);
  });

  it("applies the regions from a terrain message", () => {
    const state = createState();
    const grass = region("grass");

    messageHandler(state, {
      type: "terrain",
      snapshot: new Map([[regionPosToId(2, -3), grass]]),
    });

    expect(state.world.terrain.get(regionPosToId(2, -3))).toBe(grass);
  });

  it("keeps regions that an earlier terrain message delivered", () => {
    const state = createState();
    const grass = region("grass");
    const water = region("water");
    messageHandler(state, {
      type: "terrain",
      snapshot: new Map([[regionPosToId(0, 0), grass]]),
    });

    messageHandler(state, {
      type: "terrain",
      snapshot: new Map([[regionPosToId(1, 0), water]]),
    });

    expect(state.world.terrain.get(regionPosToId(0, 0))).toBe(grass);
    expect(state.world.terrain.get(regionPosToId(1, 0))).toBe(water);
  });

  it("keeps entities and terrain separate", () => {
    const state = createState();
    const server = new World();
    const player = createPlayer(server);

    messageHandler(state, {
      type: "entities",
      snapshot: server.entities.takeSnapshot([player]),
    });
    messageHandler(state, {
      type: "terrain",
      snapshot: new Map([[regionPosToId(0, 0), region("sand")]]),
    });

    expect(state.world.entities.query("position")).toHaveLength(1);
    expect([...state.world.terrain.ids]).toEqual([regionPosToId(0, 0)]);
  });

  it("throws on a message it does not know", () => {
    expect(() => {
      // @ts-expect-error the message type is not part of the protocol
      messageHandler(createState(), { type: "unknown" });
    }).toThrow("Value not exhausted");
  });
});
