import {
  predictionSystems,
  type EntityId,
  type System,
} from "@colony-builder/shared";

import { prepareDraw, renderSystem } from "./render/system.ts";
import type { Camera } from "./ui/camera.ts";
import type { Time } from "./ui/types.ts";

export type ClientSystem = System<{
  playerId?: EntityId;
  time: Time;
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  camera: Camera;
}>;

export const clientSystems: ClientSystem[] = [
  ...predictionSystems,
  prepareDraw,
  renderSystem,
];
