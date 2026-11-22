import { conveyorFootprint } from "./conveyor.ts";
import type { StructureDataByType, StructureType } from "./types.ts";

export interface Footprint {
  from: [x: number, y: number];
  size: [width: number, height: number];
}

export const structureFootprints: {
  [T in StructureType]?: (data: StructureDataByType[T]) => Footprint;
} = { conveyor: conveyorFootprint };
