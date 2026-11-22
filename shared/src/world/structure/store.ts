import { raise } from "niall-utils/core";
import { mapFind } from "niall-utils/functional";
import { Vector } from "vectyped";

import { REGION_SIDE_LENGTH } from "../../constants.ts";
import {
  regionIdsToWorldPos,
  regionIdToPos,
  regionsAround,
  worldPosToRegionIds,
  worldToRegionPos,
  type RegionId,
  type SubRegionId,
} from "../region.ts";
import { structureFootprints } from "./footprint.ts";
import {
  isStructureOfType,
  type RegionStructures,
  type Structure,
  type StructureData,
  type StructureOf,
  type StructureType,
} from "./types.ts";

type LocatedStructure = Structure & { regionId: RegionId; id: SubRegionId };

export class StructureStore {
  private readonly regions: Map<RegionId, RegionStructures> = new Map();

  get ids(): MapIterator<RegionId> {
    return this.regions.keys();
  }

  add(id: RegionId, structures: RegionStructures) {
    this.regions.set(id, structures);
  }

  addStructure(reg: RegionId, sub: SubRegionId, data: StructureData): void {
    const structures =
      this.regions.get(reg) ?? new Map<SubRegionId, StructureData>();
    structures.set(sub, data);
    this.regions.set(reg, structures);
  }

  addStructureAt(worldX: number, worldY: number, data: StructureData): void {
    this.addStructure(...worldPosToRegionIds(worldX, worldY), data);
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
  ): LocatedStructure[] {
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
            regionId,
            id,
          }))
          .toArray() ?? []
    );
  }

  structureAt<T extends StructureType>(
    type: T,
    worldX: number,
    worldY: number
  ): (StructureOf<T> & Omit<LocatedStructure, "type" | "data">) | null {
    const footprintOf = structureFootprints[type];
    if (footprintOf == null) return null;

    const point = Vector.create(worldX, worldY);
    const [regionX, regionY] = worldToRegionPos(worldX, worldY);

    // Structures stick out of their region sideways, so the neighbours count too.
    return mapFind(regionsAround(regionX + 0.5, regionY + 0.5, 3), regionId => {
      for (const [id, structure] of this.regions.get(regionId) ?? []) {
        if (!isStructureOfType(structure, type)) continue;

        const worldPos = regionIdsToWorldPos(regionId, id);
        const { from, size } = footprintOf(structure.data);
        if (point.inBounds(size, Vector.create(...worldPos).add(from))) {
          return { ...structure, worldPos, regionId, id };
        }
      }
      return null;
    });
  }

  delete(id: RegionId): boolean {
    return this.regions.delete(id);
  }

  deleteStructure(reg: RegionId, sub: SubRegionId): boolean {
    return this.regions.get(reg)?.delete(sub) ?? false;
  }
}
