import { afterEach, describe, expect, it, vi } from "vitest";

import { isAtlasJson, loadAtlas } from "./atlas.ts";

// The loader treats sprite names as opaque, so these say what each one is for.
const validJson = {
  tileSize: 16,
  columns: 16,
  sprites: {
    variants: {
      mode: "variants",
      cells: [
        [0, 0],
        [1, 0],
      ],
      colour: "#4b8341",
      ground: 16,
    },
    timed: {
      mode: "frames",
      cells: [[2, 0]],
      colour: "#3a68a8",
      ground: 16,
      frameSec: 0.3,
    },
    moving: {
      mode: "frames",
      cells: [[3, 0]],
      colour: "#444444",
      ground: 16,
      stepPx: 2,
      raise: 3,
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
        variants: { ...validJson.sprites.variants, mode: "random" },
      },
    };
    expect(isAtlasJson(bad)).toBe(false);
  });

  it("rejects a sprite with no colour", () => {
    const bad = {
      ...validJson,
      sprites: { variants: { mode: "variants", cells: [[0, 0]] } },
    };
    expect(isAtlasJson(bad)).toBe(false);
  });

  it("rejects malformed cells", () => {
    const bad = {
      ...validJson,
      sprites: {
        variants: {
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
        variants: { mode: "variants", cells: [[0, 0]], colour: "#000000" },
      },
    };
    expect(isAtlasJson(bad)).toBe(false);
  });

  it("rejects non-numeric animation timing", () => {
    const bad = {
      ...validJson,
      sprites: {
        timed: { ...validJson.sprites.timed, frameSec: "fast" },
      },
    };
    expect(isAtlasJson(bad)).toBe(false);
  });

  it("rejects a non-numeric raise", () => {
    const bad = {
      ...validJson,
      sprites: {
        moving: { ...validJson.sprites.moving, raise: "high" },
      },
    };
    expect(isAtlasJson(bad)).toBe(false);
  });

  it("rejects a non-integer row count", () => {
    const bad = {
      ...validJson,
      sprites: {
        variants: { ...validJson.sprites.variants, rows: "two" },
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

    const { variants, timed, moving } = validJson.sprites;
    expect(atlas.tileSize).toBe(validJson.tileSize);
    expect([...atlas.sprites.keys()]).toEqual(Object.keys(validJson.sprites));

    const loaded = atlas.sprites.get("variants");
    expect(loaded?.mode).toBe(variants.mode);
    expect(loaded?.colour).toBe(variants.colour);
    expect(loaded?.ground).toBe(variants.ground);
    expect(atlas.sprites.get("timed")?.frameSec).toBe(timed.frameSec);
    expect(atlas.sprites.get("moving")?.stepPx).toBe(moving.stepPx);
    expect(atlas.sprites.get("moving")?.raise).toBe(moving.raise);
    expect(loaded?.cells).toEqual(variants.cells);
    expect(loaded?.frames).toHaveLength(variants.cells.length);

    // Cells are cropped at col * tileSize, row * tileSize.
    const { tileSize } = validJson;
    const crops = createImageBitmap.mock.calls
      .filter(([source]) => source === sheet)
      .map(([, ...rest]) => rest);
    expect(crops).toEqual(
      [...variants.cells, ...timed.cells, ...moving.cells].map(([col, row]) => [
        (col ?? 0) * tileSize,
        (row ?? 0) * tileSize,
        tileSize,
        tileSize,
      ])
    );
  });

  it("cuts a tall sprite's cells as tall as its rows", async () => {
    const [col, row, rows] = [4, 2, 2];
    const tall = {
      ...validJson,
      sprites: {
        tall: {
          mode: "frames",
          cells: [[col, row]],
          colour: "#33703a",
          ground: 32,
          rows,
        },
      },
    };
    const { createImageBitmap, sheet } = stubNetwork(tall);

    const atlas = await loadAtlas();

    const { tileSize } = validJson;
    expect(atlas.sprites.get("tall")?.rows).toBe(rows);
    expect(
      createImageBitmap.mock.calls
        .filter(([source]) => source === sheet)
        .map(([, ...rest]) => rest)
    ).toEqual([[col * tileSize, row * tileSize, tileSize, rows * tileSize]]);
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
