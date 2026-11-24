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
  private readonly entityStore: EntityStore;
  private readonly terrainStore: TerrainStore;
  private readonly structureStore: StructureStore;

  private entityRegions: Map<RegionId, EntityId[]> = new Map();

  /** `trackChanges`: remember what changed, for `flush*Dirty*`. Only the server needs this. */
  constructor({ trackChanges = true }: { trackChanges?: boolean } = {}) {
    this.entityStore = new EntityStore(trackChanges);
    this.terrainStore = new TerrainStore(trackChanges);
    this.structureStore = new StructureStore(trackChanges);
  }

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
      this.terrainStore.add(id, tiles, false);
      this.structureStore.add(id, structures, false);
    }
  }

  loadWorld(x: number, y: number, generator: WorldGenerator): RegionId[] {
    const ids = regionsAround(...worldToRegionPos(x, y), LOADED_SIDE_LENGTH);
    for (const id of ids) {
      if (this.terrainStore.optGet(id) != null) continue;

      const { tiles, structures } = generator(id);
      this.terrainStore.add(id, tiles, false);
      this.structureStore.add(id, structures, false);
    }
    return ids;
  }

  /** The `ids` whose region lies outside the square of regions centred on `x`, `y`. */
  private idsOutside<Id>(
    ids: MapIterator<Id>,
    regionPosOf: (id: Id) => [number, number],
    x: number,
    y: number,
    sideLength: number
  ): Id[] {
    const half = sideLength / 2;
    return ids
      .filter(id => {
        const [rx, ry] = regionPosOf(id);
        return (
          rx < x - half || rx >= x + half || ry < y - half || ry >= y + half
        );
      })
      .toArray();
  }

  unloadOutside(x: number, y: number, sideLength: number): RegionId[] {
    const unloaded = this.idsOutside(
      this.terrainStore.ids,
      regionIdToPos,
      x,
      y,
      sideLength
    );

    for (const id of unloaded) {
      this.terrainStore.delete(id);
      this.structureStore.delete(id);
    }

    return unloaded;
  }

  unloadEntitiesOutside(x: number, y: number, sideLength: number): EntityId[] {
    const unloaded = this.idsOutside(
      this.entityStore.ids,
      id => worldToRegionPos(...this.entityStore.get(id, "position").toArray()),
      x,
      y,
      sideLength
    );

    for (const id of unloaded) {
      this.entityStore.despawn(id);
    }

    return unloaded;
  }

  flushAllDirtyRegions(): RegionId[] {
    return this.terrainStore
      .flushDirtyRegions()
      .concat(this.structureStore.flushDirtyRegions());
  }
}
