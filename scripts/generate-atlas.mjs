// Generates the pixel-art texture atlas and exports the palette.
//
//   node scripts/generate-atlas.mjs [--preview <out.png>] [--strict]
//
// Outputs:
//   client/public/textures/atlas.png + atlas.json   (the game's textures)
//   art/palette.gpl + art/palette.hex                (palette for art tools)
//
// Adding content: see art/STYLE_GUIDE.md ("Adding new art"). Sprite
// definitions live in scripts/atlas/sprites/, colours in scripts/atlas/palette.mjs.
//
// --strict exits non-zero if the game has tiles/items/entities with no sprite.

import { checkCoverage } from "./atlas/coverage.mjs";
import { writeAtlas } from "./atlas/pack.mjs";
import { writePalette } from "./atlas/palette-export.mjs";
import { writePreview } from "./atlas/preview.mjs";
import { SPRITES } from "./atlas/sprites/index.mjs";

const args = process.argv.slice(2);
const strict = args.includes("--strict");
const previewIndex = args.indexOf("--preview");
const previewPath = previewIndex === -1 ? null : args[previewIndex + 1];

const { cells, rows } = writeAtlas(SPRITES);
const colours = writePalette();
if (previewPath != null) writePreview(previewPath, SPRITES);

const frameCount = Object.values(cells).reduce((n, c) => n + c.length, 0);
console.log(
  `Atlas: ${Object.keys(cells).length} sprites, ${frameCount} frames, 16x${rows} cells. Palette: ${colours} colours.`
);

const { missing, error } = await checkCoverage(SPRITES.map(s => s.name));
if (error != null) {
  console.warn(
    `Coverage check skipped (could not load game registries): ${error}`
  );
} else if (missing.length > 0) {
  console.warn(`\nMissing art for ${missing.length} game entries:`);
  for (const { kind, id, sprite } of missing)
    console.warn(`  - ${kind} "${id}" needs sprite "${sprite}"`);
  if (strict) process.exit(1);
} else {
  console.log("Coverage: every tile, item and entity type has a sprite.");
}
