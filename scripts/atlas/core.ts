// Low-level pixel drawing helpers. A "sprite" is a 16-wide RGBA Uint8Array,
// 16 pixels tall by default or a whole number of tiles taller (see `blank`).

export const TILE = 16;

/** A 16-wide RGBA pixel buffer, a whole number of tiles tall. */
export type Pixels = Uint8Array;
export type Point = [x: number, y: number];
/** A pixel to paint, with its `#rrggbb` colour. */
export type Dot = [x: number, y: number, colour: string];
/** The `#rrggbb` colour of each character of an ASCII drawing. */
export type Legend = Readonly<Record<string, string>>;
export type Rng = () => number;
/** Where a pixel of a tile moves to. */
export type Mapping = (x: number, y: number) => Point;
/** Paints one pixel of a buffer. */
export type Plot = (s: Pixels, x: number, y: number, colour: string) => void;

/** The steps to the four pixels sharing an edge with one. */
export const NEIGHBOURS: readonly Readonly<Point>[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** The channel value at `index` of a pixel buffer, 0 past its end. */
export const byteAt = (s: Pixels, index: number): number => s[index] ?? 0;

/** How many tiles tall a sprite buffer is. */
export const tilesTall = (s: Pixels): number => s.length / (TILE * TILE * 4);

export const hex = (h: string): [r: number, g: number, b: number] => {
  const channel = (i: number) => parseInt(h.slice(i, i + 2), 16);
  return [channel(1), channel(3), channel(5)];
};
export const mod = (n: number): number => ((n % TILE) + TILE) % TILE;

/** FNV-1a. Seeds are derived from sprite names so new sprites never collide. */
export const hash = (str: string): number => {
  let h = 0x811c9dc5;
  for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193);
  return h >>> 0;
};

export const mulberry32 =
  (seed: number): Rng =>
  () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

/** A transparent sprite buffer `tall` tiles high (taller than 1 for structures). */
export const blank = (tall = 1): Pixels =>
  new Uint8Array(TILE * TILE * tall * 4);

export const put = (
  s: Pixels,
  x: number,
  y: number,
  colour: string,
  alpha = 255
): void => {
  if (x < 0 || y < 0 || x >= TILE || y >= TILE * tilesTall(s)) return;
  s.set([...hex(colour), alpha], (y * TILE + x) * 4);
};
/** Like `put`, but wraps around the edges so terrain stays tileable. */
export const putWrap: Plot = (s, x, y, colour) => {
  put(s, mod(x), mod(y), colour);
};

export const rect = (
  s: Pixels,
  x: number,
  y: number,
  w: number,
  h: number,
  colour: string
): void => {
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) put(s, x + i, y + j, colour);
};

export const fill = (colour: string): Pixels => {
  const s = blank();
  rect(s, 0, 0, TILE, TILE, colour);
  return s;
};

/** Sprinkles single pixels. `table` is [[colour, probability], ...]. */
export const speckle = (
  s: Pixels,
  rng: Rng,
  table: readonly (readonly [colour: string, probability: number])[]
): void => {
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      let r = rng();
      for (const [colour, p] of table) {
        if (r < p) {
          put(s, x, y, colour);
          break;
        }
        r -= p;
      }
    }
  }
};

/**
 * Draws an ASCII sprite. '.' is transparent; every other character is looked
 * up in `legend`. Throws on ragged rows or unknown characters, so a typo fails
 * loudly instead of drawing garbage.
 */
export const fromAscii = (rows: readonly string[], legend: Legend): Pixels => {
  if (rows.length !== TILE) throw new Error(`ascii sprite needs ${TILE} rows`);
  const s = blank();
  rows.forEach((row, y) => {
    if (row.length !== TILE)
      throw new Error(
        `row ${y} is ${row.length} wide, expected ${TILE}: "${row}"`
      );
    Array.from(row).forEach((ch, x) => {
      if (ch === ".") return;
      const colour = legend[ch];
      if (colour == null) throw new Error(`no legend entry for "${ch}"`);
      put(s, x, y, colour);
    });
  });
  return s;
};

/** Rounded box with a 1px outline and simple top-left lighting. */
export const roundBox = (
  s: Pixels,
  x: number,
  y: number,
  w: number,
  h: number,
  {
    fillC,
    hi,
    lo,
    outline,
  }: { fillC: string; hi: string; lo: string; outline: string }
): void => {
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      const edgeX = xx === 0 || xx === w - 1;
      const edgeY = yy === 0 || yy === h - 1;
      if (edgeX && edgeY) continue;
      const colour =
        edgeX || edgeY
          ? outline
          : yy === h - 2 || xx === w - 2
            ? lo
            : yy === 1 || xx === 1
              ? hi
              : fillC;
      put(s, x + xx, y + yy, colour);
    }
  }
};

/** Maps each source pixel (x, y) to a destination pixel. */
export const remap = (s: Pixels, mapping: Mapping): Pixels => {
  const out = blank();
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const [nx, ny] = mapping(x, y);
      const from = (y * TILE + x) * 4;
      out.set(s.subarray(from, from + 4), (ny * TILE + nx) * 4);
    }
  }
  return out;
};
export const ROTATE = {
  cw: (x, y) => [TILE - 1 - y, x],
  ccw: (x, y) => [y, TILE - 1 - x],
  half: (x, y) => [TILE - 1 - x, TILE - 1 - y],
} satisfies Record<string, Mapping>;
