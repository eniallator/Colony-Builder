import {
  EntityStore,
  type ComponentName,
  type EntityId,
} from "./entity/index.ts";
import { StructureStore } from "./structure/store.ts";
import {
  regionPosToId,
  regionsAround,
  TerrainStore,
  worldToRegionPos,
  type RegionId,
} from "./terrain/index.ts";

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
}
