// Terrain tiles: shapes drawn by hand and laid out on a base colour, with no
// per-pixel noise. Each must tile seamlessly, so shapes stay inside the tile
// (any variant can sit beside any other) unless every variant shares them, as
// with the water. To add a tile: draw its shapes, lay them out and add one line
// to the `terrain` list at the bottom. Sprite name must equal the Tile id.

import { fill, putWrap } from "../core.mjs";
import { PALETTE } from "../palette.mjs";
import { stamp } from "./compose.mjs";
import { animated, variants } from "./define.mjs";

/** A `base` tile with shapes on it. `layout` is [[rows, x, y], ...]. */
const scatter = (base, legend, layout) => {
  const s = fill(base);
  for (const [rows, x, y] of layout)
    stamp(s, rows, legend, [x, y], { plot: putWrap });
  return s;
};

/** A tile with one variant per layout, using a ramp's usual shading letters. */
const scattered = (name, [d, m, l, h], layouts, extras = {}) =>
  variants(
    name,
    (_rng, i) => scatter(m, { d, m, l, h, ...extras }, layouts[i]),
    layouts.length
  );

// Broad, soft patches of a tone close to the base. Terrain is mostly these,
// with only the odd detail, so it stays quiet when zoomed out.
const BROAD = [
  "...qqqqq....",
  ".qqqqqqqqq..",
  "qqqqqqqqqqqq",
  ".qqqqqqqqqq.",
  "....qqqqq...",
];
const SMALL = ["..qqqq..", "qqqqqqq.", ".qqqqqqq", "..qqqq.."];
/** The same patch in the lighter tone. */
const lighter = rows => rows.map(row => row.replaceAll("q", "r"));
const BROAD_LIGHT = lighter(BROAD);
const SMALL_LIGHT = lighter(SMALL);
/** The legend letters of a terrain's [darker, lighter] patch tones. */
const patches = ([q, r]) => ({ q, r });

// Grass: patches, with an occasional tuft and a rare flower.
const TUFT = ["l...l", ".l.l.", ".dld."];
const SPRIG = ["l.l", ".d."];
const FLOWER = [".f.", "fhf", ".d."];
const GRASS_LAYOUTS = [
  [
    [BROAD, 1, 3],
    [SPRIG, 10, 11],
  ],
  [
    [SMALL_LIGHT, 7, 2],
    [TUFT, 3, 10],
  ],
  [[BROAD_LIGHT, 3, 8]],
  [
    [SMALL, 1, 2],
    [SMALL, 7, 10],
  ],
  [
    [TUFT, 9, 3],
    [SMALL, 2, 9],
  ],
  [
    [BROAD, 2, 9],
    [SMALL_LIGHT, 7, 1],
  ],
  [
    [SMALL_LIGHT, 2, 5],
    [SPRIG, 11, 11],
  ],
  [
    [BROAD_LIGHT, 1, 2],
    [FLOWER, 10, 10],
  ],
];

// Sand: drifts, with an occasional wind ripple (a lit crest over its own
// shadow) and a rare shell.
const RIPPLE = ["..llll..", "llddddll", "dd....dd"];
const SHORT_RIPPLE = [".lll.", "ldddl", "d...d"];
const SHELL = ["hh.", ".dd"];
const SAND_LAYOUTS = [
  [
    [BROAD, 1, 3],
    [SHORT_RIPPLE, 9, 11],
  ],
  [
    [SMALL_LIGHT, 2, 2],
    [RIPPLE, 6, 9],
  ],
  [[BROAD_LIGHT, 3, 8]],
  [
    [SMALL, 1, 2],
    [SMALL_LIGHT, 7, 10],
  ],
  [
    [RIPPLE, 2, 3],
    [SMALL, 7, 10],
  ],
  [
    [BROAD, 2, 9],
    [SMALL_LIGHT, 8, 2],
  ],
  [
    [SMALL, 8, 4],
    [SMALL_LIGHT, 1, 9],
  ],
  [
    [BROAD_LIGHT, 1, 2],
    [SHELL, 10, 11],
  ],
];

// Stone: patches of rock, with an occasional boulder, pebble or crack.
const BOULDER = [
  "...lll...",
  ".lllllm..",
  "llllmmmd.",
  "llmmmmddd",
  ".ddddddd.",
];
const SLAB = [".llll..", "llllmd.", "lmmmmdd", ".ddddd."];
const PEBBLE = [".ll.", "lmmd", ".dd."];
// A crack catches the light on its lower lip.
const CRACK = ["dd....", "lld...", "..ld..", "...ldd", "....ll"];
const STONE_LAYOUTS = [
  [
    [BOULDER, 2, 3],
    [SMALL, 7, 10],
  ],
  [
    [BROAD, 2, 8],
    [SMALL_LIGHT, 7, 2],
  ],
  [
    [CRACK, 8, 3],
    [SMALL, 1, 10],
  ],
  [
    [BROAD_LIGHT, 1, 2],
    [PEBBLE, 10, 11],
  ],
  [
    [SLAB, 7, 9],
    [SMALL_LIGHT, 1, 2],
  ],
  [
    [BROAD, 3, 2],
    [SMALL, 2, 10],
  ],
  [
    [BROAD_LIGHT, 2, 9],
    [SMALL, 8, 2],
  ],
  [
    [SMALL, 1, 5],
    [SMALL_LIGHT, 8, 10],
  ],
];

// Swampland: murky patches, with an occasional pool or clump of reeds.
const PUDDLE = [
  "...aaaa...",
  ".appaaaaa.",
  "aaaaaaaaaa",
  ".aaaaaaaa.",
  "..bbbbbb..",
];
const REED = ["l...l", "l.l.l", ".lll.", "..d.."];
const SWAMP_LAYOUTS = [
  [
    [PUDDLE, 2, 3],
    [SMALL, 7, 11],
  ],
  [
    [BROAD, 2, 9],
    [SMALL_LIGHT, 7, 2],
  ],
  [
    [REED, 9, 3],
    [SMALL, 2, 9],
  ],
  [[BROAD, 1, 2]],
  [
    [SMALL_LIGHT, 1, 2],
    [PUDDLE, 5, 9],
  ],
  [
    [REED, 3, 9],
    [SMALL, 7, 2],
  ],
  [
    [BROAD_LIGHT, 3, 8],
    [SMALL, 1, 1],
  ],
  [
    [SMALL, 8, 9],
    [SMALL_LIGHT, 2, 4],
  ],
];

// Jungle: deep shade and light through the canopy, with an occasional frond.
const FROND = [
  "..ll...",
  ".llll..",
  "lllldl.",
  "llldlld",
  ".ldlld.",
  "..ddd..",
];
const LEAF = [".ll.", "llld", ".dd."];
const JUNGLE_LAYOUTS = [
  [
    [FROND, 2, 2],
    [SMALL, 7, 10],
  ],
  [
    [BROAD, 2, 8],
    [LEAF, 10, 2],
  ],
  [
    [SMALL_LIGHT, 2, 2],
    [SMALL, 7, 9],
  ],
  [
    [FROND, 7, 8],
    [SMALL, 1, 2],
  ],
  [
    [BROAD_LIGHT, 1, 3],
    [LEAF, 3, 11],
  ],
  [
    [BROAD, 3, 2],
    [SMALL_LIGHT, 2, 10],
  ],
  [
    [FROND, 8, 2],
    [SMALL_LIGHT, 1, 10],
  ],
  [
    [BROAD, 1, 9],
    [SMALL, 6, 2],
  ],
];

// Ore deposits: rocks shot through with the ore (A, B, C = light to dark) and
// its stain (S), so the item clearly comes out of them. Patches come first in
// each layout so the rocks lie on top of them.
const ORE_BOULDER = [
  "...hhh...",
  ".hAAllm..",
  "hABBmAAd.",
  "lmCCSBBCd",
  ".ddddddd.",
];
const ORE_SLAB = [".hhhl..", "hAAlmd.", "lBCSAAd", ".ddBCd."];
const ORE_PEBBLE = [".AB.", "lBCd", ".dd."];
const ORE_LAYOUTS = [
  [
    [SMALL, 1, 8],
    [SMALL_LIGHT, 8, 2],
    [ORE_BOULDER, 1, 1],
    [ORE_PEBBLE, 11, 4],
    [ORE_SLAB, 8, 10],
  ],
  [
    [BROAD, 1, 1],
    [ORE_SLAB, 8, 3],
    [ORE_BOULDER, 2, 8],
    [ORE_PEBBLE, 11, 12],
  ],
  [
    [BROAD_LIGHT, 3, 3],
    [ORE_SLAB, 1, 2],
    [ORE_PEBBLE, 2, 8],
    [ORE_BOULDER, 6, 9],
  ],
  [
    [SMALL, 8, 8],
    [SMALL_LIGHT, 1, 4],
    [ORE_PEBBLE, 2, 2],
    [ORE_BOULDER, 6, 1],
    [ORE_SLAB, 1, 9],
  ],
];

/** A deposit of an ore, bedded in the same ground as plain stone. */
const deposit = (name, { ore: [C, B, A], stain: S }) =>
  scattered(name, PALETTE.stone, ORE_LAYOUTS, {
    ...patches(PALETTE.patch.stone),
    A,
    B,
    C,
    S,
  });

// Water: still patches of depth, with one wave and its glint drifting over them.
const WAVE = [".llll.", "ll..ll"];
const GLINT = ["ll"];
const WATER_PATCHES = [
  [BROAD, 0, 9],
  [SMALL_LIGHT, 8, 1],
];
const WATER_WAVES = [
  [WAVE, 1, 3],
  [GLINT, 11, 12],
];

/** Waves slide 4px per frame -> a seamless 4-frame loop. */
const water = (_rng, frame) => {
  const [d, m, l] = PALETTE.water;
  return scatter(m, { d, l, ...patches(PALETTE.patch.water) }, [
    ...WATER_PATCHES,
    ...WATER_WAVES.map(([rows, x, y]) => [rows, x + frame * 4, y]),
  ]);
};

export const terrain = [
  scattered("grass", PALETTE.grass, GRASS_LAYOUTS, {
    ...patches(PALETTE.patch.grass),
    f: PALETTE.flower,
  }),
  scattered("sand", PALETTE.sand, SAND_LAYOUTS, patches(PALETTE.patch.sand)),
  scattered(
    "stone",
    PALETTE.stone,
    STONE_LAYOUTS,
    patches(PALETTE.patch.stone)
  ),
  scattered("swampland", PALETTE.swamp, SWAMP_LAYOUTS, {
    ...patches(PALETTE.patch.swamp),
    p: PALETTE.puddle[2],
    a: PALETTE.puddle[1],
    b: PALETTE.puddle[0],
  }),
  scattered(
    "jungle",
    PALETTE.jungle,
    JUNGLE_LAYOUTS,
    patches(PALETTE.patch.jungle)
  ),
  deposit("iron_deposit", { ore: PALETTE.ore, stain: PALETTE.rust }),
  deposit("copper_deposit", { ore: PALETTE.copper, stain: PALETTE.verdigris }),
  animated("water", 4, water, { frameSec: 0.3 }),
];
