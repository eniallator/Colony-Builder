import { raise, tuple } from "niall-utils/core";
import { positiveMod } from "niall-utils/math";

import { LOADED_SIDE_LENGTH, REGION_SIDE_LENGTH } from "../constants.ts";
import type { RegionTiles, TerrainSnapshot } from "../protocol/message.ts";
import {
  regionIdToPos,
  regionPosToId,
  regionsAround,
  regionToWorldPos,
  worldToRegionPos,
  type RegionId,
  type TerrainGenerator,
  type Tile,
} from "../terrain/index.ts";

const flatRegionIdx = (x: number, y: number): number =>
  positiveMod(Math.floor(y), REGION_SIDE_LENGTH) * REGION_SIDE_LENGTH +
  positiveMod(Math.floor(x), REGION_SIDE_LENGTH);

const idxToDeltaXY = (idx: number): [x: number, y: number] => [
  idx % REGION_SIDE_LENGTH,
  Math.floor(idx / REGION_SIDE_LENGTH),
];

export class TerrainStore {
  private readonly regions: Map<RegionId, RegionTiles> = new Map();

  get ids(): MapIterator<RegionId> {
    return this.regions.keys();
  }

  get positions(): MapIterator<[number, number]> {
    return this.regions.keys().map(regionIdToPos);
  }

  add(id: RegionId, region: RegionTiles) {
    this.regions.set(id, region);
  }

  addTile(x: number, y: number, tile: Tile): void {
    const tiles =
      this.regions.get(regionPosToId(...worldToRegionPos(x, y))) ??
      raise(new Error(`No region exists for world pos ${x},${y}`));
    tiles[flatRegionIdx(x, y)] = tile;
  }

  optGet(id: RegionId): RegionTiles | undefined {
    return this.regions.get(id);
  }

  get(id: RegionId): RegionTiles {
    return (
      this.optGet(id) ??
      raise(new Error(`No region exists at ${regionIdToPos(id).join(",")}`))
    );
  }

  delete(id: RegionId): boolean {
    return this.regions.delete(id);
  }

  optTileAt(x: number, y: number): Tile | undefined {
    return this.regions.get(regionPosToId(...worldToRegionPos(x, y)))?.[
      flatRegionIdx(x, y)
    ];
  }

  tileAt(x: number, y: number): Tile {
    return (
      this.optTileAt(x, y) ??
      raise(new Error(`No region exists for position ${x}, ${y}`))
    );
  }

  takeSnapshot(ids: RegionId[]): TerrainSnapshot {
    return new Map(
      ids.map(id =>
        tuple(
          id,
          this.regions.get(id) ??
            raise(
              new Error(`Region ${regionIdToPos(id).join(",")} not loaded yet!`)
            )
        )
      )
    );
  }

  applySnapshot(snapshot: TerrainSnapshot): void {
    for (const [id, tiles] of snapshot) this.regions.set(id, tiles);
  }

  loadTerrain(
    worldX: number,
    worldY: number,
    generator: TerrainGenerator
  ): Set<RegionId> {
    const ids = regionsAround(
      ...worldToRegionPos(worldX, worldY),
      LOADED_SIDE_LENGTH
    );

    for (const id of ids) {
      if (this.regions.get(id) == null) {
        const [x, y] = regionToWorldPos(...regionIdToPos(id));
        this.regions.set(
          id,
          Array.from({ length: REGION_SIDE_LENGTH ** 2 }, (_, i): Tile => {
            const [dx, dy] = idxToDeltaXY(i);
            return generator(x + dx, y + dy);
          })
        );
      }
    }

    return new Set(ids);
  }

  unloadOutside(x: number, y: number, sideLength: number): RegionId[] {
    const half = sideLength / 2;
    const unloaded = this.ids
      .filter(id => {
        const [rx, ry] = regionIdToPos(id);
        return (
          rx < x - half || rx >= x + half || ry < y - half || ry >= y + half
        );
      })
      .toArray();

    for (const id of unloaded) this.regions.delete(id);

    return unloaded;
  }
}

// TODO: Different sized grids, one per power of 2.
//   Each grid has specific structures you can place at each level.
//   They snap to the current grid
