import { tuple } from "niall-utils/core";
import { mapFilter } from "niall-utils/functional";

import { LOADED_SIDE_LENGTH, REGION_SIDE_LENGTH } from "../../constants.ts";
import {
  regionIdToPos,
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

  add(worldX: number, worldY: number, data: StructureData): void {
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

  delete(reg: RegionId, sub: SubRegionId): boolean {
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

  loadStructures(
    worldX: number,
    worldY: number,
    generator: (regionId: RegionId) => RegionStructures
  ): Set<RegionId> {
    const ids = regionsAround(
      ...worldToRegionPos(worldX, worldY),
      LOADED_SIDE_LENGTH
    );

    for (const id of ids) {
      if (!this.regions.has(id)) this.regions.set(id, generator(id));
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
