import { toElement } from "niall-utils";
import { Vector } from "vectyped";
import { describe, expect, it } from "vitest";

import { fromCanvasCoords, toCanvasCoords, type Camera } from "./camera.ts";

const canvas = toElement("<canvas></canvas>");
canvas.width = 100;
canvas.height = 50;

const camera = (zoom: number): Camera => ({
  center: Vector.create(10, 10),
  zoom,
});

describe("toCanvasCoords", () => {
  it("puts the camera centre in the middle of the canvas", () => {
    expect(
      toCanvasCoords(canvas, camera(0), Vector.create(10, 10)).toArray()
    ).toEqual([50, 25]);
  });

  it("offsets from the centre", () => {
    expect(
      toCanvasCoords(canvas, camera(0), Vector.create(11, 12)).toArray()
    ).toEqual([51, 27]);
  });

  it("scales offsets by two to the power of the zoom", () => {
    expect(
      toCanvasCoords(canvas, camera(1), Vector.create(11, 12)).toArray()
    ).toEqual([52, 29]);
    expect(
      toCanvasCoords(canvas, camera(-1), Vector.create(12, 14)).toArray()
    ).toEqual([51, 27]);
  });

  it("does not mutate its inputs", () => {
    const view = camera(1);
    const world = Vector.create(11, 12);

    toCanvasCoords(canvas, view, world);

    expect(view.center.toArray()).toEqual([10, 10]);
    expect(world.toArray()).toEqual([11, 12]);
  });
});

describe("fromCanvasCoords", () => {
  it("maps the canvas middle to the camera centre", () => {
    expect(
      fromCanvasCoords(canvas, camera(0), Vector.create(50, 25)).toArray()
    ).toEqual([10, 10]);
  });

  it("scales offsets by two to the power of the zoom", () => {
    expect(
      fromCanvasCoords(canvas, camera(1), Vector.create(52, 29)).toArray()
    ).toEqual([11, 12]);
  });

  it("does not mutate its inputs", () => {
    const view = camera(1);
    const screen = Vector.create(52, 29);

    fromCanvasCoords(canvas, view, screen);

    expect(view.center.toArray()).toEqual([10, 10]);
    expect(screen.toArray()).toEqual([52, 29]);
  });

  it("inverts toCanvasCoords", () => {
    const view = camera(2);
    const world = Vector.create(-3.5, 7.25);

    const screen = toCanvasCoords(canvas, view, world);

    expect(fromCanvasCoords(canvas, view, screen).toArray()).toEqual(
      world.toArray()
    );
  });
});
