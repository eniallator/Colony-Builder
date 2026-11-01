import { EntityStore } from "./entityStore.ts";
import { TerrainStore } from "./terrainStore.ts";

export class World {
  private readonly entityStore: EntityStore = new EntityStore();
  private readonly terrainStore: TerrainStore = new TerrainStore();

  get entities() {
    return this.entityStore;
  }

  get terrain() {
    return this.terrainStore;
  }
}
