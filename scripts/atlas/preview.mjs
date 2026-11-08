// Renders a small test scene at 4x so the art can be judged together
// (cohesion matters more than any single sprite).

import { writeFileSync } from "node:fs";

import { TILE } from "./core.mjs";
import { blit, encodePng } from "./png.mjs";

const SCENE = [
  "jjjjjggggggggggsswww",
  "jjjjggggggggggsswwww",
  "jjjgggggggggggsswwww",
  "mmgggggggggggssswwww",
  "mmmggggggggggsssswww",
  "ggggggg>>>>>>>>>gsss",
  "ggggggggggggggggvggg",
  "ttttggggggggggggvgjj",
  "ttiiggggggggggggjjjj",
  "ttiittgggggggggggjjj",
  "tttttttggggg<<<<<ggg",
  "ttttttgggggggggggggg",
];
const SCENE_TILES = {
  g: "grass",
  s: "sand",
  w: "water",
  t: "stone",
  i: "iron_deposit",
  j: "jungle",
  m: "swampland",
  ">": "conveyor_right",
  "<": "conveyor_left",
  v: "conveyor_down",
  "^": "conveyor_up",
};
const SCENE_ENTITIES = [
  [9, 6, "robot_right"],
  [11, 6, "player_down"],
  [4, 6, "player_left"],
  [14, 10, "robot_left"],
  [12, 4, "item_iron_ore"],
  [6, 2, "item_log"],
  [9, 5, "item_iron_ore"],
];
const SCALE = 4;

export const writePreview = (path, sprites) => {
  const frames = new Map(sprites.map(({ name, frames }) => [name, frames]));
  const frameOf = (name, index) => {
    const found = frames.get(name);
    if (found == null)
      throw new Error(`preview needs missing sprite "${name}"`);
    return found[index % found.length];
  };

  const width = SCENE[0].length * TILE * SCALE;
  const height = SCENE.length * TILE * SCALE;
  const pixels = new Uint8Array(width * height * 4);
  const draw = (name, index, tx, ty) =>
    blit(
      pixels,
      width,
      frameOf(name, index),
      tx * TILE * SCALE,
      ty * TILE * SCALE,
      {
        scale: SCALE,
      }
    );

  SCENE.forEach((line, ty) => {
    if (line.length !== SCENE[0].length)
      throw new Error(`scene row ${ty} is ragged`);
    [...line].forEach((ch, tx) => {
      const name = SCENE_TILES[ch];
      if (name == null) throw new Error(`unknown scene char "${ch}"`);
      // Deterministic per-position variant so the preview shows variety.
      draw(
        name,
        name.startsWith("conveyor") ? 1 : (tx * 7 + ty * 13) % 4,
        tx,
        ty
      );
    });
  });
  for (const [tx, ty, name] of SCENE_ENTITIES) {
    draw("shadow", 0, tx, ty);
    draw(name, 0, tx, ty);
  }
  writeFileSync(path, encodePng(width, height, pixels));
};
