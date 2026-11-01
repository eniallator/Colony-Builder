import {
  LOADED_REGIONS_SIDE_LENGTH,
  REGION_SIDE_LENGTH,
} from "../constants.ts";
import type { WorldSnapshot } from "../protocol/index.ts";
import {
  regionPosToId,
  worldToRegionPos,
  type Tile,
} from "../terrain/types.ts";
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

  generateTerrainAround(worldX: number, worldY: number): void {
    const [centerX, centerY] = worldToRegionPos(worldX, worldY);

    for (let dx = 0; dx < LOADED_REGIONS_SIDE_LENGTH; dx++) {
      for (let dy = 0; dy < LOADED_REGIONS_SIDE_LENGTH; dy++) {
        const id = regionPosToId(
          Math.floor(centerX - LOADED_REGIONS_SIDE_LENGTH / 2 + dx),
          Math.floor(centerY - LOADED_REGIONS_SIDE_LENGTH / 2 + dy)
        );

        if (this.terrainStore.optGet(id) == null) {
          this.terrainStore.add(id, {
            tiles: Array.from(
              { length: REGION_SIDE_LENGTH ** 2 },
              (_, i): Tile => (i % 2 ? "dirt" : "grass")
            ),
          });
        }
      }
    }
  }

  generateTerrainForPlayers(): void {
    for (const id of this.entityStore.query("type", "position")) {
      const type = this.entityStore.get(id, "type");
      if (type === "player") {
        this.generateTerrainAround(
          ...this.entityStore.get(id, "position").toArray()
        );
      }
    }
  }
}
