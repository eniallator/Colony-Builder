import { mkdirSync, writeFileSync } from "node:fs";
import type { TypeFromGuard } from "deep-guards";
import { raise } from "niall-utils/core";

import type { Cell, isAtlasJson } from "../../client/src/render/atlas.ts";
import { byteAt, TILE, tilesTall, type Pixels } from "./core.ts";
import { blit, encodePng } from "./png.ts";
import type { Sprite } from "./sprites/define.ts";

/** What `atlas.json` holds, as the client checks it. */
type AtlasJson = TypeFromGuard<typeof isAtlasJson>;

export const COLUMNS = 16;
export const OUT_DIR = new URL(
  "../../client/public/textures/",
  import.meta.url
);

/** How many tiles tall a sprite is (all of its frames are the same height). */
const heightOf = ({ name, frames }: Sprite): number => {
  const [tall, ...rest] = frames.map(tilesTall);
  if (
    tall == null ||
    !Number.isInteger(tall) ||
    rest.some(other => other !== tall)
  )
    throw new Error(
      `"${name}" frames must all be 16px wide and a whole number of tiles tall`
    );
  return tall;
};

/**
 * Packs sprites left to right, top to bottom. A sprite's frames never wrap
 * across rows, and the atlas grows downwards as needed - there is no fixed cap.
 * Single-tile sprites come first, in order, then taller ones in bands of rows
 * that fit the tallest sprite in the band. A cell is the top of a frame, so a
 * tall sprite's cell is followed by the cells beneath it.
 * Returns `{ name: [[col, row], ...] }` (one cell per frame/variant).
 */
export const layout = (
  sprites: readonly Sprite[]
): { cells: Record<string, Cell[]>; rows: number } => {
  let col = 0;
  let row = 0;
  let bandRows = 1;
  const cells: Record<string, Cell[]> = {};
  const place = (sprite: Sprite) => {
    const { name, frames } = sprite;
    const tall = heightOf(sprite);
    if (frames.length > COLUMNS)
      throw new Error(
        `"${name}" has ${frames.length} frames; max is ${COLUMNS}`
      );
    if (col + frames.length > COLUMNS) {
      col = 0;
      row += bandRows;
      bandRows = 1;
    }
    cells[name] = frames.map((_, i): Cell => [col + i, row]);
    col += frames.length;
    bandRows = Math.max(bandRows, tall);
  };

  const isTall = (sprite: Sprite) => heightOf(sprite) > 1;
  sprites.filter(sprite => !isTall(sprite)).forEach(place);
  // Taller sprites start a fresh band so they never overlap the rows above.
  col = COLUMNS;
  sprites.filter(isTall).forEach(place);
  return { cells, rows: row + bandRows };
};

/**
 * Mean colour of a sprite's visible pixels across all its frames/variants, as
 * `#rrggbb`. The renderer draws this flat colour instead of the texture when a
 * tile is smaller than 8px on screen (zoomed far out). Averaged in sRGB, which
 * matches how a box-filter downscale looks; pixels are weighted by alpha so
 * transparent areas of items and entities don't dilute it.
 */
export const averageColour = (frames: readonly Pixels[]): string => {
  const sum: [r: number, g: number, b: number] = [0, 0, 0];
  let weight = 0;
  for (const frame of frames) {
    for (let i = 0; i < frame.length; i += 4) {
      const alpha = byteAt(frame, i + 3);
      for (const c of [0, 1, 2] as const) {
        sum[c] += byteAt(frame, i + c) * alpha;
      }
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

/**
 * The pixel line (counted down from the top of the sprite) just below its
 * lowest visible pixel across all its frames: where it rests on the ground.
 * The renderer lines shadows up with it. 0 for a fully transparent sprite.
 */
const lowestLine = (frames: readonly Pixels[]): number => {
  let line = 0;
  for (const frame of frames) {
    for (let y = frame.length / (TILE * 4) - 1; y >= line; y--) {
      for (let x = 0; x < TILE; x++) {
        if (byteAt(frame, (y * TILE + x) * 4 + 3) > 0) {
          line = y + 1;
          break;
        }
      }
    }
  }
  return line;
};

/** The `atlas.json` entry for one sprite (see define.ts for the metadata). */
const describe = (
  sprite: Sprite,
  cells: Cell[]
): AtlasJson["sprites"][string] => {
  const { name, frames, mode = "frames", ground, frameSec, stepPx } = sprite;
  if (
    mode === "frames" &&
    frames.length > 1 &&
    frameSec == null &&
    stepPx == null
  )
    throw new Error(
      `"${name}" has ${frames.length} animation frames but no frameSec or stepPx`
    );
  const tall = heightOf(sprite);
  return {
    mode,
    cells,
    colour: averageColour(frames),
    ground: ground ?? lowestLine(frames),
    // Optional fields are left out rather than written as null.
    ...(tall > 1 && { rows: tall }),
    ...(frameSec != null && { frameSec }),
    ...(stepPx != null && { stepPx }),
    ...(sprite.raise != null && { raise: sprite.raise }),
  };
};

export const writeAtlas = (
  sprites: readonly Sprite[]
): { cells: Record<string, Cell[]>; rows: number } => {
  const { cells, rows } = layout(sprites);
  const width = COLUMNS * TILE;
  const height = rows * TILE;
  const pixels = new Uint8Array(width * height * 4);
  const cellsOf = (name: string): Cell[] =>
    cells[name] ?? raise(new Error(`"${name}" was not laid out`));
  for (const { name, frames } of sprites) {
    cellsOf(name).forEach(([col, row], i) => {
      const frame = frames[i] ?? raise(new Error(`"${name}" lost a frame`));
      blit(pixels, width, frame, col * TILE, row * TILE, { copy: true });
    });
  }
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    new URL("atlas.png", OUT_DIR),
    encodePng(width, height, pixels)
  );
  // atlas.json: `sprites[name] = { mode, cells: [[col, row], ...], colour:
  // "#rrggbb", ground, rows?, frameSec?, stepPx?, raise? }`. `rows` is how many tiles
  // tall each frame is (left out when 1); a cell is the frame's top-left tile.
  // `mode`: "variants" = pick one per tile; "frames" = animation (or a single
  // frame). Sprites that don't say are "frames".
  const json: AtlasJson = {
    tileSize: TILE,
    columns: COLUMNS,
    sprites: Object.fromEntries(
      sprites.map(sprite => [
        sprite.name,
        describe(sprite, cellsOf(sprite.name)),
      ])
    ),
  };
  writeFileSync(
    new URL("atlas.json", OUT_DIR),
    JSON.stringify(json, null, 2) + "\n"
  );
  return { cells, rows };
};
