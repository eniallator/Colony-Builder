import { World } from "@colony-builder/shared";
import { toElement } from "niall-utils/ui";
import { Vector } from "vectyped";
import { vi, type Mock } from "vitest";

import type { ClientSystem } from "../../system.ts";
import type { ClickDetails } from "../../ui/clickable.ts";
import { Keyboard } from "../../ui/keyboard.ts";
import { Mouse } from "../../ui/mouse.ts";
import { createStateful } from "../../ui/types.ts";
import type { Atlas, AtlasSprite } from "../atlas.ts";

// Helpers for testing what the render systems draw. jsdom cannot draw, so the
// canvas context is a recorder, and the atlas is built from plain objects.

export const CANVAS_SIZE = [100, 50] as const;
export const TILE_SIZE = 16;

/** Stands in for `Path2D`, which jsdom does not have. */
export class FakePath {
  readonly rects: [x: number, y: number, width: number, height: number][] = [];

  rect(...rect: [x: number, y: number, width: number, height: number]) {
    this.rects.push(rect);
  }
}

/** Stands in for the `CanvasPattern` a context makes from a bitmap. */
export class FakePattern {
  readonly setTransform: Mock<(transform: DOMMatrix2DInit) => void> = vi.fn();
}

type DrawImage = (
  sheet: unknown,
  ...rest: [
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ]
) => void;

export interface FakeContext {
  /** The context to give to what is being tested. */
  ctx: CanvasRenderingContext2D;
  /** The same context, with its recording methods typed as mocks. */
  context: {
    fillStyle: unknown;
    imageSmoothingEnabled: boolean;
    createPattern: Mock<
      (bitmap: ImageBitmap, repetition: string) => FakePattern | null
    >;
    fill: Mock<(path: unknown) => void>;
    fillRect: Mock<(...rect: number[]) => void>;
    drawImage: Mock<DrawImage>;
  };
  /** Each `fill` and `fillRect`, in order, with the fill style it used. */
  painted: { style: unknown; shape: unknown }[];
}

/**
 * A 2d context that records what is painted: each `fill` and `fillRect`, with
 * the fill style it was painted in.
 */
export const createFakeContext = (): FakeContext => {
  const painted: FakeContext["painted"] = [];
  const context: FakeContext["context"] = {
    fillStyle: "",
    imageSmoothingEnabled: false,
    createPattern: vi.fn(
      (_bitmap: ImageBitmap, _repetition: string): FakePattern | null =>
        new FakePattern()
    ),
    fill: vi.fn((path: unknown) => {
      painted.push({ style: context.fillStyle, shape: path });
    }),
    fillRect: vi.fn((...rect: number[]) => {
      painted.push({ style: context.fillStyle, shape: rect });
    }),
    drawImage: vi.fn<DrawImage>(),
  };
  return {
    ctx: context as unknown as CanvasRenderingContext2D,
    context,
    painted,
  };
};

/** The sheet column of each cell a fake context drew, in order. */
export const drawnColumns = ({
  drawImage,
}: Pick<FakeContext["context"], "drawImage">): number[] =>
  drawImage.mock.calls.map(([, sx]) => sx / TILE_SIZE);

export type SystemArgs = Parameters<ClientSystem>[0];

/** Everything a client system is given, on a canvas of `CANVAS_SIZE`. */
export const createSystemArgs = (
  overrides: Partial<SystemArgs> = {}
): SystemArgs => {
  const canvas = toElement("<canvas></canvas>");
  canvas.width = CANVAS_SIZE[0];
  canvas.height = CANVAS_SIZE[1];
  return {
    world: new World(),
    canvas,
    ctx: createFakeContext().ctx,
    camera: { center: Vector.zero(2), zoom: 0 },
    time: { now: 1, start: 0, lastFrame: 0.99, delta: 0.01 },
    dt: 0.01,
    mouse: new Mouse(canvas),
    keyboard: new Keyboard(),
    clickDetails: createStateful<ClickDetails | null>(null),
    send: vi.fn(),
    ...overrides,
  };
};

/** A one-frame sprite whose bitmap is a plain object. */
export const spriteOf = (
  overrides: Partial<AtlasSprite> = {}
): AtlasSprite => ({
  mode: "frames",
  cells: [[0, 0]],
  colour: "#123456",
  ground: TILE_SIZE,
  frames: [{} as ImageBitmap],
  ...overrides,
});

export const atlasOf = (sprites: Record<string, AtlasSprite>): Atlas => ({
  tileSize: TILE_SIZE,
  sheet: {} as ImageBitmap,
  sprites: new Map(Object.entries(sprites)),
});
