import { Vector } from "vectyped";
import { describe, expect, it } from "vitest";

import { unsafeEntityId } from "../entity/index.ts";
import {
  encClientMessage,
  encComponentSnapshot,
  encEntitySnapshot,
  encInitMessage,
  encMoveMessage,
  encServerMessage,
  encSnapshotMessage,
  encWorldSnapshot,
  type ComponentSnapshot,
  type EntitySnapshot,
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

  it("rejects an invalid entity id", () => {
    expect(encEntitySnapshot.guard({ "-1": item })).toBe(false);
    expect(encEntitySnapshot.guard({ "1.5": item })).toBe(false);
  });
});

describe("encWorldSnapshot", () => {
  it("round-trips a record of entities", () => {
    const snapshot = { entities, terrain: new Map() };

    expect(encWorldSnapshot.decode(encWorldSnapshot.encode(snapshot))).toEqual(
      snapshot
    );
  });

  it("round-trips an empty world", () => {
    const empty = { entities: new Map(), terrain: new Map() };

    expect(encWorldSnapshot.decode(encWorldSnapshot.encode(empty))).toEqual(
      empty
    );
  });

  it("creates a snapshot from its entities and terrain", () => {
    const items: EntitySnapshot = new Map([[itemId, item]]);

    expect(encWorldSnapshot.create(items, new Map())).toEqual({
      entities: items,
      terrain: new Map(),
    });
  });
});

describe("encClientMessage", () => {
  it("creates and round-trips a move message", () => {
    const message = encMoveMessage.create(10, 20);

    expect(message).toEqual({
      type: "move",
      position: Vector.create(10, 20),
    });
    expect(encClientMessage.decode(encClientMessage.encode(message))).toEqual(
      message
    );
  });

  it("rejects bytes that are not a client message", () => {
    expect(encClientMessage.decode(new Uint8Array([1]))).toBeUndefined();
    expect(encClientMessage.decode(new Uint8Array())).toBeUndefined();
  });
});

describe("encServerMessage", () => {
  it("creates and round-trips an init message", () => {
    const message = encInitMessage.create(unsafeEntityId(7));

    expect(message).toEqual({ type: "init", id: 7 });
    expect(encServerMessage.decode(encServerMessage.encode(message))).toEqual(
      message
    );
  });

  it("creates and round-trips a snapshot message", () => {
    const message = encSnapshotMessage.create({ entities, terrain: new Map() });

    expect(message.type).toBe("snapshot");
    expect(encServerMessage.decode(encServerMessage.encode(message))).toEqual(
      message
    );
  });

  it("distinguishes message kinds by their tag", () => {
    const init = encServerMessage.encode(
      encInitMessage.create(unsafeEntityId(0))
    );
    const snapshot = encServerMessage.encode(
      encSnapshotMessage.create({ entities: new Map(), terrain: new Map() })
    );

    expect(init[0]).toBe(0);
    expect(snapshot[0]).toBe(1);
  });

  it("rejects an unknown tag and truncated messages", () => {
    expect(encServerMessage.decode(new Uint8Array([9]))).toBeUndefined();
    expect(encServerMessage.decode(new Uint8Array([0, 1]))).toBeUndefined();
  });
});
