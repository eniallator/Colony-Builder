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
  swamp: ["#44391f", "#63532d", "#7b6a3e", "#a0905c"],
  puddle: ["#2d4338", "#3d5a4b", "#6f8f7c"],
  jungle: ["#08241b", "#103a2c", "#1b543d", "#317a54"],
  water: ["#2a4f8a", "#3a68a8", "#4d82bf", "#9cc8e6"],
  // Broad patches that break up a terrain's base: [darker, lighter], each only
  // a hair from the base so they read as ground rather than detail.
  patch: {
    grass: ["#457c3e", "#508a42"],
    sand: ["#c6ac6e", "#d3ba7b"],
    water: ["#3662a1", "#3f6fb0"],
    stone: ["#656c76", "#727984"],
    swamp: ["#5d4e2a", "#695931"],
    jungle: ["#0e3427", "#134031"],
  },

  // --- Resources ---
  ore: ["#6c7f93", "#9fb4c8", "#cbd9e5"],
  oreDark: "#46556a", // deep shade for the underside of ore chunks
  rust: "#a8654a",
  rustDark: "#6e3f2e",
  copper: ["#8e4a3c", "#c8704f", "#ec9f7c"],
  copperDark: "#5c2f2c", // deep shade for the underside of copper chunks
  verdigris: "#4fae94",
  verdigrisDark: "#2f6f62",
  log: {
    barkDark: "#5e3b20",
    bark: "#8a5a32",
    barkLight: "#a87644",
    skin: "#d9b27c",
    ring: "#b58a55",
  },

  // --- Structures (grown on the terrain) ---
  // Foliage is much deeper and bluer than grass, so trees stand out on it, even
  // as the single flat colour they draw as when zoomed far out.
  leaf: ["#10332b", "#1b4d38", "#286640", "#448a4c"],
  // Bright, fresh fronds, so ferns show up against the dark jungle floor.
  fern: ["#173f1a", "#3d8030", "#68ae42", "#a9da66"],
  // Cooler and bluer than grass, so cacti read as desert plants on sand.
  cactus: ["#2f5f45", "#437c52", "#5f9c62", "#8fc281"],
  // Rose caps on pale stalks: warm against the cool swamp and lighter than its
  // ground, and clear of the robot orange and the red LED.
  mushroom: {
    cap: ["#9a4a66", "#d4728a", "#f2a0a8", "#ffd0c8"],
    stalk: ["#9c8672", "#c9b497", "#ebdcc0"],
  },

  // --- Machines ---
  // Dark steel, much darker than stone so belts show up when zoomed out, with
  // amber arrows.
  belt: {
    rail: "#202228",
    railHi: "#666b78",
    base: "#363a44",
    arrow: "#d9b45c",
    arrowHi: "#eed38a",
  },
  robot: {
    dark: "#8a4e22",
    base: "#d98a3a",
    light: "#f0b866",
    visor: "#24303d",
    code: "#a9da66", // program text on the back panel; never the eyes' glow
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

  // --- UI (panels and buttons, drawn as 9-slice boxes) ---
  // Each box is fill / hi (top-left bevel) / lo (bottom-right bevel). Panels
  // are a deep indigo and buttons the jungle greens, so UI is as colourful as
  // the world but stays clear of the colour roles below (orange = robots, teal =
  // player, amber = logistics).
  ui: {
    panel: { fill: "#3a2f5e", hi: "#564a86", lo: "#251e42" },
    button: { fill: "#2e7344", hi: "#4a9552", lo: "#173f27" },
    buttonHover: { fill: "#4a9552", hi: "#6fb468", lo: "#22583a" },
    text: "#f4ecd8",
  },

  // --- Accents ---
  flower: "#e8d870",
};
