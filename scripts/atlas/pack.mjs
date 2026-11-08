import { mkdirSync, writeFileSync } from "node:fs";

import { TILE } from "./core.mjs";
import { blit, encodePng } from "./png.mjs";

export const COLUMNS = 16;
export const OUT_DIR = new URL(
  "../../client/public/textures/",
  import.meta.url
);

/**
 * Packs sprites left to right, top to bottom. A sprite's frames never wrap
 * across rows, and the atlas grows downwards as needed - there is no fixed cap.
 * Returns `{ name: [[col, row], ...] }` (one cell per frame/variant).
 */
export const layout = sprites => {
  let col = 0;
  let row = 0;
  const cells = {};
  for (const { name, frames } of sprites) {
    if (frames.length > COLUMNS)
      throw new Error(
        `"${name}" has ${frames.length} frames; max is ${COLUMNS}`
      );
    if (col + frames.length > COLUMNS) {
      col = 0;
      row++;
    }
    cells[name] = frames.map((_, i) => [col + i, row]);
    col += frames.length;
  }
  return { cells, rows: row + 1 };
};

/**
 * Mean colour of a sprite's visible pixels across all its frames/variants, as
 * `#rrggbb`. The renderer draws this flat colour instead of the texture when a
 * tile is smaller than 16px on screen (zoomed out), where minifying the art
 * would only shimmer. Averaged in sRGB, which matches how a box-filter
 * downscale looks; pixels are weighted by alpha so transparent areas of
 * items and entities don't dilute it.
 */
const averageColour = frames => {
  const sum = [0, 0, 0];
  let weight = 0;
  for (const frame of frames) {
    for (let i = 0; i < frame.length; i += 4) {
      const alpha = frame[i + 3];
      for (let c = 0; c < 3; c++) sum[c] += frame[i + c] * alpha;
      weight += alpha;
    }
  }
  if (weight === 0) return "#000000";
  return `#${sum
    .map(v =>
      Math.round(v / weight)
        .toString(16)
        .padStart(2, "0")
    )
    .join("")}`;
};

export const writeAtlas = sprites => {
  const { cells, rows } = layout(sprites);
  const width = COLUMNS * TILE;
  const height = rows * TILE;
  const pixels = new Uint8Array(width * height * 4);
  for (const { name, frames } of sprites) {
    frames.forEach((frame, i) => {
      const [col, row] = cells[name][i];
      blit(pixels, width, frame, col * TILE, row * TILE, { copy: true });
    });
  }
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    new URL("atlas.png", OUT_DIR),
    encodePng(width, height, pixels)
  );
  // atlas.json: `sprites[name] = { mode, cells: [[col, row], ...], colour: "#rrggbb" }`
  const described = Object.fromEntries(
    // `mode`: "variants" = pick one per tile; "frames" = animation (or a single
    // frame). Sprites that don't say are "frames".
    sprites.map(({ name, frames, mode = "frames" }) => [
      name,
      { mode, cells: cells[name], colour: averageColour(frames) },
    ])
  );
  writeFileSync(
    new URL("atlas.json", OUT_DIR),
    JSON.stringify(
      { tileSize: TILE, columns: COLUMNS, sprites: described },
      null,
      2
    ) + "\n"
  );
  return { cells, rows };
};
