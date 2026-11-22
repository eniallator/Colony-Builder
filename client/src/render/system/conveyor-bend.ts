import {
  conveyorLengthToTiles,
  facingDirOf,
  FACINGS,
  type ConveyorBend,
  type ConveyorData,
  type Facing,
  type StructureStore,
} from "@colony-builder/shared";
import { Vector } from "vectyped";

interface PlacedConveyor {
  worldPos: [x: number, y: number];
  data: ConveyorData;
}

// The centre of a belt's upstream end.
const upstreamEdge = ({ worldPos, data }: PlacedConveyor): Vector<2> =>
  Vector.create(...worldPos).sub(facingDirOf[data.facing].copy().multiply(0.5));

// Whether a belt facing `facing` covers `tile` and ends at its far side.
const endsAt = (
  structures: StructureStore,
  tile: Vector<2>,
  facing: Facing
): boolean => {
  const belt = structures.structureAt("conveyor", ...tile.toArray());
  if (belt?.data.facing !== facing) return false;

  const along = facingDirOf[facing];
  const tail = upstreamEdge(belt).add(
    along.copy().multiply(conveyorLengthToTiles(belt.data.length))
  );
  const farSide = tile.copy().add(along.copy().multiply(0.5));
  return Math.abs(tail.sub(farSide).dot(along)) < 0.5;
};

/**
 * How the head of a belt bends, or `null` if it runs straight. It bends when a
 * belt at a right angle ends right behind it and nothing feeds it straight on.
 * The belt still faces the way it did; only its look changes.
 */
export const conveyorBend = (
  structures: StructureStore,
  belt: PlacedConveyor
): ConveyorBend | null => {
  const head = Vector.create(...belt.worldPos);
  const ahead = facingDirOf[belt.data.facing];
  // Whether a belt facing `facing` ends in the tile behind the head, feeding it.
  const feeds = (facing: Facing) =>
    endsAt(structures, head.copy().sub(facingDirOf[facing]), facing);
  if (feeds(belt.data.facing)) return null;

  const feeder = FACINGS.find(
    facing => facingDirOf[facing].dot(ahead) === 0 && feeds(facing)
  );
  if (feeder == null) return null;

  // A belt coming in from the left turns what it carries anticlockwise.
  const left = Vector.create(ahead.y(), -ahead.x());
  return facingDirOf[feeder].dot(left) < 0 ? "anticlockwise" : "clockwise";
};
