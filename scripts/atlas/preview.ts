// Renders a small test scene at 4x so the art can be judged together
// (cohesion matters more than any single sprite).

import { writeFileSync } from "node:fs";
import { raise } from "niall-utils/core";

import { variantIndex } from "../../client/src/render/sprite.ts";
import { conveyorSpriteName } from "../../client/src/render/structure-sprites.ts";
import type { Tile } from "../../shared/src/world/terrain/types.ts";
import { TILE, tilesTall, type Pixels } from "./core.ts";
import { blit, encodePng } from "./png.ts";
import type { Sprite } from "./sprites/define.ts";

/** A sprite placed on a tile of the scene, showing its first frame unless told. */
type Placed = [tx: number, ty: number, name: string, frame?: number];

const SCENE: [string, ...string[]] = [
  "oooooggggggggggsswww",
  "ooooggggggggggsswwww",
  "ooogggggggggggsswwww",
  "mmgggggggggggssswwww",
  "mmmggggggggggsssswww",
  "gggggggggggggggggsss",
  "gggggggggggggggggggg",
  "ttttggggggggggggggoo",
  "ttiiggggggggggggoooo",
  "ttiittgggggggggggooo",
  "tttttttggggggggggggg",
  "ttttttgggggggggggggg",
];
const SCENE_TILES: Partial<Record<string, Tile>> = {
  g: "grass",
  s: "sand",
  w: "water",
  t: "stone",
  i: "iron_deposit",
  o: "moss",
  m: "marsh",
};
const SCENE_ENTITIES: Placed[] = [
  [9, 6, "robot_right"],
  [11, 6, "player_down"],
  [4, 6, "player_left"],
  [14, 10, "robot_left"],
  [12, 4, "item_iron_ore"],
  [6, 2, "item_log"],
  [9, 5, "item_iron_ore"],
  // The gather swing, one frame per tile: a robot and a player for each facing.
  ...["up", "down", "left", "right"].flatMap((dir, row) =>
    [0, 1, 2, 3].flatMap((frame): Placed[] => [
      [6 + frame, 8 + row, `robot_gather_${dir}`, frame],
      [11 + frame, 8 + row, `player_gather_${dir}`, frame],
    ])
  ),
];
const SCENE_STRUCTURES: Placed[] = [
  [6, 8, "tree"],
  [9, 9, "tree"],
  [2, 3, "cactus"],
  [5, 4, "cactus"],
  [1, 1, "fern"],
  [3, 2, "fern"],
  [18, 8, "fern"],
  [1, 5, "item_fibre"],
];
// A belt going right that turns up, and one going left that turns up.
const SCENE_BELTS: Placed[] = [
  ...[7, 8, 9, 10, 11, 12].map((x): Placed => [
    x,
    5,
    conveyorSpriteName("right"),
  ]),
  [13, 5, conveyorSpriteName("up", "anticlockwise")],
  ...[4, 3, 2].map((y): Placed => [13, y, conveyorSpriteName("up")]),
  ...[17, 16, 15, 14, 13].map((x): Placed => [
    x,
    10,
    conveyorSpriteName("left"),
  ]),
  [12, 10, conveyorSpriteName("up", "clockwise")],
  ...[9, 8].map((y): Placed => [12, y, conveyorSpriteName("up")]),
];
const SCALE = 4;

export const writePreview = (
  path: string,
  sprites: readonly Sprite[]
): void => {
  const frames = new Map(sprites.map(({ name, frames }) => [name, frames]));
  const frameOf = (name: string, index: number): Pixels => {
    const found = frames.get(name);
    return (
      found?.[index % found.length] ??
      raise(new Error(`preview needs missing sprite "${name}"`))
    );
  };

  const width = SCENE[0].length * TILE * SCALE;
  const height = SCENE.length * TILE * SCALE;
  const pixels = new Uint8Array(width * height * 4);
  const draw = (name: string, index: number, tx: number, ty: number) => {
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
  };

  SCENE.forEach((line, ty) => {
    if (line.length !== SCENE[0].length)
      throw new Error(`scene row ${ty} is ragged`);
    Array.from(line).forEach((ch, tx) => {
      const name = SCENE_TILES[ch];
      if (name == null) throw new Error(`unknown scene char "${ch}"`);
      // Variants are picked by position as the game does it, to show variety.
      const looks = frames.get(name)?.length ?? 0;
      draw(name, variantIndex(tx, ty, looks), tx, ty);
    });
  });
  // Belts lie on the ground, so they have no shadow.
  for (const [tx, ty, name] of SCENE_BELTS) draw(name, 1, tx, ty);
  // Structures stand on their tile; a taller sprite reaches up from its foot.
  for (const [tx, ty, name] of SCENE_STRUCTURES) {
    const tall = tilesTall(frameOf(name, 0));
    draw("shadow_small", 0, tx, ty);
    draw(name, 0, tx, ty + 1 - tall);
  }
  for (const [tx, ty, name, frame = 0] of SCENE_ENTITIES) {
    draw("shadow", 0, tx, ty);
    draw(name, frame, tx, ty);
  }
  writeFileSync(path, encodePng(width, height, pixels));
};
