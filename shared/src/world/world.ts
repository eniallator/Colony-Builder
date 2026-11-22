import { tuple } from "niall-utils/core";

import { LOADED_SIDE_LENGTH } from "../constants.ts";
import {
  EntityStore,
  type ComponentName,
  type EntityId,
} from "./entity/index.ts";
import {
  regionIdToPos,
  regionPosToId,
  regionsAround,
  worldToRegionPos,
  type RegionId,
} from "./region.ts";
import { StructureStore } from "./structure/store.ts";
import { TerrainStore } from "./terrain/store.ts";
import type { WorldGenerator, WorldSnapshot } from "./types.ts";

export class World {
  private readonly entityStore: EntityStore = new EntityStore();
  private readonly terrainStore: TerrainStore = new TerrainStore();
  private readonly structureStore: StructureStore = new StructureStore();

  private entityRegions: Map<RegionId, EntityId[]> = new Map();

  get entities() {
    return this.entityStore;
  }

  get terrain() {
    return this.terrainStore;
  }

  get structures() {
    return this.structureStore;
  }

  indexEntities() {
    this.entityRegions = Map.groupBy(this.entityStore.query("position"), id =>
      regionPosToId(
        ...worldToRegionPos(...this.entityStore.get(id, "position").toArray())
      )
    );
  }

  entitiesAround(
    worldX: number,
    worldY: number,
    regionSideLength: number,
    componentNames: Exclude<ComponentName, "position">[] = []
  ): EntityId[] {
    const ids = regionsAround(
      ...worldToRegionPos(worldX, worldY),
      regionSideLength
    ).flatMap(id => this.entityRegions.get(id) ?? []);

    // Entities may not exist since the index was built, so re-querying
    return this.entityStore.queryWithIds(ids, "position", ...componentNames);
  }

  takeSnapshot(ids: RegionId[]): WorldSnapshot {
    return new Map(
      ids.map(id =>
        tuple(id, {
          tiles: this.terrainStore.get(id),
          structures: this.structureStore.get(id),
        })
      )
    );
  }

  applySnapshot(snapshot: WorldSnapshot): void {
    for (const [id, { tiles, structures }] of snapshot) {
      this.terrainStore.add(id, tiles);
      this.structureStore.add(id, structures);
    }
  }

  loadWorld(x: number, y: number, generator: WorldGenerator): RegionId[] {
    const ids = regionsAround(...worldToRegionPos(x, y), LOADED_SIDE_LENGTH);
    for (const id of ids) {
      if (this.terrainStore.optGet(id) != null) continue;

      const { tiles, structures } = generator(id);
      this.terrainStore.add(id, tiles);
      this.structureStore.add(id, structures);
    }
    return ids;
  }

  unloadOutside(x: number, y: number, sideLength: number): RegionId[] {
    const half = sideLength / 2;
    const unloaded = this.terrainStore.ids
      .filter(id => {
        const [rx, ry] = regionIdToPos(id);
        return (
          rx < x - half || rx >= x + half || ry < y - half || ry >= y + half
        );
      })
      .toArray();

    for (const id of unloaded) {
      this.terrainStore.delete(id);
      this.structureStore.delete(id);
    }

    return unloaded;
  }
}
