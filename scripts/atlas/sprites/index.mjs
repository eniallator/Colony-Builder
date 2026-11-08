// The sprite registry. Order here is the packing order in the atlas, so new
// categories can be appended freely: the atlas grows in rows automatically.
// Adding content never needs changes outside the category's own file.

import { conveyors } from "./conveyors.mjs";
import { effects } from "./effects.mjs";
import { entities } from "./entities.mjs";
import { items } from "./items.mjs";
import { terrain } from "./terrain.mjs";

export const SPRITES = [
  ...terrain,
  ...effects,
  ...items,
  ...conveyors,
  ...entities,
];

const seen = new Set();
for (const { name } of SPRITES) {
  if (seen.has(name)) throw new Error(`duplicate sprite name "${name}"`);
  seen.add(name);
}
