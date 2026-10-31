import { createPlayer, encMoveMessage, World } from "@colony-builder/shared";
import { describe, expect, it } from "vitest";

import { messageHandler } from "./handler.ts";

describe("messageHandler", () => {
  it("sets the destination of the player", () => {
    const world = new World();
    const player = createPlayer(world);

    messageHandler(world, player, encMoveMessage.create(3, 4));

    expect(world.get(player, "destination").toArray()).toEqual([3, 4]);
  });

  it("only affects the given player", () => {
    const world = new World();
    const player = createPlayer(world);
    const other = createPlayer(world);

    messageHandler(world, player, encMoveMessage.create(3, 4));

    expect(world.optGet(other, "destination")).toBeUndefined();
  });
});
