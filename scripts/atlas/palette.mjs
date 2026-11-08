// The single source of truth for every colour in the game's art.
// Edit a value here and re-run `pnpm atlas` to restyle everything at once.
//
// Conventions (see art/STYLE_GUIDE.md):
//  - Ramps run dark -> light, 3-4 steps each.
//  - Terrain is muted and mid-value; machines, entities and items are warmer
//    and more saturated so they pop against it.
//  - Nothing uses pure black or pure white; outlines are a soft near-black.

export const PALETTE = {
  outline: "#1b1a22",

  // --- Terrain ramps (dark -> light) ---
  grass: ["#35693a", "#4a8340", "#629c48", "#86b95c"],
  sand: ["#b39656", "#cdb374", "#e0cc92", "#efe1b0"],
  stone: ["#4f5560", "#6b727c", "#868d96", "#a6adb4"],
  swamp: ["#2b4531", "#3b5a3a", "#51714a", "#7e9a5e"],
  puddle: ["#2d4338", "#3d5a4b", "#6f8f7c"],
  jungle: ["#173f27", "#22583a", "#2e7344", "#4a9552"],
  water: ["#2a4f8a", "#3a68a8", "#4d82bf", "#9cc8e6"],

  // --- Resources ---
  ore: ["#6c7f93", "#9fb4c8", "#cbd9e5"],
  oreDark: "#46556a", // deep shade for the underside of ore chunks
  rust: "#a8654a",
  rustDark: "#6e3f2e",
  log: {
    barkDark: "#5e3b20",
    bark: "#8a5a32",
    barkLight: "#a87644",
    skin: "#d9b27c",
    ring: "#b58a55",
  },

  // --- Machines ---
  belt: {
    rail: "#23252b",
    railHi: "#5c606b",
    base: "#43464f",
    arrow: "#e0a83a",
    arrowHi: "#f4cf6a",
  },
  robot: {
    dark: "#8a4e22",
    base: "#d98a3a",
    light: "#f0b866",
    visor: "#24303d",
    glow: "#7fe3ff",
    led: "#e0505a",
  },

  // --- Characters ---
  player: {
    tunic: "#2f9e9a",
    tunicDark: "#1d6663",
    tunicLight: "#58c4bd",
    skin: "#f0c8a0",
    hair: "#5a3a22",
    feet: "#3b3140",
  },

  // --- Accents ---
  flower: "#e8d870",
};
