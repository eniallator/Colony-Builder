import { raise } from "niall-utils/core";
import { positiveMod } from "niall-utils/math";

import { REGION_SIDE_LENGTH } from "../../constants.ts";
import { DirtyTracker } from "../dirty.ts";
import {
  regionIdToPos,
  regionPosToId,
  worldToRegionPos,
  type RegionId,
} from "../region.ts";
import { idToTile, type RegionTiles, type Tile, type TileId } from "./types.ts";

const flatRegionIdx = (x: number, y: number): number =>
  positiveMod(Math.floor(y), REGION_SIDE_LENGTH) * REGION_SIDE_LENGTH +
  positiveMod(Math.floor(x), REGION_SIDE_LENGTH);

export class TerrainStore {
  private readonly regions: Map<RegionId, RegionTiles> = new Map();
  private readonly dirtyRegions: DirtyTracker<RegionId>;

  constructor(trackChanges: boolean = true) {
    this.dirtyRegions = new DirtyTracker(trackChanges);
  }

  get ids(): MapIterator<RegionId> {
    return this.regions.keys();
  }

  get positions(): MapIterator<[number, number]> {
    return this.regions.keys().map(regionIdToPos);
  }

  add(id: RegionId, region: RegionTiles, addToDirty: boolean = true) {
    this.regions.set(id, region);
    if (addToDirty) this.dirtyRegions.mark(id);
  }

  addTile(x: number, y: number, tile: TileId): void {
    const id = regionPosToId(...worldToRegionPos(x, y));
    const tiles =
      this.regions.get(id) ??
      raise(new Error(`No region exists for world pos ${x},${y}`));
    const idx = flatRegionIdx(x, y);
    if (tiles[idx] !== tile) {
      tiles[idx] = tile;
      this.dirtyRegions.mark(id);
    }
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
    const deleted = this.regions.delete(id);
    if (deleted) this.dirtyRegions.mark(id);
    return deleted;
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

  flushDirtyRegions(): RegionId[] {
    return this.dirtyRegions.flush();
  }
}
