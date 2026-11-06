import type { ComponentName, EntityId } from "../entity/index.ts";
import {
  regionPosToId,
  regionsAround,
  worldToRegionPos,
  type RegionId,
} from "../terrain/index.ts";
import { EntityStore } from "./entityStore.ts";
import { TerrainStore } from "./terrainStore.ts";

export class World {
  private entityRegions: Map<RegionId, EntityId[]> = new Map();
  private readonly entityStore: EntityStore = new EntityStore();
  private readonly terrainStore: TerrainStore = new TerrainStore();

  get entities() {
    return this.entityStore;
  }

  get terrain() {
    return this.terrainStore;
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
}
