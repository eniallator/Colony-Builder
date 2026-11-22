import {
  REGION_SIDE_LENGTH,
  regionPosToId,
  regionToWorldPos,
  tileToId,
  type Tile,
  type TileId,
} from "@colony-builder/shared";
import { memoize, typedKeys } from "niall-utils/data";
import { describe, expect, it } from "vitest";

import { BIOMES, biomeTile, createBiomeAt } from "./biome.ts";
import { stoneOres } from "./stone.ts";
import { createWorldGenerator } from "./worldGenerator.ts";

const idsOf = (names: Tile[]): TileId[] => names.map(tileToId);

const biomes = typedKeys(BIOMES);

/** Tiles that replace a biome's land tile. */
const OVERLAYS = idsOf(["water", "stone", ...stoneOres]);

/** Sampled regions: every `REGION_STEP`th one across ±`REGION_EXTENT`. */
const REGION_EXTENT = 60;
const REGION_STEP = 10;

const sampledRegions = Array.from(
  { length: (2 * REGION_EXTENT) / REGION_STEP },
  (_, i) => i * REGION_STEP - REGION_EXTENT
).flatMap(x =>
  Array.from(
    { length: (2 * REGION_EXTENT) / REGION_STEP },
    (_, i): [number, number] => [x, i * REGION_STEP - REGION_EXTENT]
  )
);

/**
 * Every tile of the sampled regions, with the biome it belongs to. Sampled once
 * per seed and shared, since several tests read the same tiles.
 */
const sampleTiles = memoize(
  (seed: string) => {
    const generate = createWorldGenerator(seed);
    const biomeAt = createBiomeAt(seed);

    return sampledRegions.flatMap(([regionX, regionY]) => {
      const { tiles } = generate(regionPosToId(regionX, regionY));
      const [originX, originY] = regionToWorldPos(regionX, regionY);
      return tiles.map((tile, idx) => ({
        tile,
        biome: biomeAt(
          originX + (idx % REGION_SIDE_LENGTH),
          originY + Math.floor(idx / REGION_SIDE_LENGTH)
        ),
      }));
    });
  },
  seed => seed
);

describe("createWorldGenerator", () => {
  it("makes a full region of tiles", () => {
    const { tiles } = createWorldGenerator("seed")(regionPosToId(3, -2));

    expect(tiles).toHaveLength(REGION_SIDE_LENGTH ** 2);
  });

  it("is deterministic for the same seed", () => {
    const a = createWorldGenerator("seed");
    const b = createWorldGenerator("seed");

    for (let i = 0; i < 20; i++) {
      const id = regionPosToId(i * 3 - 30, 17 - i * 2);
      expect(a(id).tiles).toEqual(b(id).tiles);
    }
  });

  it("differs between seeds", () => {
    const probe = (seed: string) => {
      const generate = createWorldGenerator(seed);
      return Array.from(
        { length: 40 },
        (_, i) => generate(regionPosToId(i * 7 - 20, i * 11 - 20)).tiles
      );
    };

    expect(probe("seed-a")).not.toEqual(probe("seed-b"));
  });

  it("produces only water, stone, ore and the biomes' land tiles", () => {
    const allowed = idsOf([
      ...biomes.map(biomeTile),
      "water",
      "stone",
      ...stoneOres,
    ]);

    const unexpected = sampleTiles("seed").filter(
      ({ tile }) => !allowed.includes(tile)
    );

    expect(unexpected).toEqual([]);
  });

  it("uses the biome's land tile wherever there is no water or stone", () => {
    const mismatched = sampleTiles("seed").filter(
      ({ tile, biome }) =>
        !OVERLAYS.includes(tile) && tile !== tileToId(biomeTile(biome))
    );

    expect(mismatched).toEqual([]);
  });

  it("places stone with ore inside it on land", () => {
    const generate = createWorldGenerator("seed");
    const tiles = new Set<TileId>();
    for (let regionX = -5; regionX < 5; regionX++) {
      for (let regionY = -5; regionY < 5; regionY++) {
        for (const tile of generate(regionPosToId(regionX, regionY)).tiles) {
          tiles.add(tile);
        }
      }
    }

    expect(tiles).toContain(tileToId("stone"));
    for (const ore of stoneOres) expect(tiles).toContain(tileToId(ore));
  });

  it("has both water and land in every biome", () => {
    const samples = sampleTiles("seed");

    for (const biome of biomes) {
      expect(
        samples.some(s => s.biome === biome && s.tile === tileToId("water"))
      ).toBe(true);
      expect(
        samples.some(
          s => s.biome === biome && s.tile === tileToId(biomeTile(biome))
        )
      ).toBe(true);
    }
  });
});
