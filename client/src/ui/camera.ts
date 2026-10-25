import { Vector } from "vectyped";

export interface Camera {
  center: Vector<2>;
  zoom: number;
}

const canvasHalfSize = ({ width, height }: HTMLCanvasElement): Vector<2> =>
  Vector.create(width, height).divide(2);

export const toCanvasCoords = (
  canvas: HTMLCanvasElement,
  camera: Camera,
  worldPos: Vector<2>
): Vector<2> =>
  worldPos
    .copy()
    .sub(camera.center)
    .multiply(2 ** camera.zoom)
    .add(canvasHalfSize(canvas));

export const fromCanvasCoords = (
  canvas: HTMLCanvasElement,
  camera: Camera,
  canvasPos: Vector<2>
): Vector<2> =>
  canvasPos
    .copy()
    .sub(canvasHalfSize(canvas))
    .divide(2 ** camera.zoom)
    .add(camera.center);
