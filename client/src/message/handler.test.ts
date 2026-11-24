import {
  createItem,
  createPlayer,
  itemIds,
  REGION_SIDE_LENGTH,
  regionPosToId,
  tiles,
  tileToId,
  unsafeEntityId,
  World,
  type RegionTiles,
  type Tile,
} from "@colony-builder/shared";
import { Vector } from "vectyped";
import { describe, expect, it, vi } from "vitest";

import type { State } from "../state.ts";
import type { ClickDetails } from "../ui/clickable.ts";
import { createStateful } from "../ui/types.ts";
import { messageHandler } from "./handler.ts";

const createState = (): State => ({
  camera: { center: Vector.zero(2), zoom: 0 },
  world: new World(),
  clickDetails: createStateful<ClickDetails | null>(null),
  send: vi.fn(),
});

const region = (tile: Tile): RegionTiles =>
  Array.from({ length: REGION_SIDE_LENGTH ** 2 }, () => tileToId(tile));

const loaded = (regionTiles: RegionTiles) => ({
  tiles: regionTiles,
  structures: new Map(),
});

const [firstTile, secondTile, thirdTile] = tiles;
const [itemId] = itemIds;

describe("messageHandler", () => {
  it("stores the player id from an init message", () => {
    const state = createState();

    const time = { start: 1, lastFrame: 2, now: 3, delta: 1 };

    messageHandler(state, { type: "init", id: unsafeEntityId(3), time });

    expect(state.playerId).toBe(3);
    expect(state.serverTime).toEqual(time);
  });

  it("applies the entities from an entities message", () => {
    const server = new World();
    const player = createPlayer(server, Vector.create(1, 2));
    const item = createItem(
      server,
      { id: itemId, count: 1, data: false },
      Vector.create(3, 4)
    );
    const state = createState();

    messageHandler(state, {
      type: "entities",
      snapshot: server.entities.takeSnapshot([player, item]),
      despawned: new Set(),
    });

    expect(state.world.entities.get(player, "position").toArray()).toEqual([
      1, 2,
    ]);
    expect(state.world.entities.get(item, "position").toArray()).toEqual([
      3, 4,
    ]);
    expect(state.playerId).toBeUndefined();
  });

  it("removes the entities an entities message despawns", () => {
    const server = new World();
    const player = createPlayer(server);
    const state = createState();
    messageHandler(state, {
      type: "entities",
      snapshot: server.entities.takeSnapshot([player]),
      despawned: new Set(),
    });

    messageHandler(state, {
      type: "entities",
      snapshot: new Map(),
      despawned: new Set([player]),
    });

    expect(state.world.entities.query("position")).toEqual([]);
  });

  it("keeps entities that a later entities message does not mention", () => {
    const server = new World();
    const player = createPlayer(server);
    const item = createItem(
      server,
      { id: itemId, count: 1, data: false },
      Vector.zero(2)
    );
    const state = createState();
    messageHandler(state, {
      type: "entities",
      snapshot: server.entities.takeSnapshot([player, item]),
      despawned: new Set(),
    });

    messageHandler(state, {
      type: "entities",
      snapshot: server.entities.takeSnapshot([item]),
      despawned: new Set(),
    });

    expect(state.world.entities.query("position")).toEqual([player, item]);
  });

  it("ignores a despawned entity it does not have", () => {
    const state = createState();

    messageHandler(state, {
      type: "entities",
      snapshot: new Map(),
      despawned: new Set([unsafeEntityId(5)]),
    });

    expect(state.world.entities.query("position")).toEqual([]);
  });

  it("applies the regions from a terrain message", () => {
    const state = createState();
    const first = region(firstTile);

    messageHandler(state, {
      type: "load",
      snapshot: new Map([[regionPosToId(2, -3), loaded(first)]]),
    });

    expect(state.world.terrain.get(regionPosToId(2, -3))).toBe(first);
  });

  it("keeps regions that an earlier terrain message delivered", () => {
    const state = createState();
    const first = region(firstTile);
    const second = region(secondTile);
    messageHandler(state, {
      type: "load",
      snapshot: new Map([[regionPosToId(0, 0), loaded(first)]]),
    });

    messageHandler(state, {
      type: "load",
      snapshot: new Map([[regionPosToId(1, 0), loaded(second)]]),
    });

    expect(state.world.terrain.get(regionPosToId(0, 0))).toBe(first);
    expect(state.world.terrain.get(regionPosToId(1, 0))).toBe(second);
  });

  it("keeps entities and terrain separate", () => {
    const state = createState();
    const server = new World();
    const player = createPlayer(server);

    messageHandler(state, {
      type: "entities",
      snapshot: server.entities.takeSnapshot([player]),
      despawned: new Set(),
    });
    messageHandler(state, {
      type: "load",
      snapshot: new Map([[regionPosToId(0, 0), loaded(region(thirdTile))]]),
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
