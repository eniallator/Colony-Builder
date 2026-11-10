import { afterEach, describe, expect, it, vi } from "vitest";

import { isAtlasJson, loadAtlas } from "./atlas.ts";

const validJson = {
  tileSize: 16,
  columns: 16,
  sprites: {
    grass: {
      mode: "variants",
      cells: [
        [0, 0],
        [1, 0],
      ],
      colour: "#4b8341",
      ground: 16,
    },
    water: {
      mode: "frames",
      cells: [[2, 0]],
      colour: "#3a68a8",
      ground: 16,
      frameMs: 300,
    },
    conveyor_up: {
      mode: "frames",
      cells: [[3, 0]],
      colour: "#444444",
      ground: 16,
      stepPx: 2,
    },
  },
};

describe("isAtlasJson", () => {
  it("accepts a valid atlas", () => {
    expect(isAtlasJson(validJson)).toBe(true);
  });

  it("rejects an unknown mode", () => {
    const bad = {
      ...validJson,
      sprites: {
        grass: { ...validJson.sprites.grass, mode: "random" },
      },
    };
    expect(isAtlasJson(bad)).toBe(false);
  });

  it("rejects a sprite with no colour", () => {
    const bad = {
      ...validJson,
      sprites: { grass: { mode: "variants", cells: [[0, 0]] } },
    };
    expect(isAtlasJson(bad)).toBe(false);
  });

  it("rejects malformed cells", () => {
    const bad = {
      ...validJson,
      sprites: {
        grass: {
          mode: "variants",
          cells: [[0]],
          colour: "#000000",
          ground: 16,
        },
      },
    };
    expect(isAtlasJson(bad)).toBe(false);
  });

  it("rejects a sprite with no ground line", () => {
    const bad = {
      ...validJson,
      sprites: {
        grass: { mode: "variants", cells: [[0, 0]], colour: "#000000" },
      },
    };
    expect(isAtlasJson(bad)).toBe(false);
  });

  it("rejects non-numeric animation timing", () => {
    const bad = {
      ...validJson,
      sprites: {
        water: { ...validJson.sprites.water, frameMs: "fast" },
      },
    };
    expect(isAtlasJson(bad)).toBe(false);
  });

  it("rejects non-objects", () => {
    expect(isAtlasJson(undefined)).toBe(false);
    expect(isAtlasJson("atlas")).toBe(false);
  });
});

describe("loadAtlas", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const stubNetwork = (json: unknown, ok = true) => {
    const sheet = { name: "sheet" };
    const createImageBitmap = vi.fn((source: unknown, ...rest: unknown[]) =>
      Promise.resolve(source === sheet ? { crop: rest } : sheet)
    );
    const fetchStub = vi.fn((url: string) =>
      Promise.resolve({
        ok,
        status: ok ? 200 : 404,
        json: () => Promise.resolve(json),
        blob: () => Promise.resolve({ url }),
      })
    );
    vi.stubGlobal("fetch", fetchStub);
    vi.stubGlobal("createImageBitmap", createImageBitmap);
    return { fetchStub, createImageBitmap, sheet };
  };

  it("loads both files from the base url", async () => {
    const { fetchStub } = stubNetwork(validJson);
    await loadAtlas();
    expect(fetchStub.mock.calls.map(([url]) => url).sort()).toEqual([
      "textures/atlas.json",
      "textures/atlas.png",
    ]);
  });

  it("builds a sprite per entry, cutting each cell out of the sheet", async () => {
    const { createImageBitmap, sheet } = stubNetwork(validJson);
    const atlas = await loadAtlas();

    expect(atlas.tileSize).toBe(16);
    expect([...atlas.sprites.keys()]).toEqual([
      "grass",
      "water",
      "conveyor_up",
    ]);

    const grass = atlas.sprites.get("grass");
    expect(grass?.mode).toBe("variants");
    expect(grass?.colour).toBe("#4b8341");
    expect(grass?.ground).toBe(16);
    expect(atlas.sprites.get("water")?.frameMs).toBe(300);
    expect(atlas.sprites.get("conveyor_up")?.stepPx).toBe(2);
    expect(grass?.cells).toEqual([
      [0, 0],
      [1, 0],
    ]);
    expect(grass?.frames).toHaveLength(2);

    // Cells are cropped at col * tileSize, row * tileSize.
    const crops = createImageBitmap.mock.calls
      .filter(([source]) => source === sheet)
      .map(([, ...rest]) => rest);
    expect(crops).toEqual([
      [0, 0, 16, 16],
      [16, 0, 16, 16],
      [32, 0, 16, 16],
      [48, 0, 16, 16],
    ]);
  });

  it("rejects when a file fails to load", async () => {
    stubNetwork(validJson, false);
    await expect(loadAtlas()).rejects.toThrow(/Failed to load/);
  });

  it("rejects an invalid atlas.json", async () => {
    stubNetwork({ tileSize: 16 });
    await expect(loadAtlas()).rejects.toThrow(/not a valid texture atlas/);
  });
});
