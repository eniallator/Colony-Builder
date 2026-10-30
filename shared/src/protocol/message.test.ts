import { Vector } from "vectyped";
import { describe, expect, it } from "vitest";

import { unsafeEntityId } from "../entity/index.ts";
import {
  clientMessage,
  destinationMessage,
  entitySnapshot,
  initMessage,
  serverMessage,
  snapshotMessage,
  worldSnapshot,
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

describe("entitySnapshot", () => {
  it("round-trips an entity with every field", () => {
    expect(entitySnapshot.decode(entitySnapshot.encode(player))).toEqual(
      player
    );
  });

  it("round-trips an entity without its optional fields", () => {
    expect(entitySnapshot.decode(entitySnapshot.encode(item))).toEqual(item);
  });

  it("rejects non-finite numbers when decoding", () => {
    const nan = entitySnapshot.encode({
      ...item,
      position: Vector.create(Number.NaN, 0),
    });
    const infinite = entitySnapshot.encode({ ...item, speed: Infinity });

    expect(entitySnapshot.decode(nan)).toBeUndefined();
    expect(entitySnapshot.decode(infinite)).toBeUndefined();
  });

  it("rejects an invalid entity id", () => {
    expect(entitySnapshot.guard({ ...item, id: -1 })).toBe(false);
    expect(entitySnapshot.guard({ ...item, id: 1.5 })).toBe(false);
  });

  it("rejects an unknown entity type", () => {
    expect(entitySnapshot.guard({ ...item, type: "dragon" })).toBe(false);
  });
});

describe("worldSnapshot", () => {
  it("round-trips a list of entities", () => {
    const snapshot = { entities: [player, item] };

    expect(worldSnapshot.decode(worldSnapshot.encode(snapshot))).toEqual(
      snapshot
    );
  });

  it("round-trips an empty world", () => {
    expect(
      worldSnapshot.decode(worldSnapshot.encode({ entities: [] }))
    ).toEqual({ entities: [] });
  });

  it("creates a snapshot from its entities", () => {
    expect(worldSnapshot.create([item])).toEqual({ entities: [item] });
  });
});

describe("clientMessage", () => {
  it("creates and round-trips a destination message", () => {
    const message = destinationMessage.create(10, 20);

    expect(message).toEqual({
      type: "destination",
      position: Vector.create(10, 20),
    });
    expect(clientMessage.decode(clientMessage.encode(message))).toEqual(
      message
    );
  });

  it("rejects bytes that are not a client message", () => {
    expect(clientMessage.decode(new Uint8Array([1]))).toBeUndefined();
    expect(clientMessage.decode(new Uint8Array())).toBeUndefined();
  });
});

describe("serverMessage", () => {
  it("creates and round-trips an init message", () => {
    const message = initMessage.create(unsafeEntityId(7));

    expect(message).toEqual({ type: "init", id: 7 });
    expect(serverMessage.decode(serverMessage.encode(message))).toEqual(
      message
    );
  });

  it("creates and round-trips a snapshot message", () => {
    const message = snapshotMessage.create({ entities: [player, item] });

    expect(message.type).toBe("snapshot");
    expect(serverMessage.decode(serverMessage.encode(message))).toEqual(
      message
    );
  });

  it("distinguishes message kinds by their tag", () => {
    const init = serverMessage.encode(initMessage.create(unsafeEntityId(0)));
    const snapshot = serverMessage.encode(
      snapshotMessage.create({ entities: [] })
    );

    expect(init[0]).toBe(0);
    expect(snapshot[0]).toBe(1);
  });

  it("rejects an unknown tag and truncated messages", () => {
    expect(serverMessage.decode(new Uint8Array([9]))).toBeUndefined();
    expect(serverMessage.decode(new Uint8Array([0, 1]))).toBeUndefined();
  });
});
