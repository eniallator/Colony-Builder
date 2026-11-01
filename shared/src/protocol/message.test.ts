import { Vector } from "vectyped";
import { describe, expect, it } from "vitest";

import { REGION_SIDE_LENGTH } from "../constants.ts";
import { unsafeEntityId } from "../entity/index.ts";
import { regionPosToId, type Tile } from "../terrain/index.ts";
import {
  encClientMessage,
  encComponentSnapshot,
  encEntitiesMessage,
  encEntitySnapshot,
  encInitMessage,
  encMoveMessage,
  encRegionTiles,
  encServerMessage,
  encTerrainMessage,
  encTerrainSnapshot,
  encUnloadMessage,
  type ClientMessage,
  type ComponentSnapshot,
  type EntitySnapshot,
  type RegionTiles,
  type ServerMessage,
  type TerrainSnapshot,
} from "./message.ts";

const playerId = unsafeEntityId(1);
const itemId = unsafeEntityId(2);

const player: ComponentSnapshot = {
  type: "player",
  position: Vector.create(1.5, -2.25),
  destination: Vector.create(4, 8),
  speed: 3,
  conveyable: undefined,
};

const item: ComponentSnapshot = {
  type: "item",
  position: Vector.create(0, 0),
  destination: undefined,
  speed: undefined,
  conveyable: true,
};

const entities: EntitySnapshot = new Map([
  [playerId, player],
  [itemId, item],
]);

const REGION_TILE_COUNT = REGION_SIDE_LENGTH ** 2;

const region = (tileAt: (i: number) => Tile): RegionTiles => ({
  tiles: Array.from({ length: REGION_TILE_COUNT }, (_, i) => tileAt(i)),
});

const grass = region(() => "grass");
const checkerboard = region(i => (i % 2 ? "dirt" : "grass"));

const terrain: TerrainSnapshot = new Map([
  [regionPosToId(0, 0), grass],
  [regionPosToId(-3, 7), checkerboard],
]);

describe("encComponentSnapshot", () => {
  it("round-trips an entity with every field", () => {
    expect(
      encComponentSnapshot.decode(encComponentSnapshot.encode(player))
    ).toEqual(player);
  });

  it("round-trips an entity without its optional fields", () => {
    expect(
      encComponentSnapshot.decode(encComponentSnapshot.encode(item))
    ).toEqual(item);
  });

  it("rejects non-finite numbers when decoding", () => {
    const nan = encComponentSnapshot.encode({
      ...item,
      position: Vector.create(Number.NaN, 0),
    });
    const infinite = encComponentSnapshot.encode({ ...item, speed: Infinity });

    expect(encComponentSnapshot.decode(nan)).toBeUndefined();
    expect(encComponentSnapshot.decode(infinite)).toBeUndefined();
  });

  it("rejects an unknown entity type", () => {
    expect(encComponentSnapshot.guard({ ...item, type: "dragon" })).toBe(false);
  });
});

describe("encEntitySnapshot", () => {
  it("round-trips entities keyed by id", () => {
    expect(
      encEntitySnapshot.decode(encEntitySnapshot.encode(entities))
    ).toEqual(entities);
  });

  it("round-trips an empty snapshot", () => {
    expect(
      encEntitySnapshot.decode(encEntitySnapshot.encode(new Map()))
    ).toEqual(new Map());
  });

  it("rejects an invalid entity id", () => {
    expect(encEntitySnapshot.guard(new Map([[-1, item]]))).toBe(false);
    expect(encEntitySnapshot.guard(new Map([[1.5, item]]))).toBe(false);
  });
});

describe("encRegionTiles", () => {
  it("round-trips a region", () => {
    expect(encRegionTiles.decode(encRegionTiles.encode(grass))).toEqual(grass);
    expect(encRegionTiles.decode(encRegionTiles.encode(checkerboard))).toEqual(
      checkerboard
    );
  });

  it("run-length encodes runs of the same tile", () => {
    // The fixedrle mode, then 256 grass tiles as a run of 255 and a run of 1.
    expect(encRegionTiles.encode(grass)).toEqual(
      Uint8Array.of(3, 255, 0, 1, 0)
    );
  });

  it("stores one byte per tile when no neighbours match", () => {
    // The fixed mode, then every tile.
    const encoded = encRegionTiles.encode(checkerboard);

    expect(encoded).toHaveLength(1 + REGION_TILE_COUNT);
    expect(encoded[0]).toBe(2);
  });

  it("rejects a region with the wrong number of tiles", () => {
    expect(encRegionTiles.guard({ tiles: grass.tiles.slice(1) })).toBe(false);
    expect(encRegionTiles.guard({ tiles: [...grass.tiles, "grass"] })).toBe(
      false
    );
  });

  it("rejects an unknown tile", () => {
    expect(encRegionTiles.guard({ tiles: grass.tiles.map(() => "lava") })).toBe(
      false
    );
  });
});

describe("encTerrainSnapshot", () => {
  it("round-trips regions keyed by id", () => {
    expect(
      encTerrainSnapshot.decode(encTerrainSnapshot.encode(terrain))
    ).toEqual(terrain);
  });

  it("round-trips an empty snapshot", () => {
    expect(
      encTerrainSnapshot.decode(encTerrainSnapshot.encode(new Map()))
    ).toEqual(new Map());
  });

  it("rejects a malformed region id", () => {
    expect(encTerrainSnapshot.guard(new Map([["0;0", grass]]))).toBe(false);
    expect(encTerrainSnapshot.guard(new Map([["01,0", grass]]))).toBe(false);
  });
});

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
  const init: ServerMessage = { type: "init", id: unsafeEntityId(7) };
  const entitiesMessage: ServerMessage = {
    type: "entities",
    snapshot: entities,
  };
  const terrainMessage: ServerMessage = { type: "terrain", snapshot: terrain };

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

  it("encodes an init message as a tag and a u32 id", () => {
    expect(encServerMessage.encode(init)).toEqual(Uint8Array.of(0, 7, 0, 0, 0));
    expect(encInitMessage.guard(init)).toBe(true);
  });

  it("has a guard per message kind", () => {
    expect(encEntitiesMessage.guard(entitiesMessage)).toBe(true);
    expect(encTerrainMessage.guard(terrainMessage)).toBe(true);
    expect(encEntitiesMessage.guard(terrainMessage)).toBe(false);
    expect(encTerrainMessage.guard(init)).toBe(false);
  });

  it("rejects an unknown tag and truncated messages", () => {
    expect(encServerMessage.decode(new Uint8Array([9]))).toBeUndefined();
    expect(encServerMessage.decode(new Uint8Array([0, 1]))).toBeUndefined();
  });
});
