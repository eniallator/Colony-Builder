import { REGION_SIDE_LENGTH } from "../../constants.ts";
import { facingDirOf, type Facing } from "../../facing.ts";
import type {
  ConveyorData,
  StructureDataByType,
  StructureType,
} from "./types.ts";

export interface Footprint {
  from: [x: number, y: number];
  size: [width: number, height: number];
}

export const conveyorFootprint = (data: ConveyorData): Footprint =>
  conveyorSpan(data.facing, 0, conveyorLengthToTiles(data.length));

export const structureFootprints: {
  [T in StructureType]?: (data: StructureDataByType[T]) => Footprint;
} = { conveyor: conveyorFootprint };

export const conveyorLengthToTiles = (length: number): number =>
  length / REGION_SIDE_LENGTH;

export const conveyorSpan = (
  facing: Facing,
  from: number,
  to: number
): Footprint => {
  const axisOf = (step: number): [from: number, size: number] =>
    step === 0
      ? [-0.5, 1]
      : [Math.min(step * (from - 0.5), step * (to - 0.5)), to - from];
  const [stepX, stepY] = facingDirOf[facing].toArray();
  const [fromX, width] = axisOf(stepX);
  const [fromY, height] = axisOf(stepY);
  return { from: [fromX, fromY], size: [width, height] };
};

export const splitConveyor = (
  anchor: [x: number, y: number],
  facing: Facing,
  tiles: number
): { worldPos: [x: number, y: number]; data: ConveyorData }[] | null => {
  const step = facingDirOf[facing];
  const axis = step.x() !== 0 ? 0 : 1;
  const sign = step.valueOf(axis);

  // Pieces as `[upstream edge, length]` along the belt's axis, in tiles.
  const cut = (
    edge: number,
    remaining: number
  ): [edge: number, length: number][] => {
    if (remaining <= 0) return [];
    const region =
      sign > 0
        ? Math.floor(edge / REGION_SIDE_LENGTH)
        : Math.ceil(edge / REGION_SIDE_LENGTH) - 1;
    const boundary = (sign > 0 ? region + 1 : region) * REGION_SIDE_LENGTH;
    const length = Math.min(remaining, Math.abs(boundary - edge));
    return [[edge, length], ...cut(edge + sign * length, remaining - length)];
  };

  const pieces = cut(anchor[axis] - sign * 0.5, tiles);
  if (pieces.some(([, length]) => length <= 0.5)) return null;

  return pieces.map(([edge, length]) => {
    const along = edge + sign * 0.5;
    return {
      worldPos: axis === 0 ? [along, anchor[1]] : [anchor[0], along],
      data: { facing, length: Math.round(length * REGION_SIDE_LENGTH) },
    };
  });
};
