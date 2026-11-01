import { positiveMod } from "niall-utils";
import { raise, tuple } from "niall-utils/core";

import { LOADED_SIDE_LENGTH, REGION_SIDE_LENGTH } from "../constants.ts";
import type { RegionTiles, TerrainSnapshot } from "../protocol/message.ts";
import {
  regionIdToPos,
  regionPosToId,
  regionsAround,
  worldToRegionPos,
  type RegionId,
  type Tile,
} from "../terrain/index.ts";

export class TerrainStore {
  private readonly regions: Map<RegionId, RegionTiles> = new Map();

  get ids(): MapIterator<RegionId> {
    return this.regions.keys();
  }

  get positions(): MapIterator<[number, number]> {
    return this.regions
      .keys()
      .map(id => id.split(",").map(Number) as [number, number]);
  }

  add(id: RegionId, region: RegionTiles) {
    this.regions.set(id, region);
  }

  optGet(id: RegionId): RegionTiles | undefined {
    return this.regions.get(id);
  }

  get(id: RegionId): RegionTiles {
    return this.optGet(id) ?? raise(new Error(`No region exists at ${id}`));
  }

  delete(id: RegionId): boolean {
    return this.regions.delete(id);
  }

  optTileAt(x: number, y: number): Tile | undefined {
    return this.regions.get(regionPosToId(...worldToRegionPos(x, y)))?.tiles[
      positiveMod(y, REGION_SIDE_LENGTH) * REGION_SIDE_LENGTH +
        positiveMod(x, REGION_SIDE_LENGTH)
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
            raise(new Error(`Region ${id} not loaded yet!`))
        )
      )
    );
  }

  applySnapshot(snapshot: TerrainSnapshot): void {
    for (const [id, tiles] of snapshot) this.regions.set(id, tiles);
  }

  loadTerrain(worldX: number, worldY: number): Set<RegionId> {
    const ids = regionsAround(
      ...worldToRegionPos(worldX, worldY),
      LOADED_SIDE_LENGTH
    );

    for (const id of ids) {
      if (this.regions.get(id) == null) {
        this.regions.set(id, {
          tiles: Array.from(
            { length: REGION_SIDE_LENGTH ** 2 },
            (_, i): Tile => (i % 2 ? "dirt" : "grass")
          ),
        });
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

// A region is a collection of terrain, bounded to a specific area.
// It contains tile entities which are stored in an efficient structure like a quad tree, or using binary space partitioning.
//
// It's sent run length encoded/some efficient compression scheme
//   Uses oneOf for each tile in the terrain grid
//   Has a lookup of each tile per region
//
// Different sized grids, one per power of 2.
//   Each grid has specific structures you can place at each level.
//   They snap to the current grid
