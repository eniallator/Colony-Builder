import {
  REGION_SIDE_LENGTH,
  regionPosToId,
  tiles,
  tileToId,
  World,
  type Tile,
} from "@colony-builder/shared";
import { raise } from "niall-utils/core";
import { Vector } from "vectyped";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getAtlas, type Atlas } from "../atlas.ts";
import { variantIndex } from "../sprite.ts";
import {
  atlasOf,
  createFakeContext,
  createSystemArgs,
  FakePath,
  FakePattern,
  spriteOf,
  type SystemArgs,
} from "./render-test-utils.ts";
import { renderTiles } from "./render-tiles.ts";

vi.mock("../atlas.ts", () => ({ getAtlas: vi.fn() }));

const [tileA, tileB] = tiles;
const [colourA, colourB] = ["#aa0000", "#0000bb"];

/** A region of `tileA`, with the given tiles changed. */
const worldOf = (...changes: [x: number, y: number, tile: Tile][]) => {
  const world = new World();
  world.terrain.add(
    regionPosToId(0, 0),
    Array.from({ length: REGION_SIDE_LENGTH ** 2 }, () => tileToId(tileA))
  );
  for (const [x, y, tile] of changes) {
    world.terrain.addTile(x, y, tileToId(tile));
  }
  return world;
};

// The camera is on the middle of the region, so at the zooms below the canvas
// shows all of it (2px per tile) or a part of it (8px per tile).
const regionCentre = Vector.create(
  REGION_SIDE_LENGTH / 2,
  REGION_SIDE_LENGTH / 2
);
const camera = (zoom: number) => ({ center: regionCentre.copy(), zoom });

const rectsOf = (shape: unknown) =>
  shape instanceof FakePath ? shape.rects : raise(new Error("Not a path"));

describe("renderTiles", () => {
  beforeEach(() => {
    vi.stubGlobal("Path2D", FakePath);
    vi.mocked(getAtlas).mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const render = (atlas: Atlas | undefined, overrides: Partial<SystemArgs>) => {
    vi.mocked(getAtlas).mockReturnValue(atlas);
    const fake = createFakeContext();
    renderTiles(
      createSystemArgs({ ctx: fake.ctx, world: worldOf(), ...overrides })
    );
    return fake;
  };

  it("draws nothing until the atlas has loaded", () => {
    const { painted } = render(undefined, { camera: camera(1) });

    expect(painted).toEqual([]);
  });

  it("draws nothing where the terrain has not loaded", () => {
    const { painted } = render(
      atlasOf({ [tileA]: spriteOf({ colour: colourA }) }),
      { world: new World(), camera: camera(1) }
    );

    expect(painted).toEqual([]);
  });

  describe("zoomed out", () => {
    // At 2px per tile the sprites are flat colours, and the whole region fits.
    const zoom = 1;
    const atlas = atlasOf({
      [tileA]: spriteOf({ colour: colourA }),
      [tileB]: spriteOf({ colour: colourB }),
    });

    it("fills each row of a uniform region as one rect, all in one fill", () => {
      const { painted } = render(atlas, { camera: camera(zoom) });

      expect(painted).toHaveLength(1);
      expect(painted[0]?.style).toBe(colourA);
      // The origin is at (34, 9) on the canvas, and a row is a region's width
      // of 2px tiles.
      const rects = rectsOf(painted[0]?.shape);
      expect(rects).toHaveLength(REGION_SIDE_LENGTH);
      expect(rects[0]).toEqual([34, 9, 2 * REGION_SIDE_LENGTH, 2]);
      expect(rects[1]).toEqual([34, 11, 2 * REGION_SIDE_LENGTH, 2]);
    });

    it("splits a row where the tile changes, with one fill per look", () => {
      const { painted } = render(atlas, {
        camera: camera(zoom),
        world: worldOf([4, 0, tileB]),
      });

      expect(painted.map(({ style }) => style)).toEqual([colourA, colourB]);
      expect(rectsOf(painted[0]?.shape)).toContainEqual([34, 9, 8, 2]);
      expect(rectsOf(painted[0]?.shape)).toContainEqual([44, 9, 22, 2]);
      expect(rectsOf(painted[1]?.shape)).toEqual([[42, 9, 2, 2]]);
    });

    it("skips tiles whose sprite is not in the atlas", () => {
      const { painted } = render(
        atlasOf({ [tileA]: spriteOf({ colour: colourA }) }),
        { camera: camera(zoom), world: worldOf([4, 0, tileB]) }
      );

      expect(painted.map(({ style }) => style)).toEqual([colourA]);
      expect(rectsOf(painted[0]?.shape)).toContainEqual([34, 9, 8, 2]);
      expect(rectsOf(painted[0]?.shape)).toContainEqual([44, 9, 22, 2]);
    });

    it("needs no texture patterns", () => {
      const { context } = render(atlas, { camera: camera(zoom) });

      expect(context.createPattern).not.toHaveBeenCalled();
    });
  });

  describe("textured", () => {
    // 8px per tile is half the art's size: textured, and shrunk.
    const zoom = 3;
    // The canvas shows the region from tile (1, 4) on, with its origin here.
    const origin = [-14, -39] as const;
    // Each test needs bitmaps of its own, since a bitmap's pattern is cached.
    const makeBitmaps = () => [{}, {}] as ImageBitmap[];

    it("fills with the sprite's texture, scaled to the tile size and anchored to the origin", () => {
      const { painted, context } = render(atlasOf({ [tileA]: spriteOf() }), {
        camera: camera(zoom),
      });

      expect(painted).toHaveLength(1);
      const pattern = painted[0]?.style;
      expect(pattern).toBeInstanceOf(FakePattern);
      expect((pattern as FakePattern).setTransform).toHaveBeenCalledWith({
        a: 0.5,
        d: 0.5,
        e: origin[0],
        f: origin[1],
      });
      expect(context.imageSmoothingEnabled).toBe(true);
    });

    it("does not smooth when the art is shown at its own size or larger", () => {
      const { context } = render(atlasOf({ [tileA]: spriteOf() }), {
        camera: camera(4),
      });

      expect(context.imageSmoothingEnabled).toBe(false);
    });

    it("picks a variant by tile, and uses every texture", () => {
      const bitmaps = makeBitmaps();
      const { painted, context } = render(
        atlasOf({ [tileA]: spriteOf({ mode: "variants", frames: bitmaps }) }),
        { camera: camera(zoom) }
      );

      expect(new Set(painted.map(({ style }) => style)).size).toBe(
        bitmaps.length
      );

      // The texture of the tile's variant is the one painted over the tile.
      const [x, y] = [4, 6];
      const expected = bitmaps[variantIndex(x, y, bitmaps.length)];
      const made = context.createPattern.mock.calls.findIndex(
        ([bitmap]) => bitmap === expected
      );
      const tileX = origin[0] + x * 8;
      const tileY = origin[1] + y * 8;
      const covering = painted.find(({ shape }) =>
        rectsOf(shape).some(
          ([left, top, width, height]) =>
            left <= tileX &&
            tileX < left + width &&
            top <= tileY &&
            tileY < top + height
        )
      );
      expect(covering?.style).toBe(
        context.createPattern.mock.results[made]?.value
      );
    });

    it("shows the frame of an animation that is showing now", () => {
      const bitmaps = makeBitmaps();
      const { context } = render(
        atlasOf({ [tileA]: spriteOf({ frames: bitmaps, frameSec: 1 }) }),
        {
          camera: camera(zoom),
          time: { now: 1, start: 0, lastFrame: 0.99, delta: 0.01 },
        }
      );

      expect(context.createPattern).toHaveBeenCalledExactlyOnceWith(
        bitmaps[1],
        "repeat"
      );
    });

    it("throws for a sprite with no frames", () => {
      expect(() =>
        render(atlasOf({ [tileA]: spriteOf({ frames: [] }) }), {
          camera: camera(zoom),
        })
      ).toThrow(`Sprite "${tileA}" has no frames`);
    });
  });
});
