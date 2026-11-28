// The sprite registry. Order here is the packing order in the atlas, so new
// categories can be appended freely: the atlas grows in rows automatically.
// Adding content never needs changes outside the category's own file.

import { conveyors } from "./conveyors.ts";
import type { Sprite } from "./define.ts";
import { effects } from "./effects.ts";
import { entities } from "./entities.ts";
import { items } from "./items.ts";
import { structures } from "./structures.ts";
import { terrain } from "./terrain.ts";
import { ui } from "./ui.ts";

export const SPRITES: Sprite[] = [
  ...terrain,
  ...effects,
  ...items,
  ...conveyors,
  ...entities,
  ...structures,
  ...ui,
];

const seen = new Set<string>();
for (const { name } of SPRITES) {
  if (seen.has(name)) throw new Error(`duplicate sprite name "${name}"`);
  seen.add(name);
}
