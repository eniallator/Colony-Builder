import {
  predictionSystems,
  type EntityId,
  type SystemContext,
} from "@colony-builder/shared";

import { prepareDraw, renderSystem } from "./render/system.ts";
import type { Camera } from "./ui/camera.ts";
import type { Time } from "./ui/types.ts";

export interface ClientSystemContext extends SystemContext {
  playerId?: EntityId;
  time: Time;
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  camera: Camera;
}

export type ClientSystem = (ctx: ClientSystemContext) => void;

export const clientSystems: ClientSystem[] = [
  ...predictionSystems,
  prepareDraw,
  renderSystem,
];
