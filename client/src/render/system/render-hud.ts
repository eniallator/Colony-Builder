import type { World } from "@colony-builder/shared";
import { memoize } from "niall-utils/data";
import { addListener, toElement } from "niall-utils/ui";
import { Vector } from "vectyped";

import type { ClientSystem } from "../../system.ts";
import { toCanvasCoords } from "../../ui/camera.ts";
import {
  actionFor,
  isSameTarget,
  type ClickableAction,
  type ClickableTarget,
} from "../../ui/clickable.ts";

type SelectAction = Extract<ClickableAction, { type: "Select" }>;

interface Shown {
  target: ClickableTarget;
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

/** Where `target` stands in the world, or undefined if it no longer exists. */
const worldPosOf = (
  world: World,
  target: ClickableTarget
): Vector<2> | undefined => {
  if (target.length === 2) return world.entities.optGet(target[1], "position");

  const worldPos = world.structures.optGetStructure(
    target[1],
    target[2]
  )?.worldPos;
  return worldPos != null ? Vector.create(...worldPos) : undefined;
};

const createPopover = ({ options, run }: SelectAction): HTMLElement => {
  const popover = toElement(
    '<div class="click-popover" popover="manual"></div>'
  );

  for (const { label, value } of options) {
    const button = toElement(
      '<button type="button" class="secondary"></button>'
    );
    button.textContent = label;
    addListener(button, "click", () => {
      run(value);
      finish();
    });
    popover.append(button);
  }
  return popover;
};

const showPopover = (
  target: ClickableTarget,
  action: SelectAction,
  onFinished: () => void
): Shown => {
  listenForDismissal();

  const popover = createPopover(action);
  document.body.append(popover);
  popover.showPopover();
  return { target, popover, onFinished };
};

/**
 * Acts on the `clickTarget`: a callback runs straight away, while a select
 * opens a popover of its options that follows the target around the screen.
 * The `clickTarget` is cleared once the click is finished: the callback has
 * run, an option was picked, the popover was dismissed, or the target moved off
 * the screen (or no longer exists).
 */
export const renderHUD: ClientSystem = ({
  canvas,
  camera,
  world,
  clickTarget,
  clickHandlers,
}) => {
  const target = clickTarget.value;
  if (target == null) {
    dismiss();
    return;
  }

  const action = actionFor(clickHandlers, target);
  if (action?.type !== "Select") {
    dismiss();
    action?.run();
    clickTarget.setValue(null);
    return;
  }

  const worldPos = worldPosOf(world, target);
  const foot =
    worldPos != null ? toCanvasCoords(canvas, camera, worldPos) : undefined;
  if (!foot?.inBounds([canvas.width, canvas.height])) {
    dismiss();
    clickTarget.setValue(null);
    return;
  }

  if (shown == null || !isSameTarget(shown.target, target)) {
    dismiss();
    shown = showPopover(target, action, () => {
      clickTarget.setValue(null);
    });
  }

  shown.popover.style.left = `${Math.round(foot.x())}px`;
  shown.popover.style.top = `${Math.round(foot.y())}px`;
};
