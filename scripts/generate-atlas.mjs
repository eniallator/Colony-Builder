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
// --strict exits non-zero if the game has tiles/items/entities with no sprite, or
// two colours which can sit side by side but are too close to tell apart.

import { checkContrast, MIN_CONTRAST } from "./atlas/contrast.mjs";
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

/** Reports a check's findings. Returns whether it found any. */
const report = (name, { found, error }, { pass, fail, line }) => {
  if (error != null) {
    console.warn(
      `${name} check skipped (could not load game registries): ${error}`
    );
  } else if (found.length > 0) {
    console.warn(`\n${fail(found.length)}`);
    for (const finding of found) console.warn(`  - ${line(finding)}`);
  } else {
    console.log(pass);
  }
  return error == null && found.length > 0;
};

const { missing, error: coverageError } = await checkCoverage(
  SPRITES.map(s => s.name)
);
const uncovered = report(
  "Coverage",
  { found: missing, error: coverageError },
  {
    pass: "Coverage: every tile, item and entity type has a sprite.",
    fail: count => `Missing art for ${count} game entries:`,
    line: ({ kind, id, sprite }) => `${kind} "${id}" needs sprite "${sprite}"`,
  }
);

const { clashes, error: contrastError } = await checkContrast(SPRITES);
const clashing = report(
  "Contrast",
  { found: clashes, error: contrastError },
  {
    pass: "Contrast: neighbouring colours can all be told apart.",
    fail: count =>
      `${count} pairs of neighbouring colours contrast less than ${MIN_CONTRAST}:`,
    line: ({ ids, contrast, colours }) =>
      `${contrast.toFixed(1).padStart(4)}  ${ids.join(" / ")} (${colours.join(" / ")})`,
  }
);

if (strict && (uncovered || clashing)) process.exit(1);
