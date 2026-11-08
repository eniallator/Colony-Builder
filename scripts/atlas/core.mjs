// Low-level pixel drawing helpers. A "sprite" is a 16x16 RGBA Uint8Array.

export const TILE = 16;

export const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
export const mod = n => ((n % TILE) + TILE) % TILE;

/** FNV-1a. Seeds are derived from sprite names so new sprites never collide. */
export const hash = str => {
  let h = 0x811c9dc5;
  for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193);
  return h >>> 0;
};

export const mulberry32 = seed => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
export const randInt = (rng, max) => Math.floor(rng() * max);

export const blank = () => new Uint8Array(TILE * TILE * 4);

export const put = (s, x, y, colour, alpha = 255) => {
  if (x < 0 || y < 0 || x >= TILE || y >= TILE) return;
  s.set([...hex(colour), alpha], (y * TILE + x) * 4);
};
/** Like `put`, but wraps around the edges so terrain stays tileable. */
export const putWrap = (s, x, y, colour) => put(s, mod(x), mod(y), colour);

export const rect = (s, x, y, w, h, colour) => {
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) put(s, x + i, y + j, colour);
};

export const fill = colour => {
  const s = blank();
  rect(s, 0, 0, TILE, TILE, colour);
  return s;
};

/** Sprinkles single pixels. `table` is [[colour, probability], ...]. */
export const speckle = (s, rng, table) => {
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
export const fromAscii = (rows, legend) => {
  if (rows.length !== TILE) throw new Error(`ascii sprite needs ${TILE} rows`);
  const s = blank();
  rows.forEach((row, y) => {
    if (row.length !== TILE)
      throw new Error(
        `row ${y} is ${row.length} wide, expected ${TILE}: "${row}"`
      );
    [...row].forEach((ch, x) => {
      if (ch === ".") return;
      const colour = legend[ch];
      if (colour == null) throw new Error(`no legend entry for "${ch}"`);
      put(s, x, y, colour);
    });
  });
  return s;
};

/** Rounded box with a 1px outline and simple top-left lighting. */
export const roundBox = (s, x, y, w, h, { fillC, hi, lo, outline }) => {
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
export const remap = (s, mapping) => {
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
};
