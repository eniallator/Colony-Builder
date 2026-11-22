import { tuple } from "niall-utils/core";
import { Vector } from "vectyped";

import { encOneOf } from "./encoding/index.ts";

export const FACINGS = tuple("up", "down", "left", "right");
export type Facing = (typeof FACINGS)[number];

export const encFacing = encOneOf(FACINGS);

export const facingDirOf: Record<Facing, Vector<2>> = {
  up: Vector.UP,
  down: Vector.DOWN,
  left: Vector.LEFT,
  right: Vector.RIGHT,
};

const FACING_EPSILON = 1e-9;
const DELTA_MULTIPLIER = 1 / Math.sqrt(2);
export const facingOf = (delta: Vector<2>): Facing | undefined => {
  const facingMin = delta.getMagnitude() * DELTA_MULTIPLIER - FACING_EPSILON;
  return facingMin > 0
    ? FACINGS.find(facing => delta.dot(facingDirOf[facing]) >= facingMin)
    : undefined;
};
