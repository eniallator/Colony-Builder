import {
  predictionSystems,
  type ClientMessage,
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
import type { ClickDetails } from "./ui/clickable.ts";
import { renderInventoryDialog } from "./ui/inventory.ts";
import type { Keyboard } from "./ui/keyboard.ts";
import type { Mouse } from "./ui/mouse.ts";
import type { Stateful } from "./ui/types.ts";

export type ClientSystem = System<{
  playerId?: EntityId;
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  camera: Camera;
  inventoryId?: EntityId;
  clickDetails: Stateful<ClickDetails | null>;
  send: (message: ClientMessage) => void;
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
