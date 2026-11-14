// Terrain tiles. Each must tile seamlessly, so details wrap around the edges
// (`putWrap`). To add a tile: write a `draw(rng, variant)` and add one line to
// the `terrain` list at the bottom. Sprite name must equal the Tile id.

import { fill, put, putWrap, randInt, speckle, TILE } from "../core.mjs";
import { PALETTE } from "../palette.mjs";
import { animated, variants } from "./define.mjs";

const grass = (rng, variant) => {
  const [d, m, l, h] = PALETTE.grass;
  const s = fill(m);
  speckle(s, rng, [
    [d, 0.14],
    [l, 0.12],
    [h, 0.025],
  ]);
  for (let i = 0; i < 3; i++) {
    const x = randInt(rng, TILE);
    const y = randInt(rng, TILE);
    putWrap(s, x, y, d);
    putWrap(s, x, y - 1, h);
    putWrap(s, x + 1, y, l);
  }
  // Every 4th variant gets a rare flower.
  if (variant === 3)
    putWrap(s, randInt(rng, TILE), randInt(rng, TILE), PALETTE.flower);
  return s;
};

const sand = rng => {
  const [d, m, l, h] = PALETTE.sand;
  const s = fill(m);
  speckle(s, rng, [
    [d, 0.09],
    [l, 0.1],
  ]);
  for (let i = 0; i < 2; i++) {
    const x = randInt(rng, TILE);
    const y = randInt(rng, TILE);
    for (let k = 0; k < 4; k++) {
      putWrap(s, x + k, y, d);
      putWrap(s, x + k + 1, y + 1, h);
    }
  }
  return s;
};

const pebble = (s, x, y) => {
  const [d, m, l, h] = PALETTE.stone;
  [l, h, l].forEach((c, i) => put(s, x + i, y, c));
  [m, m, d].forEach((c, i) => put(s, x + i, y + 1, c));
};

const crack = (s, rng) => {
  let x = randInt(rng, TILE);
  let y = randInt(rng, TILE);
  for (let i = 0; i < 6; i++) {
    putWrap(s, x, y, PALETTE.stone[0]);
    putWrap(s, x + 1, y + 1, PALETTE.stone[2]);
    x += rng() < 0.5 ? 1 : 0;
    y += 1;
  }
};

const stone = rng => {
  const [d, m, l] = PALETTE.stone;
  const s = fill(m);
  speckle(s, rng, [
    [d, 0.07],
    [l, 0.07],
  ]);
  crack(s, rng);
  for (let i = 0; i < 3; i++)
    pebble(s, 1 + randInt(rng, 11), 1 + randInt(rng, 13));
  return s;
};

const swampland = rng => {
  const [d, m, l, h] = PALETTE.swamp;
  const s = fill(m);
  speckle(s, rng, [
    [d, 0.16],
    [l, 0.1],
  ]);
  for (let i = 0; i < 2; i++) {
    const cx = randInt(rng, TILE);
    const cy = randInt(rng, TILE);
    const rx = 2 + randInt(rng, 2);
    for (let dy = -1; dy <= 1; dy++) {
      const half = dy === 0 ? rx : rx - 1;
      for (let dx = -half; dx <= half; dx++) {
        putWrap(s, cx + dx, cy + dy, PALETTE.puddle[dy === 1 ? 0 : 1]);
      }
    }
    putWrap(s, cx - 1, cy - 1, PALETTE.puddle[2]);
  }
  for (let i = 0; i < 3; i++) {
    const x = randInt(rng, TILE);
    const y = randInt(rng, TILE);
    putWrap(s, x, y, l);
    putWrap(s, x, y - 1, l);
    putWrap(s, x, y - 2, h);
    putWrap(s, x + 1, y - 2, h);
  }
  return s;
};

const jungle = rng => {
  const [d, m, l, h] = PALETTE.jungle;
  const s = fill(m);
  speckle(s, rng, [
    [d, 0.18],
    [l, 0.06],
  ]);
  for (let i = 0; i < 10; i++) {
    const x = randInt(rng, TILE);
    const y = randInt(rng, TILE);
    const wide = rng() < 0.5;
    putWrap(s, x, y, h);
    putWrap(s, x + (wide ? 1 : 0), y + (wide ? 0 : 1), l);
    putWrap(s, x + 1, y + 1, d);
  }
  return s;
};

// An iron vein: a meandering seam of ore running through the rock.
//
// The seam is a sum of whole-number sine waves, so it is periodic and the tile
// still tiles. Every variant passes through the same height (y = 8) at the
// left/right edges, so side-by-side tiles join into one continuous vein.
const TAU = Math.PI * 2;
const wave = (k, t) => Math.sin((TAU * k * t) / TILE);
const wrapIndex = n => ((n % TILE) + TILE) % TILE;
const pixelKey = (x, y) => `${wrapIndex(x)},${wrapIndex(y)}`;

/** The set of pixel keys covered by the main vein. */
const veinPixels = (rng, variant) => {
  const k1 = 1 + (variant % 2);
  const k2 = 2 + (variant >> 1);
  const a1 = 2 + rng() * 1.5;
  const a2 = 0.8 + rng();
  const direction = rng() < 0.5 ? -1 : 1;
  const centre = x =>
    Math.round(8 + direction * (a1 * wave(k1, x) + a2 * wave(k2, x)));

  const pixels = new Set();
  for (let x = 0; x < TILE; x++) {
    // Fill from this column's centre to the next one so steep sections stay
    // connected; the vein swells and thins as it goes.
    const [from, to] = [centre(x), centre(x + 1)].sort((a, b) => a - b);
    const width = wave(3, x + variant) > 0.3 ? 6 : 5;
    for (let y = from; y <= to + width - 1; y++) pixels.add(pixelKey(x, y));
  }
  return pixels;
};

const oreDeposit =
  ({ ore: [dark, mid, light], stain, stainDark }) =>
  (rng, variant) => {
    const rock = PALETTE.stone;
    const s = fill(rock[1]);
    speckle(s, rng, [
      [rock[0], 0.08],
      [rock[2], 0.05],
    ]);

    const vein = veinPixels(rng, variant);
    const isOre = (x, y) => vein.has(pixelKey(x, y));
    const cells = [...vein].map(key => key.split(",").map(Number));

    // Rust-stained rock hugging the top and bottom of the vein, then the ore
    // itself: a bright top edge, a bevelled dark underside, and a dark metallic
    // body with glints of lighter ore so it reads as solid metal, not a crack.
    for (const [x, y] of cells) {
      for (const dy of [-1, 1])
        if (!isOre(x, y + dy)) putWrap(s, x, y + dy, stainDark);
    }
    for (const [x, y] of cells) {
      const colour = !isOre(x, y - 1)
        ? light
        : !isOre(x, y + 1)
          ? rock[0]
          : !isOre(x, y - 2) || rng() < 0.25
            ? mid
            : dark;
      put(s, x, y, colour);
    }

    // A thin side branch crossing the main vein on alternate variants.
    if (variant % 2 === 1) {
      const amplitude = 2 + rng() * 1.5;
      for (let y = 0; y < TILE; y++) {
        const x = Math.round(8 - amplitude * wave(1, y));
        if (isOre(x, y)) continue;
        putWrap(s, x, y, mid);
        if (!isOre(x + 1, y)) putWrap(s, x + 1, y, stainDark);
      }
    }

    // Rust staining on the vein, and a few ore flecks drifting into the rock.
    for (let i = 0; i < 4; i++) {
      const [x, y] = cells[randInt(rng, cells.length)];
      put(s, x, y, stain);
    }
    for (let i = 0; i < 9; i++) {
      const x = randInt(rng, TILE);
      const y = randInt(rng, TILE);
      if (!isOre(x, y)) put(s, x, y, i < 4 ? stainDark : mid);
    }
    return s;
  };

const ironDeposit = oreDeposit({
  ore: PALETTE.ore,
  stain: PALETTE.rust,
  stainDark: PALETTE.rustDark,
});

const copperDeposit = oreDeposit({
  ore: PALETTE.copper,
  stain: PALETTE.verdigris,
  stainDark: PALETTE.verdigrisDark,
});

/** Waves slide 4px per frame -> a seamless 4-frame loop. */
const water = (rng, frame) => {
  const [d, m, l, h] = PALETTE.water;
  const s = fill(m);
  speckle(s, rng, [
    [d, 0.1],
    [l, 0.08],
  ]);
  for (let i = 0; i < 5; i++) {
    const row = randInt(rng, TILE);
    const x = randInt(rng, TILE) + frame * 4;
    for (let k = 0; k < 4; k++) {
      putWrap(s, x + k, row, h);
      putWrap(s, x + k + 1, row + 1, d);
    }
  }
  return s;
};

export const terrain = [
  variants("grass", grass),
  variants("sand", sand),
  variants("stone", stone),
  variants("swampland", swampland),
  variants("jungle", jungle),
  variants("iron_deposit", ironDeposit),
  variants("copper_deposit", copperDeposit),
  animated("water", 4, water, { frameMs: 300 }),
];
