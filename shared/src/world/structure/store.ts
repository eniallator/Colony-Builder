import { raise } from "niall-utils/core";

import { REGION_SIDE_LENGTH } from "../../constants.ts";
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
    const structures =
      this.regions.get(reg) ?? new Map<SubRegionId, StructureData>();
    structures.set(sub, data);
    this.regions.set(reg, structures);
  }

  optGet(id: RegionId): RegionStructures | undefined {
    return this.regions.get(id);
  }

  get(id: RegionId): RegionStructures {
    return (
      this.optGet(id) ??
      raise(new Error(`No region exists at ${regionIdToPos(id).join(",")}`))
    );
  }

  optGetStructure(reg: RegionId, sub: SubRegionId): Structure | undefined {
    const data = this.regions.get(reg)?.get(sub);
    return data != null
      ? { ...data, worldPos: regionIdsToWorldPos(reg, sub) }
      : undefined;
  }

  structuresAround(
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
}
