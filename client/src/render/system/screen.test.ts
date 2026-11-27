import { Vector } from "vectyped";
import { describe, expect, it } from "vitest";

import { CANVAS_SIZE, createSystemArgs } from "./render-test-utils.ts";
import { screenOrigin } from "./screen.ts";

describe("screenOrigin", () => {
  const [width, height] = CANVAS_SIZE;
  const { canvas } = createSystemArgs();

  it("is the middle of the canvas when the camera is centred on the origin", () => {
    const camera = { center: Vector.zero(2), zoom: 0 };

    expect(screenOrigin(canvas, camera).toArray()).toEqual([
      width / 2,
      height / 2,
    ]);
  });

  it("moves away from the camera by the zoom, to a whole pixel", () => {
    const zoom = 2;
    const center = Vector.create(1.1, -0.3);
    const camera = { center, zoom };

    expect(screenOrigin(canvas, camera).toArray()).toEqual([
      Math.round(width / 2 - center.x() * 2 ** zoom),
      Math.round(height / 2 - center.y() * 2 ** zoom),
    ]);
  });
});
