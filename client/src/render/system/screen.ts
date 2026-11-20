import { Vector } from "vectyped";

import { toCanvasCoords, type Camera } from "../../ui/camera.ts";

/** Where the world origin is on the canvas, rounded to a whole pixel. */
export const screenOrigin = (
  canvas: HTMLCanvasElement,
  camera: Camera
): Vector<2> => toCanvasCoords(canvas, camera, Vector.zero(2)).round();
