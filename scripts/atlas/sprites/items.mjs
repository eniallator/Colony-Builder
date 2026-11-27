// Item icons, drawn as ASCII art. To add an item, add one `item(...)` entry
// whose id matches the ItemId in shared/src/item/registry.ts - the sprite is
// named `item_<id>` automatically. Keep the art within roughly 12x12 pixels,
// centred, with a 1px outline ('O').
//
// Legend characters are per-item; '.' is always transparent.

import { fromAscii } from "../core.mjs";
import { PALETTE } from "../palette.mjs";
import { compose } from "./compose.mjs";
import { still } from "./define.mjs";

// Ore chunk shapes (no outline - `compose` adds it). Light comes from the top
// left. Iron: l light edge, m glint, a body, d deep shade. Stone: p/q/s =
// light/mid/shade. Rust: r bright speck, R dark stain.
// Every shape is deliberately angular: uneven stair-steps, single-pixel spikes
// and notches, never a smooth blob.
// Four chunks only: more than that gets noisy at 16x16.
const PEAK = [
  "...l....",
  "..llm...",
  ".llmaaaR",
  "lmaaRaad",
  "lmaaaadd",
  "laaRaadd",
  ".aaraddd",
  "..adddd.",
];
// Stone with veins of iron through it.
const BASE_MIXED = ["..p....", ".ppq.q.", "pqaalqs", "pqRaasq", ".qsdsq."];
const BASE_IRON = ["...l...", ".llma.a", "lmaaRad", "laaraad", ".adddd."];
const FRONT_STONE = ["..pp..", ".pqqqs", "pqaass"];

const item = (id, rows, legend) =>
  still(`item_${id}`, fromAscii(rows, { O: PALETTE.outline, ...legend }));

const orePile = (id, { ore: [a, m, l], deep, stain, stainDark }) =>
  still(
    `item_${id}`,
    compose(
      // A mound seen from the game's tilted top-down camera: the tallest chunk
      // sits in the middle, two chunks form the base either side, and a small
      // chunk in front sits lowest so the footprint reads as an ellipse.
      // Mostly ore, with stone and stone-and-ore mixed in. Back to front.
      [
        [PEAK, 4, 1],
        [BASE_MIXED, 1, 8],
        [BASE_IRON, 8, 8],
        [FRONT_STONE, 5, 11],
      ],
      {
        // ore: light / mid / body / deep, plus stain
        l,
        m,
        a,
        d: deep,
        R: stainDark,
        r: stain,
        // stone: light / mid / shade
        p: PALETTE.stone[3],
        q: PALETTE.stone[2],
        s: PALETTE.stone[1],
      },
      PALETTE.outline
    )
  );

export const items = [
  orePile("iron_ore", {
    ore: PALETTE.ore,
    deep: PALETTE.oreDark,
    stain: PALETTE.rust,
    stainDark: PALETTE.rustDark,
  }),
  orePile("copper_ore", {
    ore: PALETTE.copper,
    deep: PALETTE.copperDark,
    stain: PALETTE.verdigris,
    stainDark: PALETTE.verdigrisDark,
  }),
  item(
    "log",
    [
      "................",
      "................",
      "................",
      "................",
      "...OOOOOOOOOOO..",
      "..OsssOhhhhhhhO.",
      ".OsSSssOBBBBBBbO",
      ".OsSssSOBBBBBBbO",
      ".OsSSssOBBBBBBbO",
      "..OsssObbbbbbbO.",
      "...OOOOOOOOOOO..",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
    {
      s: PALETTE.log.skin,
      S: PALETTE.log.ring,
      h: PALETTE.log.barkLight,
      B: PALETTE.log.bark,
      b: PALETTE.log.barkDark,
    }
  ),
  // A cut cactus segment lying on its side: pale cut face on the left, ribs
  // running along the body with a groove between them, and a few spines.
  item(
    "cactus",
    [
      "................",
      "................",
      "................",
      "................",
      "...OOOOOOOOOOO..",
      "..OsssOhhhhhhhO.",
      ".OsSSssOBpBBpBbO",
      ".OsSssSOgggggggO",
      ".OsSSssOBBpBBpbO",
      "..OsssObbbbbbbO.",
      "...OOOOOOOOOOO..",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
    {
      s: PALETTE.cactus[3],
      S: PALETTE.cactus[2],
      h: PALETTE.cactus[3],
      B: PALETTE.cactus[2],
      b: PALETTE.cactus[1],
      g: PALETTE.cactus[0],
      p: PALETTE.sand[3],
    }
  ),
  // A picked toadstool, the same rose cap and pale stalk as the plant it came
  // from: a domed cap lit from the top left with a few cream spots, a dark
  // underside, and a short stalk.
  item(
    "mushroom",
    [
      "................",
      "................",
      "................",
      ".....OOOOOO.....",
      "...OllsaaaabO...",
      "..OllasaaaaabO..",
      "..OlaaaaasabbO..",
      "..OaasaaaabbbO..",
      "..OddddddddddO..",
      ".....OsTTuO.....",
      ".....OsTTuO.....",
      ".....OsTTuO.....",
      ".....OOOOOO.....",
      "................",
      "................",
      "................",
    ],
    {
      // cap: light / body / shade / underside
      l: PALETTE.mushroom.cap[3],
      a: PALETTE.mushroom.cap[2],
      b: PALETTE.mushroom.cap[1],
      d: PALETTE.mushroom.cap[0],
      // stalk, and the spots on the cap: lit / body / shade
      s: PALETTE.mushroom.stalk[2],
      T: PALETTE.mushroom.stalk[1],
      u: PALETTE.mushroom.stalk[0],
    }
  ),
  // A bundle of fibres stripped from a fern: strands fanning out above and
  // below a bark tie, lit from the left.
  item(
    "fibre",
    [
      "................",
      "..OO..OOO..OO...",
      "..OlOOlllOOaO...",
      "...OlOlaaOaO....",
      "...OllaaaaaO....",
      "....OllaaaO.....",
      "....OllaaaO.....",
      "...OHHhhhhbO....",
      "...OhhbbbbbO....",
      "....OllaaaO.....",
      "...OllaaaaaO....",
      "..OllOaaaOaaO...",
      "..OlO.OaO.OaO...",
      "...O...O...O....",
      "................",
      "................",
    ],
    {
      // strands: lit / body
      l: PALETTE.fern[3],
      a: PALETTE.fern[2],
      // tie: lit / body / shade
      H: PALETTE.log.skin,
      h: PALETTE.log.barkLight,
      b: PALETTE.log.bark,
    }
  ),
  // A packed-up robot: the walking one's orange box, visor and treads, with a
  // carry handle on top. It is switched off, so its eyes are grey and unlit.
  item(
    "robot",
    [
      "................",
      "................",
      "....OOOOOOOO....",
      "....OqqqqqqO....",
      "....OqO..OsO....",
      "...OOqOOOOsOO...",
      "..OllllllllllO..",
      "..OlaaaaaaaabO..",
      "..OlavvvvvvabO..",
      "..OlavevvevabO..",
      "..OlaaaaaaaabO..",
      "..ObbbbbbbbbbO..",
      "...OOOOOOOOOO...",
      "...OO......OO...",
      "................",
      "................",
    ],
    {
      // body: light / body / shade, then the visor and its unlit eyes
      l: PALETTE.robot.light,
      a: PALETTE.robot.base,
      b: PALETTE.robot.dark,
      v: PALETTE.robot.visor,
      e: PALETTE.stone[2],
      // handle: lit / shaded metal
      q: PALETTE.stone[3],
      s: PALETTE.stone[2],
    }
  ),
];
