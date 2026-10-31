import { positiveMod } from "niall-utils";
import { raise } from "niall-utils/core";

import { REGION_SIDE_LENGTH } from "../constants.ts";
import type { RegionTiles, TerrainSnapshot } from "../protocol/message.ts";
import { unsafeRegionId, type RegionId, type Tile } from "../terrain/index.ts";

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

  add(x: number, y: number, region: RegionTiles) {
    this.regions.set(unsafeRegionId(`${x},${y}`), region);
  }

  optGet(x: number, y: number): RegionTiles | undefined {
    return this.regions.get(unsafeRegionId(`${x},${y}`));
  }

  get(x: number, y: number): RegionTiles {
    return (
      this.optGet(x, y) ?? raise(new Error(`No region exists at ${x}, ${y}`))
    );
  }

  delete(x: number, y: number): boolean {
    return this.regions.delete(unsafeRegionId(`${x},${y}`));
  }

  takeSnapshot(): TerrainSnapshot {
    return new Map(this.regions.entries().map(([id, tiles]) => [id, tiles]));
  }

  applySnapshot(snapshot: TerrainSnapshot): void {
    const seen = new Set<RegionId>();

    for (const [id, tiles] of snapshot) {
      seen.add(id);

      this.regions.set(id, tiles);
    }

    for (const id of this.ids) {
      if (!seen.has(id)) this.regions.delete(id);
    }
  }

  optTileAt(x: number, y: number): Tile | undefined {
    const id = unsafeRegionId(
      `${Math.floor(x / REGION_SIDE_LENGTH)},${Math.floor(
        y / REGION_SIDE_LENGTH
      )}`
    );

    return this.regions.get(id)?.tiles[positiveMod(x, REGION_SIDE_LENGTH)]?.[
      positiveMod(y, REGION_SIDE_LENGTH)
    ];
  }

  tileAt(x: number, y: number): Tile {
    return (
      this.optTileAt(x, y) ??
      raise(new Error(`No region exists for position ${x}, ${y}`))
    );
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
