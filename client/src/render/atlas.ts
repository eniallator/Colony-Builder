import {
  isArrayOf,
  isInteger,
  isObjectOf,
  isOneOf,
  isRecordOf,
  isString,
  isTupleOf,
  type TypeFromGuard,
} from "deep-guards";
import { attemptAsync, raise, tuple } from "niall-utils/core";
import { typedToEntries } from "niall-utils/data";
import { Vector } from "vectyped";

const SPRITE_MODES = tuple("variants", "frames");
const isSpriteMode = isOneOf(...SPRITE_MODES);
export type SpriteMode = TypeFromGuard<typeof isSpriteMode>;

const isCell = isTupleOf(isInteger, isInteger);
export type Cell = TypeFromGuard<typeof isCell>;

const isSpriteJson = isObjectOf({
  mode: isSpriteMode,
  cells: isArrayOf(isCell),
  colour: isString,
});

export const isAtlasJson = isObjectOf({
  tileSize: isInteger,
  columns: isInteger,
  sprites: isRecordOf(isString, isSpriteJson),
});

export interface AtlasSprite {
  /** `variants`: interchangeable looks. `frames`: an animation (or one frame). */
  mode: SpriteMode;
  /** Mean colour of the sprite, drawn instead of the texture when zoomed out. */
  colour: string;
  /** Where each variant/frame sits in the sheet, as `[column, row]`. */
  cells: Cell[];
  /** Each cell cut out as its own bitmap, so it can become a repeating pattern. */
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

export const loadAtlas = async (baseUrl: string): Promise<Atlas> => {
  const [json, sheet] = await Promise.all([
    fetchJson(`${baseUrl}atlas.json`),
    fetchBitmap(`${baseUrl}atlas.png`),
  ]);
  const { tileSize, sprites } = isAtlasJson(json)
    ? json
    : raise(new Error(`${baseUrl}atlas.json is not a valid texture atlas`));

  const entries = await Promise.all(
    typedToEntries(sprites).map(
      async ([name, { mode, colour, cells }]): Promise<
        [string, AtlasSprite]
      > => {
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
        return [name, { mode, colour, cells, frames }];
      }
    )
  );

  return { tileSize, sheet, sprites: new Map(entries) };
};

const TEXTURE_BASE_URL = "textures/";

let loadedAtlas: Atlas | undefined = undefined;
let loadRequested = false;

export const getAtlas = (): Atlas | undefined => {
  if (!loadRequested) {
    loadRequested = true;
    void attemptAsync(
      async (): Promise<Atlas | undefined> => loadAtlas(TEXTURE_BASE_URL),
      error => {
        console.error("Failed to load the texture atlas", error);
        return undefined;
      }
    ).then(atlas => {
      loadedAtlas = atlas ?? undefined;
    });
  }
  return loadedAtlas;
};
