import type { WorldSnapshot } from "../protocol/index.ts";
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

  takeSnapshot(): WorldSnapshot {
    return {
      entities: this.entityStore.takeSnapshot(),
      terrain: this.terrainStore.takeSnapshot(),
    };
  }

  applySnapshot(snapshot: WorldSnapshot): void {
    this.entityStore.applySnapshot(snapshot.entities);
    this.terrainStore.applySnapshot(snapshot.terrain);
  }
}
