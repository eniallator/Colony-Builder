import { tuple } from "niall-utils/core";
import { mapFilter } from "niall-utils/functional";

import { REGION_SIDE_LENGTH } from "../../constants.ts";
import {
  regionsAround,
  worldToRegionPos,
  type RegionId,
} from "../terrain/index.ts";
import {
  regionIdsToWorldPos,
  worldPosToRegionIds,
  type RegionStructures,
  type Structure,
  type StructureData,
  type StructureSnapshot,
  type SubRegionId,
} from "./types.ts";

export class StructureStore {
  private readonly regions: Map<RegionId, RegionStructures> = new Map();

  get ids(): MapIterator<RegionId> {
    return this.regions.keys();
  }

  add(id: RegionId, structures: RegionStructures) {
    this.regions.set(id, structures);
  }

  addStructure(worldX: number, worldY: number, data: StructureData): void {
    const [reg, sub] = worldPosToRegionIds(worldX, worldY);
    this.regions.getOrInsert(reg, new Map()).set(sub, data);
  }

  optGet(reg: RegionId, sub: SubRegionId): Structure | undefined {
    const data = this.regions.get(reg)?.get(sub);
    return data != null
      ? { ...data, worldPos: regionIdsToWorldPos(reg, sub) }
      : undefined;
  }

  optStructuresAround(
    worldX: number,
    worldY: number,
    sideLength: number
  ): Structure[] {
    return regionsAround(
      ...worldToRegionPos(worldX, worldY),
      Math.ceil(sideLength / REGION_SIDE_LENGTH)
    ).flatMap(
      regionId =>
        this.regions
          .get(regionId)
          ?.entries()
          .map(([id, data]) => ({
            ...data,
            worldPos: regionIdsToWorldPos(regionId, id),
          }))
          .toArray() ?? []
    );
  }

  delete(id: RegionId): boolean {
    return this.regions.delete(id);
  }

  deleteStructure(reg: RegionId, sub: SubRegionId): boolean {
    return this.regions.get(reg)?.delete(sub) ?? false;
  }

  takeSnapshot(ids: RegionId[]): StructureSnapshot {
    return new Map(
      mapFilter(ids, id => {
        const structures = this.regions.get(id);
        return structures != null ? tuple(id, structures) : null;
      })
    );
  }

  applySnapshot(snapshot: StructureSnapshot): void {
    for (const [id, structures] of snapshot) this.regions.set(id, structures);
  }
}
