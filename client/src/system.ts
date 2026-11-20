import {
  predictionSystems,
  type EntityId,
  type System,
} from "@colony-builder/shared";

import {
  prepareRender,
  renderAboveGround,
  renderHUD,
  renderTiles,
} from "./render/system/index.ts";
import type { Camera } from "./ui/camera.ts";
import type { ClickableHandlers, ClickableTarget } from "./ui/clickable.ts";
import { renderInventoryDialog } from "./ui/inventory.ts";
import type { Keyboard } from "./ui/keyboard.ts";
import type { Mouse } from "./ui/mouse.ts";
import type { Stateful, Time } from "./ui/types.ts";

export type ClientSystem = System<{
  playerId?: EntityId;
  time: Time;
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  camera: Camera;
  inventoryId?: EntityId;
  clickTarget: Stateful<ClickableTarget | null>;
  clickHandlers: Partial<ClickableHandlers>;
  mouse: Mouse;
  keyboard: Keyboard;
}>;

export const clientSystems: ClientSystem[] = [
  ...predictionSystems(),
  prepareRender,
  renderTiles,
  renderAboveGround,
  renderHUD,
  renderInventoryDialog,
];
