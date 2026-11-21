import { tuple } from "niall-utils/core";
import { toElement } from "niall-utils/ui";

import { getAtlas } from "../render/atlas.ts";

/** The atlas sprites CSS 9-slices, each exposed as `--ui-<name>` (e.g. `--ui-panel`). */
const UI_SPRITES = tuple(
  "panel",
  "button",
  "button_hover",
  "button_down",
  "icon_inventory",
  "icon_fullscreen",
  "icon_windowed"
);

let painted = false;

/**
 * Cuts the interface sprites out of the atlas and exposes each as a CSS
 * variable holding an image URL, because `border-image` can only slice a whole
 * image, not part of a sheet. The atlas loads lazily, so this does nothing
 * until it has arrived, and only paints once.
 */
export const paintUiTextures = (): void => {
  if (painted) return;
  const atlas = getAtlas();
  if (atlas == null) return;
  painted = true;

  for (const name of UI_SPRITES) {
    const frame = atlas.sprites.get(`ui_${name}`)?.frames[0];
    if (frame == null) continue;

    const canvas = toElement("<canvas></canvas>");
    canvas.width = frame.width;
    canvas.height = frame.height;
    canvas.getContext("2d")?.drawImage(frame, 0, 0);
    document.documentElement.style.setProperty(
      `--ui-${name.replaceAll("_", "-")}`,
      `url("${canvas.toDataURL()}")`
    );
  }
};

/** Device pixels per art pixel the interface aims for (CSS pixels at 100% scale). */
const ART_PX_TARGET = 2;

const setArtScale = (): void => {
  const dpr = window.devicePixelRatio;
  // A whole number of device pixels per art pixel, so no art pixel is wider
  // than its neighbour. At a fractional display scale a fixed 2 CSS px would
  // be, say, 2.5 device px, and the art would come out uneven.
  const devicePx = Math.max(1, Math.round(ART_PX_TARGET * dpr));
  document.documentElement.style.setProperty("--art-px", `${devicePx / dpr}px`);
};

/**
 * Sets `--art-px`, the CSS size of one art pixel, and keeps it right when the
 * display scale or page zoom changes (both fire `resize`).
 */
export const setupUiScale = (): void => {
  setArtScale();
  window.addEventListener("resize", setArtScale);
};
