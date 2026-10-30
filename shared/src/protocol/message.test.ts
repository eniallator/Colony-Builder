import { Vector } from "vectyped";
import { describe, expect, it } from "vitest";

import { unsafeEntityId } from "../entity/index.ts";
import {
  encClientMessage,
  encDestinationMessage,
  encEntitySnapshot,
  encInitMessage,
  encServerMessage,
  encSnapshotMessage,
  encWorldSnapshot,
  type EntitySnapshot,
} from "./message.ts";

const player: EntitySnapshot = {
  id: unsafeEntityId(1),
  type: "player",
  position: Vector.create(1.5, -2.25),
  destination: Vector.create(4, 8),
  speed: 3,
  conveyable: undefined,
};

const item: EntitySnapshot = {
  id: unsafeEntityId(2),
  type: "item",
  position: Vector.create(0, 0),
  destination: undefined,
  speed: undefined,
  conveyable: true,
};

describe("encEntitySnapshot", () => {
  it("round-trips an entity with every field", () => {
    expect(encEntitySnapshot.decode(encEntitySnapshot.encode(player))).toEqual(
      player
    );
  });

  it("round-trips an entity without its optional fields", () => {
    expect(encEntitySnapshot.decode(encEntitySnapshot.encode(item))).toEqual(
      item
    );
  });

  it("rejects non-finite numbers when decoding", () => {
    const nan = encEntitySnapshot.encode({
      ...item,
      position: Vector.create(Number.NaN, 0),
    });
    const infinite = encEntitySnapshot.encode({ ...item, speed: Infinity });

    expect(encEntitySnapshot.decode(nan)).toBeUndefined();
    expect(encEntitySnapshot.decode(infinite)).toBeUndefined();
  });

  it("rejects an invalid entity id", () => {
    expect(encEntitySnapshot.guard({ ...item, id: -1 })).toBe(false);
    expect(encEntitySnapshot.guard({ ...item, id: 1.5 })).toBe(false);
  });

  it("rejects an unknown entity type", () => {
    expect(encEntitySnapshot.guard({ ...item, type: "dragon" })).toBe(false);
  });
});

describe("encWorldSnapshot", () => {
  it("round-trips a list of entities", () => {
    const snapshot = { entities: [player, item] };

    expect(encWorldSnapshot.decode(encWorldSnapshot.encode(snapshot))).toEqual(
      snapshot
    );
  });

  it("round-trips an empty world", () => {
    expect(
      encWorldSnapshot.decode(encWorldSnapshot.encode({ entities: [] }))
    ).toEqual({ entities: [] });
  });

  it("creates a snapshot from its entities", () => {
    expect(encWorldSnapshot.create([item])).toEqual({ entities: [item] });
  });
});

describe("encClientMessage", () => {
  it("creates and round-trips a destination message", () => {
    const message = encDestinationMessage.create(10, 20);

    expect(message).toEqual({
      type: "destination",
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
    const message = encSnapshotMessage.create({ entities: [player, item] });

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
      encSnapshotMessage.create({ entities: [] })
    );

    expect(init[0]).toBe(0);
    expect(snapshot[0]).toBe(1);
  });

  it("rejects an unknown tag and truncated messages", () => {
    expect(encServerMessage.decode(new Uint8Array([9]))).toBeUndefined();
    expect(encServerMessage.decode(new Uint8Array([0, 1]))).toBeUndefined();
  });
});
