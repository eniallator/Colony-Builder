import type { ClientMessage, World } from "@colony-builder/shared";
import { checkExhausted } from "niall-utils";
import { memoize } from "niall-utils/data";
import { clamp } from "niall-utils/math";
import { addListener, toElement } from "niall-utils/ui";
import { Vector } from "vectyped";

import type { ClientSystem } from "../../system.ts";
import { toCanvasCoords, type Camera } from "../../ui/camera.ts";
import {
  clickableCallback,
  clickableSelect,
  type AnyClickableSelect,
  type ClickableTarget,
  type ClickDetails,
} from "../../ui/clickable.ts";
import { paintUiTextures } from "../../ui/ui-textures.ts";
import { getAtlas } from "../atlas.ts";
import { usesTextures } from "../sprite.ts";
import { spriteRect } from "./painter.ts";

interface Shown {
  /** The click this popover belongs to. */
  details: ClickDetails;
  popover: HTMLElement;
  /** Runs once the popover has been dismissed, whatever the reason. */
  onFinished: () => void;
}

/** The popover on screen, if any. At most one exists at a time. */
let shown: Shown | null = null;

const dismiss = () => {
  shown?.popover.remove();
  shown = null;
};

/** Dismisses the popover on screen and tells its owner the click is finished. */
const finish = () => {
  const onFinished = shown?.onFinished;
  dismiss();
  onFinished?.();
};

/**
 * Dismisses the popover on a pointer press anywhere outside it, or on Escape.
 * The popover is manual (not light-dismissing) so that the press which opened
 * it is not also what closes it. Set up once; the listeners act on whatever
 * popover is shown.
 */
const listenForDismissal = memoize(() => {
  addListener(document.body, "pointerdown", ({ target }) => {
    if (!(target instanceof Node && shown?.popover.contains(target))) finish();
  });
  addListener(document.body, "keydown", ({ code }) => {
    if (code === "Escape") finish();
  });
});

const footPosOf = (
  world: World,
  target: ClickableTarget
): Vector<2> | undefined => {
  switch (target.domain) {
    case "entity":
      return world.entities.optGet(target.id, "position");

    case "structure": {
      const worldPos = world.structures.optGetStructure(
        target.regionId,
        target.subRegionId
      )?.worldPos;
      return worldPos != null ? Vector.create(...worldPos) : undefined;
    }

    default:
      return checkExhausted(target);
  }
};

const createPopover = (select: AnyClickableSelect): HTMLElement => {
  const popover = toElement(
    `<div class="click-popover" popover="manual"><div class="click-popover-title">${select.title}</div></div>`
  );

  for (const { label, value } of select.options) {
    const button = toElement('<button type="button"></button>');
    button.textContent = label;
    addListener(button, "click", () => {
      select.onSelect(value);
      finish();
    });
    popover.append(button);
  }
  return popover;
};

const showPopover = (
  details: ClickDetails,
  select: AnyClickableSelect,
  onFinished: () => void
): Shown => {
  listenForDismissal();

  const popover = createPopover(select);
  document.body.append(popover);
  popover.showPopover();
  return { details, popover, onFinished };
};

/**
 * Whether any part of `target` is on the canvas. A structure counts by its whole
 * sprite, so a tall one stays while its top is in view after its base has
 * scrolled off. Anything else, or any target before the atlas has loaded, counts
 * by its foot.
 */
const isOnScreen = (
  canvas: HTMLCanvasElement,
  camera: Camera,
  target: ClickableTarget | null,
  foot: Vector<2>
): boolean => {
  const atlas = getAtlas();
  const sprite =
    target?.domain === "structure"
      ? atlas?.sprites.get(target.type)
      : undefined;
  if (atlas == null || sprite == null) {
    return foot.inBounds([canvas.width, canvas.height]);
  }

  const pxPerTile = 2 ** camera.zoom;
  const { topLeft, dimensions } = spriteRect(
    { atlas, textured: usesTextures(pxPerTile) },
    sprite,
    foot,
    pxPerTile
  );
  const bottomRight = topLeft.copy().add(dimensions);
  return (
    bottomRight.x() > 0 &&
    bottomRight.y() > 0 &&
    topLeft.x() < canvas.width &&
    topLeft.y() < canvas.height
  );
};

const POPOVER_GAP_PX = 8;

/**
 * The top left corner for a popover of `size` belonging to a target standing at
 * `foot`: centred below it, or above it when there is no room below, and never
 * outside the canvas.
 */
const popoverPosOf = (
  foot: Vector<2>,
  size: Vector<2>,
  canvas: HTMLCanvasElement
): Vector<2> => {
  const below = foot.y() + POPOVER_GAP_PX;
  const fitsBelow = below + size.y() <= canvas.height;
  return Vector.create(
    clamp(foot.x() - size.x() / 2, 0, Math.max(0, canvas.width - size.x())),
    clamp(
      fitsBelow ? below : foot.y() - POPOVER_GAP_PX - size.y(),
      0,
      Math.max(0, canvas.height - size.y())
    )
  ).round();
};

const terrainRunFor = (
  worldPos: Vector<2>,
  world: World,
  send: (message: ClientMessage) => void
) => {
  const tile = world.terrain.optTileAt(worldPos.x(), worldPos.y());
  if (tile == null) return null;

  switch (tile) {
    case "iron_deposit":
    case "copper_deposit":
      return clickableSelect(
        tile === "iron_deposit" ? "Iron Deposit" : "Copper Deposit",
        [{ label: "Gather", value: worldPos }],
        position => {
          send({ type: "gatherTile", position });
        }
      );

    case "grass":
    case "swampland":
    case "jungle":
    case "water":
    case "sand":
    case "stone":
    default:
      return null;
  }
};

const targetRunFor = (
  target: ClickableTarget,
  send: (message: ClientMessage) => void
) => {
  switch (target.domain) {
    case "entity":
      return clickableCallback(() => {
        console.log(target.type, target.id);
      });

    case "structure":
      return clickableSelect(
        target.type,
        [
          {
            label: "Gather",
            value: {
              regionId: target.regionId,
              subRegionId: target.subRegionId,
            },
          },
        ],
        value => {
          send({ type: "gatherStructure", ...value });
        }
      );

    default:
      return checkExhausted(target);
  }
};

export const renderHUD: ClientSystem = ({
  canvas,
  camera,
  clickDetails,
  world,
  send,
}) => {
  // The buttons and dialog use these too, so paint them as soon as the atlas
  // arrives, not when the first popover opens.
  paintUiTextures();

  const details = clickDetails.value;
  const run =
    details == null
      ? null
      : details.target != null
        ? targetRunFor(details.target, send)
        : terrainRunFor(details.worldPos, world, send);

  if (details == null || run == null) {
    dismiss();
    return;
  }

  if (run.type !== "select") {
    dismiss();
    run.onClick();
    clickDetails.setValue(null);
    return;
  }

  // A target stands where it is now; a terrain click stays where it landed.
  const worldPos =
    details.target != null
      ? footPosOf(world, details.target)
      : details.worldPos;
  const foot =
    worldPos != null ? toCanvasCoords(canvas, camera, worldPos) : null;
  if (foot == null || !isOnScreen(canvas, camera, details.target, foot)) {
    dismiss();
    clickDetails.setValue(null);
    return;
  }

  // Every click makes a new `details`, so this is one popover per click.
  if (shown?.details !== details) {
    dismiss();
    shown = showPopover(details, run, () => {
      clickDetails.setValue(null);
    });
  }

  const [left, top] = popoverPosOf(
    foot,
    Vector.create(shown.popover.offsetWidth, shown.popover.offsetHeight),
    canvas
  ).toArray();
  shown.popover.style.left = `${left}px`;
  shown.popover.style.top = `${top}px`;
};
