import {
  REGION_SIDE_LENGTH,
  type ConveyorData,
  type Facing,
} from "@colony-builder/shared";
import { Vector } from "vectyped";
import { describe, expect, it } from "vitest";

import type { AtlasSprite } from "../atlas.ts";
import { variantIndex } from "../sprite.ts";
import { conveyorSpriteName, type ConveyorBend } from "../structure-sprites.ts";
import {
  paintConveyor,
  paintWithShadow,
  spriteRect,
  sqrDistToSpriteMiddle,
  type Painter,
  type PaintOptions,
} from "./painter.ts";
import {
  atlasOf,
  createFakeContext,
  drawnColumns,
  FakePattern,
  spriteOf,
  TILE_SIZE,
} from "./render-test-utils.ts";

// The geometry below is worked out for a belt going right.
const facing: Facing = "right";
const bend: ConveyorBend = "clockwise";

const painterFor = (
  sprites: Record<string, AtlasSprite>,
  { textured = true, now = 0 } = {}
) => {
  const fake = createFakeContext();
  const painter: Painter = {
    ctx: fake.ctx,
    atlas: atlasOf(sprites),
    textured,
    now,
  };
  return { painter, ...fake };
};

describe("spriteRect", () => {
  const { painter } = painterFor({});

  it("centres a sprite on its foot, resting on its ground line", () => {
    const sprite = spriteOf({ ground: 12, rows: 2 });
    const size = 2 * TILE_SIZE;

    const { topLeft, dimensions } = spriteRect(
      painter,
      sprite,
      Vector.create(50, 40),
      size
    );

    // Half its width left of the foot, and its ground line scaled up to size.
    expect(topLeft.toArray()).toEqual([50 - size / 2, 40 - 12 * 2]);
    expect(dimensions.toArray()).toEqual([size, size * 2]);
  });

  it("rounds the corner to a whole pixel", () => {
    const { topLeft } = spriteRect(
      painter,
      spriteOf(),
      Vector.create(50.4, 40.6),
      TILE_SIZE
    );

    expect(topLeft.toArray()).toEqual([42, 25]);
  });

  it("is a flat square sitting on the foot when not textured", () => {
    const flat = { atlas: painter.atlas, textured: false };
    const sprite = spriteOf({ ground: 12, rows: 2 });
    const size = 8;

    const { topLeft, dimensions } = spriteRect(
      flat,
      sprite,
      Vector.create(50, 40),
      size
    );

    expect(topLeft.toArray()).toEqual([50 - size / 2, 40 - size]);
    expect(dimensions.toArray()).toEqual([size, size]);
  });

  it("is never smaller than a pixel when not textured", () => {
    const flat = { atlas: painter.atlas, textured: false };

    const { dimensions } = spriteRect(
      flat,
      spriteOf(),
      Vector.create(50, 40),
      0.3
    );

    expect(dimensions.toArray()).toEqual([1, 1]);
  });
});

describe("sqrDistToSpriteMiddle", () => {
  const name = "sprite";
  const { painter } = painterFor({ [name]: spriteOf() });
  const foot = Vector.create(50, 40);
  // A tile-sized sprite on its ground line spans x 42..58 and y 24..40.
  const middle = Vector.create(50, 32);

  it("is the squared distance from a point on the sprite to its middle", () => {
    const point = middle.copy().add([3, 4]);

    expect(sqrDistToSpriteMiddle(painter, name, foot, TILE_SIZE, point)).toBe(
      25
    );
  });

  it("is zero at the middle", () => {
    expect(
      sqrDistToSpriteMiddle(painter, name, foot, TILE_SIZE, middle.copy())
    ).toBe(0);
  });

  it("is null for a point off the sprite", () => {
    expect(
      sqrDistToSpriteMiddle(painter, name, foot, TILE_SIZE, Vector.create(0, 0))
    ).toBeNull();
  });

  it("is null for a sprite that is not in the atlas", () => {
    expect(
      sqrDistToSpriteMiddle(painter, "missing", foot, TILE_SIZE, middle.copy())
    ).toBeNull();
  });
});

describe("paintWithShadow", () => {
  const shadow = "shadow_small";
  const name = "sprite";
  const foot = Vector.create(50, 40);

  it("draws the shadow, then the sprite, each on its ground line", () => {
    const { painter, context } = painterFor({
      [shadow]: spriteOf({ cells: [[3, 0]], ground: 8 }),
      [name]: spriteOf({ cells: [[1, 2]], ground: 32, rows: 2 }),
    });
    const { sheet } = painter.atlas;

    paintWithShadow(painter, shadow, name, foot, TILE_SIZE);

    expect(context.drawImage).toHaveBeenCalledTimes(2);
    expect(context.drawImage).toHaveBeenNthCalledWith(
      1,
      sheet,
      ...[3 * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE],
      ...[42, 32, TILE_SIZE, TILE_SIZE]
    );
    // A tall sprite is cut as tall as its rows, and drawn as tall.
    expect(context.drawImage).toHaveBeenNthCalledWith(
      2,
      sheet,
      ...[TILE_SIZE, 2 * TILE_SIZE, TILE_SIZE, 2 * TILE_SIZE],
      ...[42, 8, TILE_SIZE, 2 * TILE_SIZE]
    );
  });

  it("paints a flat square of the sprite's colour, with no shadow, when not textured", () => {
    const colour = "#abcdef";
    const { painter, context, painted } = painterFor(
      {
        [shadow]: spriteOf({ colour: "#000000" }),
        [name]: spriteOf({ colour }),
      },
      { textured: false }
    );
    const size = 4;

    paintWithShadow(painter, shadow, name, foot, size);

    expect(context.drawImage).not.toHaveBeenCalled();
    expect(painted).toEqual([{ style: colour, shape: [48, 36, size, size] }]);
  });

  it("draws nothing for a sprite that is not in the atlas", () => {
    const { painter, context, painted } = painterFor({});

    paintWithShadow(painter, shadow, name, foot, TILE_SIZE);

    expect(context.drawImage).not.toHaveBeenCalled();
    expect(painted).toEqual([]);
  });

  it("draws nothing for a sprite with no cells", () => {
    const { painter, context } = painterFor({
      [name]: spriteOf({ cells: [] }),
    });

    paintWithShadow(painter, shadow, name, foot, TILE_SIZE);

    expect(context.drawImage).not.toHaveBeenCalled();
  });

  describe("a sprite made of variants", () => {
    const cells = [
      [0, 0],
      [1, 0],
      [2, 0],
    ] satisfies AtlasSprite["cells"];
    const sprites = { [name]: spriteOf({ mode: "variants", cells }) };

    const drawnColumn = (options?: PaintOptions) => {
      const { painter, context } = painterFor(sprites);
      paintWithShadow(painter, shadow, name, foot, TILE_SIZE, options);
      return drawnColumns(context);
    };

    it("shows the variant the tile picks", () => {
      for (const tile of [
        [4, 7],
        [-3, 12],
        [100, -5],
      ] satisfies [number, number][]) {
        expect(drawnColumn({ variantTile: tile })).toEqual([
          variantIndex(...tile, cells.length),
        ]);
      }
    });

    it("shows the variant of the origin tile when none is given", () => {
      expect(drawnColumn()).toEqual([variantIndex(0, 0, cells.length)]);
    });
  });

  describe("an animated sprite", () => {
    const cells = [
      [0, 0],
      [1, 0],
    ] satisfies AtlasSprite["cells"];
    const sprites = { [name]: spriteOf({ cells, frameSec: 1 }) };

    const drawnColumn = (now: number, options?: PaintOptions) => {
      const { painter, context } = painterFor(sprites, { now });
      paintWithShadow(painter, shadow, name, foot, TILE_SIZE, options);
      return drawnColumns(context);
    };

    it("plays through its frames over time when animated", () => {
      expect(drawnColumn(0, { animate: true })).toEqual([0]);
      expect(drawnColumn(1, { animate: true })).toEqual([1]);
    });

    it("stays on its first frame when not animated", () => {
      expect(drawnColumn(1, { animate: false })).toEqual([0]);
    });

    it("stays on its first frame by default", () => {
      expect(drawnColumn(1)).toEqual([0]);
    });
  });
});

describe("paintConveyor", () => {
  const [colour, bendColour] = ["#111111", "#222222"];
  const straight = conveyorSpriteName(facing);
  const straightSprite = spriteOf({ colour });
  const sprites = {
    [straight]: straightSprite,
    [conveyorSpriteName(facing, bend)]: spriteOf({ colour: bendColour }),
  };
  const belt = (
    tiles: number
  ): { worldPos: [number, number]; data: ConveyorData } => ({
    worldPos: [10, 5],
    data: { facing, length: tiles * REGION_SIDE_LENGTH },
  });
  const origin = Vector.zero(2);
  const pxPerTile = 4;

  it("paints its head, then the rest of it straight", () => {
    const { painter, painted } = painterFor(sprites, { textured: false });

    paintConveyor(painter, belt(3), null, origin, pxPerTile);

    // Facing right, the head is the one tile centred on the anchor, and the
    // rest runs on from its far edge.
    expect(painted).toEqual([
      { style: colour, shape: [38, 18, 4, 4] },
      { style: colour, shape: [42, 18, 8, 4] },
    ]);
  });

  it("draws a bend in the head only", () => {
    const { painter, painted } = painterFor(sprites, { textured: false });

    paintConveyor(painter, belt(3), bend, origin, pxPerTile);

    expect(painted.map(({ style }) => style)).toEqual([bendColour, colour]);
  });

  it("is only a head when it is one tile long", () => {
    const { painter, painted } = painterFor(sprites, { textured: false });

    paintConveyor(painter, belt(1), null, origin, pxPerTile);

    expect(painted).toHaveLength(1);
  });

  it("skips a piece whose sprite is not in the atlas", () => {
    const { painter, painted } = painterFor(
      { [straight]: straightSprite },
      { textured: false }
    );

    paintConveyor(painter, belt(3), bend, origin, pxPerTile);

    expect(painted.map(({ style }) => style)).toEqual([colour]);
  });

  it("is anchored by its head's corner and scaled to the tile size when textured", () => {
    const { painter, painted } = painterFor(sprites);
    const size = TILE_SIZE;

    paintConveyor(painter, belt(3), null, origin, size);

    expect(painted).toHaveLength(2);
    for (const { style } of painted) {
      expect(style).toBeInstanceOf(FakePattern);
      // The first tile's corner is half a tile before the anchor, so the
      // pattern lines up with it.
      expect((style as FakePattern).setTransform).toHaveBeenCalledWith({
        a: 1,
        d: 1,
        e: (10 - 0.5) * size,
        f: (5 - 0.5) * size,
      });
    }
  });

  it("scales its texture to the zoom", () => {
    const { painter, painted } = painterFor(sprites);

    paintConveyor(painter, belt(1), null, origin, 2 * TILE_SIZE);

    const pattern = painted[0]?.style;
    expect(pattern).toBeInstanceOf(FakePattern);
    expect((pattern as FakePattern).setTransform).toHaveBeenCalledWith(
      expect.objectContaining({ a: 2, d: 2 })
    );
  });

  it("skips a piece with no frame to draw when textured", () => {
    const { painter, painted } = painterFor({
      [straight]: spriteOf({ frames: [] }),
    });

    paintConveyor(painter, belt(3), null, origin, TILE_SIZE);

    expect(painted).toEqual([]);
  });
});
