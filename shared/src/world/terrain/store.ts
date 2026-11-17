import { raise } from "niall-utils/core";
import { positiveMod } from "niall-utils/math";

import { REGION_SIDE_LENGTH } from "../../constants.ts";
import {
  idToTile,
  regionIdToPos,
  regionPosToId,
  worldToRegionPos,
  type RegionId,
  type RegionTiles,
  type Tile,
  type TileId,
} from "./types.ts";

const flatRegionIdx = (x: number, y: number): number =>
  positiveMod(Math.floor(y), REGION_SIDE_LENGTH) * REGION_SIDE_LENGTH +
  positiveMod(Math.floor(x), REGION_SIDE_LENGTH);

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

  addTile(x: number, y: number, tile: TileId): void {
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
    const id = this.regions.get(regionPosToId(...worldToRegionPos(x, y)))?.[
      flatRegionIdx(x, y)
    ];
    return id != null ? idToTile(id) : undefined;
  }

  tileAt(x: number, y: number): Tile {
    return (
      this.optTileAt(x, y) ??
      raise(new Error(`No region exists for position ${x}, ${y}`))
    );
  }
}
