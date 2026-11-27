import { Vector } from "vectyped";
import { describe, expect, it } from "vitest";

import { REGION_SIDE_LENGTH } from "../constants.ts";
import { itemIds, type ItemData } from "../item/types.ts";
import { encTime, type Time } from "../time.ts";
import {
  regionPosToId,
  tiles,
  tileToId,
  unsafeEntityId,
  type Components,
  type EntitySnapshot,
  type RegionTiles,
  type TileId,
  type WorldSnapshot,
} from "../world/index.ts";
import {
  encClientMessage,
  encEntitiesMessage,
  encInitMessage,
  encLoadMessage,
  encMoveMessage,
  encServerMessage,
  encUnloadMessage,
  type ClientMessage,
  type ServerMessage,
} from "./message.ts";

const playerId = unsafeEntityId(1);
const itemEntityId = unsafeEntityId(2);

const [heldItem] = itemIds;
const itemData: ItemData<typeof heldItem> = true;

const player: Components = {
  type: "player",
  position: Vector.create(1.5, -2.25),
  destination: Vector.create(4, 8),
  speed: 3,
  canPickup: undefined,
  conveyable: undefined,
  inventory: { [heldItem]: { data: itemData, count: 5 } },
  taskList: undefined,
};

const item: Components = {
  type: "item",
  position: Vector.create(0, 0),
  destination: undefined,
  speed: undefined,
  canPickup: true,
  conveyable: true,
  inventory: undefined,
  taskList: undefined,
};

const entities: EntitySnapshot = new Map([
  [playerId, player],
  [itemEntityId, item],
]);

const REGION_TILE_COUNT = REGION_SIDE_LENGTH ** 2;

const region = (tileAt: (i: number) => TileId): RegionTiles =>
  Array.from({ length: REGION_TILE_COUNT }, (_, i) => tileAt(i));

const firstTile = tileToId(tiles[0]);
const secondTile = tileToId(tiles[1]);

const uniform = region(() => firstTile);
const checkerboard = region(i => (i % 2 ? secondTile : firstTile));

const terrain: WorldSnapshot = new Map([
  [regionPosToId(0, 0), { tiles: uniform, structures: new Map() }],
  [regionPosToId(-3, 7), { tiles: checkerboard, structures: new Map() }],
]);

describe("encClientMessage", () => {
  const move: ClientMessage = { type: "move", position: Vector.create(10, 20) };
  const unload: ClientMessage = {
    type: "unload",
    ids: [regionPosToId(0, 0), regionPosToId(1, -1)],
  };

  it("round-trips a move message", () => {
    expect(encClientMessage.decode(encClientMessage.encode(move))).toEqual(
      move
    );
  });

  it("round-trips an unload message", () => {
    expect(encClientMessage.decode(encClientMessage.encode(unload))).toEqual(
      unload
    );
    expect(
      encClientMessage.decode(
        encClientMessage.encode({ type: "unload", ids: [] })
      )
    ).toEqual({ type: "unload", ids: [] });
  });

  it("round-trips an unload entities message", () => {
    const unloadEntities: ClientMessage = {
      type: "unloadEntities",
      ids: [unsafeEntityId(3), unsafeEntityId(8)],
    };

    expect(
      encClientMessage.decode(encClientMessage.encode(unloadEntities))
    ).toEqual(unloadEntities);
  });

  it("distinguishes message kinds by their tag", () => {
    expect(encClientMessage.encode(move)[0]).toBe(0);
    expect(encClientMessage.encode(unload)[0]).toBe(1);
  });

  it("encodes a move as a tag and two f32 coordinates", () => {
    expect(encMoveMessage.encode(move)).toHaveLength(8);
    expect(encClientMessage.encode(move)).toHaveLength(9);
  });

  it("encodes distinct unloaded ids as a dynamic array of i32 pairs", () => {
    expect(encClientMessage.encode(unload)).toEqual(
      Uint8Array.of(
        ...[1], // tag
        ...[0], // dynamic array
        ...[2, 0, 0, 0], // two ids
        ...[0, 0, 0, 0, 0, 0, 0, 0], // id 0,0
        ...[1, 0, 0, 0, 255, 255, 255, 255] // id 1,-1
      )
    );
  });

  it("run-length encodes repeated unloaded ids", () => {
    const repeated = encUnloadMessage.encode({
      type: "unload",
      ids: [regionPosToId(0, 0), regionPosToId(0, 0)],
    });

    expect(repeated).toEqual(
      Uint8Array.of(
        ...[1], // rle array
        ...[1, 0, 0, 0], // one run
        ...[2, 0], // run of 2
        ...[0, 0, 0, 0, 0, 0, 0, 0] // id 0,0
      )
    );
  });

  it("rejects bytes that are not a client message", () => {
    expect(encClientMessage.decode(new Uint8Array([2]))).toBeUndefined();
    expect(encClientMessage.decode(new Uint8Array())).toBeUndefined();
  });

  it("rejects truncated messages", () => {
    expect(encClientMessage.decode(new Uint8Array([0, 1]))).toBeUndefined();
    expect(encClientMessage.decode(new Uint8Array([1, 1, 0]))).toBeUndefined();
  });
});

describe("encServerMessage", () => {
  const time: Time = { start: 1, lastFrame: 2, now: 3.5, delta: 1.5 };
  const init: ServerMessage = { type: "init", id: unsafeEntityId(7), time };
  const entitiesMessage: ServerMessage = {
    type: "entities",
    snapshot: entities,
    despawned: new Set([unsafeEntityId(9)]),
  };
  const terrainMessage: ServerMessage = { type: "load", snapshot: terrain };

  it("round-trips an init message", () => {
    expect(encServerMessage.decode(encServerMessage.encode(init))).toEqual(
      init
    );
  });

  it("round-trips an entities message", () => {
    expect(
      encServerMessage.decode(encServerMessage.encode(entitiesMessage))
    ).toEqual(entitiesMessage);
  });

  it("round-trips a terrain message", () => {
    expect(
      encServerMessage.decode(encServerMessage.encode(terrainMessage))
    ).toEqual(terrainMessage);
  });

  it("distinguishes message kinds by their tag", () => {
    expect(encServerMessage.encode(init)[0]).toBe(0);
    expect(encServerMessage.encode(entitiesMessage)[0]).toBe(1);
    expect(encServerMessage.encode(terrainMessage)[0]).toBe(2);
  });

  it("encodes an init message as a tag, a u32 id and the time", () => {
    expect(encServerMessage.encode(init)).toEqual(
      Uint8Array.of(0, 7, 0, 0, 0, ...encTime.encode(time))
    );
    expect(encInitMessage.guard(init)).toBe(true);
  });

  it("round-trips an entities message that despawns nothing", () => {
    const nothingDespawned: ServerMessage = {
      type: "entities",
      snapshot: entities,
      despawned: new Set(),
    };

    expect(
      encServerMessage.decode(encServerMessage.encode(nothingDespawned))
    ).toEqual(nothingDespawned);
  });

  it("has a guard per message kind", () => {
    expect(encEntitiesMessage.guard(entitiesMessage)).toBe(true);
    expect(encLoadMessage.guard(terrainMessage)).toBe(true);
    expect(encEntitiesMessage.guard(terrainMessage)).toBe(false);
    expect(encLoadMessage.guard(init)).toBe(false);
  });

  it("rejects an unknown tag and truncated messages", () => {
    expect(encServerMessage.decode(new Uint8Array([9]))).toBeUndefined();
    expect(encServerMessage.decode(new Uint8Array([0, 1]))).toBeUndefined();
  });
});
