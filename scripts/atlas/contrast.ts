// Checks the style guide's rule that two colours which can sit side by side when
// zoomed out must contrast enough to be told apart. Zoomed far out a sprite is
// drawn as one flat colour, so that is what is compared.
//
// What can sit beside what comes from the game's own registries and rules, so
// new content is checked without touching this file.

import { typedToEntries } from "niall-utils/data";

import { structureSprites } from "../../client/src/render/structure-sprites.ts";
import { GROWS_ON } from "../../server-core/src/terrain/worldGenerator.ts";
import {
  allEntityTypes,
  itemRegistry,
  tiles,
  type Tile,
} from "../../shared/src/index.ts";
import { hex } from "./core.ts";
import { averageColour } from "./pack.ts";
import type { Sprite } from "./sprites/define.ts";

/** Something in the game and all the looks it can have. */
interface Look {
  id: string;
  sprites: readonly string[];
}

/** Two neighbouring things which are too close, and their closest two looks. */
export interface Clash {
  ids: string[];
  contrast: number;
  colours: string[];
}

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

const isRock = ({ id }: Look) => id === "stone" || id.endsWith("_deposit");

/** An sRGB `#rrggbb` colour in CIE Lab, where distance tracks what we see. */
const toLab = (colour: string): [l: number, a: number, b: number] => {
  const linear = (v: number) => {
    const c = v / 255;
    return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92;
  };
  const [red, green, blue] = hex(colour);
  const [r, g, b] = [linear(red), linear(green), linear(blue)];
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
  const y = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
  const z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
};

export const contrastOf = (first: string, second: string): number => {
  const [l1, a1, b1] = toLab(first);
  const [l2, a2, b2] = toLab(second);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
};

/** Every pair of things which can appear side by side. */
const neighbours = (spriteNames: readonly string[]): [Look, Look][] => {
  const terrain = tiles.map(id => ({ id, sprites: [id] }));
  // Things stand on the terrain: on any of it, unless the game limits where.
  const things: (Look & { grounds: readonly Tile[] })[] = [
    ...typedToEntries(structureSprites).map(([id, sprites]) => ({
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
  const pairsOf = (list: readonly Look[]) =>
    list.flatMap((a, i) => list.slice(i + 1).map((b): [Look, Look] => [a, b]));

  return [
    ...pairsOf(terrain),
    ...things.flatMap(thing =>
      terrain
        .filter(({ id }) => thing.grounds.includes(id))
        .map((ground): [Look, Look] => [thing, ground])
    ),
    ...pairsOf(things),
  ];
};

/**
 * The neighbouring pairs closer than they may be (`MIN_CONTRAST`, or less
 * between rocks), worst first, each judged by its closest two looks.
 */
export const checkContrast = (sprites: readonly Sprite[]): Clash[] => {
  const colours = new Map(
    sprites.map(({ name, frames }) => [name, averageColour(frames)])
  );

  const clashes = neighbours([...colours.keys()]).flatMap(([a, b]) => {
    const [closest] = a.sprites
      .flatMap(first =>
        b.sprites.flatMap(second => {
          const one = colours.get(first);
          const other = colours.get(second);
          // Sprites the game needs but lacks are the coverage check's to report.
          return one == null || other == null
            ? []
            : [{ contrast: contrastOf(one, other), colours: [one, other] }];
        })
      )
      .sort((p, q) => p.contrast - q.contrast);
    const minimum = [a, b].every(isRock) ? MIN_ROCK_CONTRAST : MIN_CONTRAST;
    return closest != null && closest.contrast < minimum
      ? [{ ids: [a.id, b.id], ...closest }]
      : [];
  });
  return clashes.sort((a, b) => a.contrast - b.contrast);
};
