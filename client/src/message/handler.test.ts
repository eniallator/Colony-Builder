import {
  createItem,
  createPlayer,
  EntityStore,
  initMessage,
  snapshotMessage,
  unsafeEntityId,
  World,
} from "@colony-builder/shared";
import { Vector } from "vectyped";
import { describe, expect, it } from "vitest";

import type { State } from "../state.ts";
import { messageHandler } from "./handler.ts";

const createState = (): State => ({
  camera: { center: Vector.zero(2), zoom: 0 },
  store: new EntityStore(),
});

describe("messageHandler", () => {
  it("stores the player id from an init message", () => {
    const state = createState();

    messageHandler(state, initMessage.create(unsafeEntityId(3)));

    expect(state.playerId).toBe(3);
  });

  it("applies the entities from a snapshot message", () => {
    const server = new World();
    const player = createPlayer(server, Vector.create(1, 2));
    const item = createItem(server, Vector.create(3, 4));
    const state = createState();

    messageHandler(state, snapshotMessage.create(server.takeSnapshot()));

    expect(state.store.get(player, "position").toArray()).toEqual([1, 2]);
    expect(state.store.get(item, "position").toArray()).toEqual([3, 4]);
    expect(state.playerId).toBeUndefined();
  });

  it("throws on a message it does not know", () => {
    expect(() => {
      // @ts-expect-error the message type is not part of the protocol
      messageHandler(createState(), { type: "unknown" });
    }).toThrow("Value not exhausted");
  });
});
