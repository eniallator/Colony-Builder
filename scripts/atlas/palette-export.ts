import { mkdirSync, writeFileSync } from "node:fs";

import { hex } from "./core.ts";
import { PALETTE } from "./palette.ts";

const ART_DIR = new URL("../../art/", import.meta.url);

/** A ramp, or a named set of colours and ramps. */
type PaletteGroup =
  | readonly (string | PaletteGroup)[]
  | { readonly [name: string]: string | PaletteGroup };

/** Flattens PALETTE into [name, hex] pairs, e.g. ["grass-0", "#35693a"]. */
const flatten = (
  group: PaletteGroup = PALETTE,
  prefix = ""
): [name: string, colour: string][] =>
  Object.entries<string | PaletteGroup>(group).flatMap(([key, v]) => {
    const name = prefix === "" ? key : `${prefix}-${key}`;
    return typeof v === "string" ? [[name, v]] : flatten(v, name);
  });

/**
 * Exports the palette for art tools:
 *  - palette.gpl: GIMP palette (Aseprite, LibreSprite, Pixelorama, Krita import it)
 *  - palette.hex: plain hex list (Lospec / most pixel editors)
 */
export const writePalette = (): number => {
  const entries = flatten();
  const gpl = [
    "GIMP Palette",
    "Name: Colony Builder",
    "Columns: 8",
    "#",
    ...entries.map(([name, h]) => {
      const [r, g, b] = hex(h).map(n => String(n).padStart(3));
      return `${r} ${g} ${b}\t${name}`;
    }),
    "",
  ].join("\n");
  const uniqueHexes = [...new Set(entries.map(([, h]) => h.slice(1)))];

  mkdirSync(ART_DIR, { recursive: true });
  writeFileSync(new URL("palette.gpl", ART_DIR), gpl);
  writeFileSync(new URL("palette.hex", ART_DIR), uniqueHexes.join("\n") + "\n");
  return entries.length;
};
