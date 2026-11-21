import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Atlas, AtlasSprite } from "../render/atlas.ts";

const { getAtlas } = vi.hoisted(() => ({
  getAtlas: vi.fn<() => Atlas | undefined>(),
}));
vi.mock("../render/atlas.ts", () => ({ getAtlas }));

const bitmap = { width: 16, height: 16 } as ImageBitmap;

const spriteWith = (frames: ImageBitmap[]): AtlasSprite => ({
  mode: "frames",
  cells: [],
  colour: "#000000",
  ground: 0,
  frames,
});

const atlasWith = (names: string[]): Atlas => ({
  tileSize: 16,
  sheet: bitmap,
  sprites: new Map(names.map(name => [name, spriteWith([bitmap])])),
});

const cssVar = (name: string) =>
  document.documentElement.style.getPropertyValue(name);

// The module paints once and remembers it, so each test gets a fresh copy.
const load = async () => (await import("./ui-textures.ts")).paintUiTextures;

describe("paintUiTextures", () => {
  const drawImage = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    getAtlas.mockReset();
    drawImage.mockReset();
    document.documentElement.removeAttribute("style");
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
      "data:image/png;base64,AAAA"
    );
  });

  it("does nothing until the atlas has loaded", async () => {
    const paintUiTextures = await load();
    getAtlas.mockReturnValue(undefined);

    paintUiTextures();

    expect(cssVar("--ui-panel")).toBe("");
  });

  it("exposes each interface sprite as a kebab-case image variable", async () => {
    const paintUiTextures = await load();
    getAtlas.mockReturnValue(
      atlasWith(["ui_panel", "ui_button", "ui_button_hover", "ui_button_down"])
    );

    paintUiTextures();

    for (const name of [
      "--ui-panel",
      "--ui-button",
      "--ui-button-hover",
      "--ui-button-down",
    ]) {
      expect(cssVar(name)).toBe('url("data:image/png;base64,AAAA")');
    }
    expect(drawImage).toHaveBeenCalledTimes(4);
  });

  it("skips sprites the atlas does not have", async () => {
    const paintUiTextures = await load();
    getAtlas.mockReturnValue(atlasWith(["ui_panel"]));

    paintUiTextures();

    expect(cssVar("--ui-panel")).not.toBe("");
    expect(cssVar("--ui-button")).toBe("");
  });

  it("paints only once", async () => {
    const paintUiTextures = await load();
    getAtlas.mockReturnValue(atlasWith(["ui_panel"]));

    paintUiTextures();
    paintUiTextures();

    expect(drawImage).toHaveBeenCalledOnce();
  });
});

describe("setupUiScale", () => {
  const setupAt = async (devicePixelRatio: number) => {
    vi.stubGlobal("devicePixelRatio", devicePixelRatio);
    vi.resetModules();
    (await import("./ui-textures.ts")).setupUiScale();
  };

  beforeEach(() => {
    document.documentElement.removeAttribute("style");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is 2 CSS pixels per art pixel at 100% scale", async () => {
    await setupAt(1);

    expect(cssVar("--art-px")).toBe("2px");
  });

  it("snaps to a whole number of device pixels at a fractional scale", async () => {
    // 2 * 1.25 = 2.5 device pixels would be uneven; 3 device pixels is 2.4px.
    await setupAt(1.25);

    expect(cssVar("--art-px")).toBe(`${3 / 1.25}px`);
  });

  it("never drops below one device pixel per art pixel", async () => {
    await setupAt(0.1);

    expect(cssVar("--art-px")).toBe(`${1 / 0.1}px`);
  });

  it("follows the display scale when the window is resized", async () => {
    await setupAt(1);

    vi.stubGlobal("devicePixelRatio", 1.25);
    window.dispatchEvent(new Event("resize"));

    expect(cssVar("--art-px")).toBe(`${3 / 1.25}px`);
  });
});
