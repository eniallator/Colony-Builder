import { createPlayer, unsafeEntityId, World } from "@colony-builder/shared";
import { Vector } from "vectyped";
import { describe, expect, it } from "vitest";

import { prepareRender } from "./prepare-render.ts";
import { createFakeContext, createSystemArgs } from "./render-test-utils.ts";

describe("prepareRender", () => {
  const start = Vector.create(9, 9);

  it("centres the camera on the player", () => {
    const world = new World();
    const position = Vector.create(3, 4);
    const playerId = createPlayer(world, position);
    const args = createSystemArgs({
      world,
      playerId,
      camera: { center: start.copy(), zoom: 0 },
    });

    prepareRender(args);

    expect(args.camera.center.toArray()).toEqual(position.toArray());
  });

  it("leaves the camera where it is without a player", () => {
    const args = createSystemArgs({
      camera: { center: start.copy(), zoom: 0 },
    });

    prepareRender(args);

    expect(args.camera.center.toArray()).toEqual(start.toArray());
  });

  it("leaves the camera where it is when the player has no position", () => {
    const args = createSystemArgs({
      playerId: unsafeEntityId(0),
      camera: { center: start.copy(), zoom: 0 },
    });

    prepareRender(args);

    expect(args.camera.center.toArray()).toEqual(start.toArray());
  });

  it("paints the whole canvas white", () => {
    const { ctx, painted } = createFakeContext();
    const args = createSystemArgs({ ctx });

    prepareRender(args);

    expect(painted).toEqual([
      {
        style: "white",
        shape: [0, 0, args.canvas.width, args.canvas.height],
      },
    ]);
  });
});
