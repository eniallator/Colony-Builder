// Interface boxes. Each is a 16x16 outlined box meant to be 9-sliced by CSS
// `border-image` (3px corners, stretched edges and centre), so one tile makes a
// panel or button of any size. The client cuts them out of the atlas at runtime
// (client/src/ui/ui-textures.ts) and exposes them as `--ui-<name>` variables.

import { blank, fromAscii, put, roundBox, type Point } from "../core.ts";
import { PALETTE } from "../palette.ts";
import { still } from "./define.ts";

const CORNERS: Point[] = [
  [0, 0],
  [15, 0],
  [0, 15],
  [15, 15],
];

const box = ({ fill, hi, lo }: { fill: string; hi: string; lo: string }) => {
  const s = blank();
  roundBox(s, 0, 0, 16, 16, { fillC: fill, hi, lo, outline: PALETTE.outline });
  // `roundBox` leaves the corner pixels out. Drawn at 2x each is a visible 2x2
  // notch, so UI boxes fill them with the outline instead.
  for (const [x, y] of CORNERS) put(s, x, y, PALETTE.outline);
  return s;
};

const { panel, button, buttonHover } = PALETTE.ui;

const BLANK_ROW = ".".repeat(16);

// Button glyphs. They sit in the middle 12px of the tile (the CSS crops to it),
// so `centred` pads the rows to 16. O outline, t light, m shade.
const blankRows = (count: number) =>
  Array.from({ length: count }, () => BLANK_ROW);
const icon = (name: string, rows: readonly string[]) => {
  const top = Math.floor((16 - rows.length) / 2);
  return still(
    `ui_icon_${name}`,
    fromAscii(
      [...blankRows(top), ...rows, ...blankRows(16 - top - rows.length)],
      { O: PALETTE.outline, t: PALETTE.ui.text, m: PALETTE.ui.panel.hi }
    )
  );
};

export const ui = [
  icon("inventory", [
    "...OOOOOOOOOO...",
    "..OttttttttttO..",
    "..OttttttttttO..",
    "..OOOOOOOOOOOO..",
    "..OmmmmOOOmmmO..",
    "..OmmmmOtOmmmO..",
    "..OmmmmmmmmmmO..",
    "..OmmmmmmmmmmO..",
    "..OOOOOOOOOOOO..",
  ]),
  // Corners pointing out: go fullscreen.
  icon("fullscreen", [
    "...tttt..tttt...",
    "...t........t...",
    "...t........t...",
    "...t........t...",
    "................",
    "................",
    "...t........t...",
    "...t........t...",
    "...t........t...",
    "...tttt..tttt...",
  ]),
  // Corners pointing in: leave it.
  icon("windowed", [
    "......t..t......",
    "......t..t......",
    "......t..t......",
    "...tttt..tttt...",
    "................",
    "................",
    "...tttt..tttt...",
    "......t..t......",
    "......t..t......",
    "......t..t......",
  ]),
  still("ui_panel", box(panel)),
  still("ui_button", box(button)),
  still("ui_button_hover", box(buttonHover)),
  // Pressed: the lighting is flipped so the button looks pushed in.
  still("ui_button_down", box({ ...button, hi: button.lo, lo: button.hi })),
];
