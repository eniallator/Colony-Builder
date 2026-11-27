// Checks the style guide's rule that two colours which can sit side by side when
// zoomed out must contrast enough to be told apart. Zoomed far out a sprite is
// drawn as one flat colour, so that is what is compared.
//
// What can sit beside what comes from the game's own registries and rules, so
// new content is checked without touching this file.

import { hex } from "./core.mjs";
import { load } from "./coverage.mjs";
import { averageColour } from "./pack.mjs";

/**
 * The least distance (CIE76, in Lab space) between two neighbouring colours. A
 * tree which could barely be seen against grass measured about 4.
 */
export const MIN_CONTRAST = 10;

/**
 * Ore deposits are meant to stay close to the stone they are bedded in, so
 * stone and the deposits need only this much between them: about what iron
 * deposits have from stone.
 */
const MIN_ROCK_CONTRAST = 2.8;

const isRock = ({ id }) => id === "stone" || id.endsWith("_deposit");

/** An sRGB `#rrggbb` colour in CIE Lab, where distance tracks what we see. */
const toLab = colour => {
  const [r, g, b] = hex(colour)
    .map(v => v / 255)
    .map(c => (c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92));
  const f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
  const y = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
  const z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
};

export const contrastOf = (a, b) => {
  const other = toLab(b);
  return Math.hypot(...toLab(a).map((v, i) => v - other[i]));
};

/**
 * Every pair of things which can appear side by side. Each side is
 * `{ id, sprites }`, the sprites being all the looks it can have.
 */
const neighbours = async spriteNames => {
  const [
    { tiles },
    { itemRegistry },
    { allEntityTypes },
    { structureSprites },
    { GROWS_ON },
  ] = await Promise.all([
    load("../../shared/src/world/terrain/types.ts"),
    load("../../shared/src/item/types.ts"),
    load("../../shared/src/world/entity/types.ts"),
    load("../../client/src/render/structure-sprites.ts"),
    load("../../server-core/src/terrain/worldGenerator.ts"),
  ]);

  const terrain = tiles.map(id => ({ id, sprites: [id] }));
  // Things stand on the terrain: on any of it, unless the game limits where.
  const things = [
    ...Object.entries(structureSprites).map(([id, sprites]) => ({
      id,
      sprites,
      grounds: GROWS_ON[id] ?? tiles,
    })),
    // "item" entities are drawn as their item, listed below.
    ...allEntityTypes
      .filter(type => type !== "item")
      .map(id => ({
        id,
        sprites: spriteNames.filter(name => name.startsWith(`${id}_`)),
        grounds: tiles,
      })),
    ...Object.keys(itemRegistry).map(id => ({
      id: `item_${id}`,
      sprites: [`item_${id}`],
      grounds: tiles,
    })),
  ];

  /** Each unordered pair of different members. */
  const pairsOf = list =>
    list.flatMap((a, i) => list.slice(i + 1).map(b => [a, b]));

  return [
    ...pairsOf(terrain),
    ...things.flatMap(thing =>
      terrain
        .filter(({ id }) => thing.grounds.includes(id))
        .map(ground => [thing, ground])
    ),
    ...pairsOf(things),
  ];
};

/**
 * Returns `{ clashes, error }`: the neighbouring pairs closer than they may be
 * (`MIN_CONTRAST`, or less between rocks), worst first, each judged by its
 * closest two looks. `error` is set if the game registries failed to load.
 */
export const checkContrast = async sprites => {
  const colours = new Map(
    sprites.map(({ name, frames }) => [name, averageColour(frames)])
  );
  let pairs;
  try {
    pairs = await neighbours([...colours.keys()]);
  } catch (error) {
    return { clashes: [], error };
  }

  const clashes = pairs.flatMap(([a, b]) => {
    const [closest] = a.sprites
      .flatMap(first =>
        b.sprites.map(second => {
          const shades = [colours.get(first), colours.get(second)];
          // Sprites the game needs but lacks are the coverage check's to report.
          return shades.includes(undefined)
            ? null
            : { contrast: contrastOf(...shades), colours: shades };
        })
      )
      .filter(look => look != null)
      .sort((p, q) => p.contrast - q.contrast);
    const minimum = [a, b].every(isRock) ? MIN_ROCK_CONTRAST : MIN_CONTRAST;
    return closest != null && closest.contrast < minimum
      ? [{ ids: [a.id, b.id], ...closest }]
      : [];
  });
  return {
    clashes: clashes.sort((a, b) => a.contrast - b.contrast),
    error: null,
  };
};
