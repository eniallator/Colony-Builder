import {
  isArrayOf,
  isInteger,
  isNumber,
  isObjectOf,
  isOneOf,
  isOptional,
  isRecordOf,
  isString,
  isTupleOf,
  type TypeFromGuard,
} from "deep-guards";
import { attemptAsync, raise, tuple } from "niall-utils/core";
import { typedToEntries } from "niall-utils/data";
import { Vector } from "vectyped";

const TEXTURE_BASE_URL = "textures/";
const SPRITE_MODES = tuple("variants", "frames");
const isSpriteMode = isOneOf(...SPRITE_MODES);
export type SpriteMode = TypeFromGuard<typeof isSpriteMode>;

const isCell = isTupleOf(isInteger, isInteger);
export type Cell = TypeFromGuard<typeof isCell>;

const isSpriteJson = isObjectOf({
  // `variants`: interchangeable looks. `frames`: an animation (or one frame).
  mode: isSpriteMode,
  // Where each variant/frame sits in the sheet, as `[column, row]`.
  cells: isArrayOf(isCell),
  // Mean colour of the sprite, drawn instead of the texture when zoomed out.
  colour: isString,
  // Pixel line (from the top of the cell) the sprite rests on.
  ground: isNumber,
  // How long each animation frame shows, in ms.
  frameMs: isOptional(isNumber),
  // How many art pixels the animation moves per frame, for animations that
  // depict motion at a game speed. The frame time comes from that speed.
  stepPx: isOptional(isNumber),
});
type SpriteJson = TypeFromGuard<typeof isSpriteJson>;

export const isAtlasJson = isObjectOf({
  tileSize: isInteger,
  columns: isInteger,
  sprites: isRecordOf(isString, isSpriteJson),
});

/** A sprite's `atlas.json` entry, plus its cells cut out as bitmaps. */
export interface AtlasSprite extends SpriteJson {
  /** Each cell as its own bitmap, so it can become a repeating pattern. */
  frames: ImageBitmap[];
}

export interface Atlas {
  tileSize: number;
  sheet: ImageBitmap;
  sprites: ReadonlyMap<string, AtlasSprite>;
}

const fetchOk = async (url: string): Promise<Response> => {
  const response = await fetch(url);
  return response.ok
    ? response
    : raise(new Error(`Failed to load ${url} (${response.status})`));
};

const fetchJson = async (url: string): Promise<unknown> =>
  (await fetchOk(url)).json();

const fetchBitmap = async (url: string): Promise<ImageBitmap> =>
  createImageBitmap(await (await fetchOk(url)).blob(), {
    colorSpaceConversion: "none",
  });

export const loadAtlas = async (): Promise<Atlas> => {
  const [json, sheet] = await Promise.all([
    fetchJson(`${TEXTURE_BASE_URL}atlas.json`),
    fetchBitmap(`${TEXTURE_BASE_URL}atlas.png`),
  ]);
  const { tileSize, sprites } = isAtlasJson(json)
    ? json
    : raise(
        new Error(`${TEXTURE_BASE_URL}atlas.json is not a valid texture atlas`)
      );

  const entries = await Promise.all(
    typedToEntries(sprites).map(
      async ([name, { cells, ...rest }]): Promise<[string, AtlasSprite]> => {
        const frames = await Promise.all(
          cells.map(cell =>
            createImageBitmap(
              sheet,
              ...Vector.create(...cell)
                .multiply(tileSize)
                .toArray(),
              tileSize,
              tileSize
            )
          )
        );
        return [name, { ...rest, cells, frames }];
      }
    )
  );

  return { tileSize, sheet, sprites: new Map(entries) };
};

let loadedAtlas: Atlas | undefined = undefined;
let loadRequested = false;

export const getAtlas = (): Atlas | undefined => {
  if (!loadRequested) {
    loadRequested = true;
    void attemptAsync(loadAtlas, error => {
      console.error("Failed to load the texture atlas", error);
      return undefined;
    }).then(atlas => {
      loadedAtlas = atlas ?? undefined;
    });
  }
  return loadedAtlas;
};
