import { TASK_RADIUS } from "@colony-builder/shared";
import { Vector } from "vectyped";

import type { EntityParams } from "./types.ts";

const DESTINATION_EPSILON = 1e-3;

const centreOf = (target: Vector<2>): Vector<2> =>
  Vector.fill(2, 0.5).add(target);

export const isInRange = (entity: EntityParams, target: Vector<2>): boolean =>
  entity.position.sqrDistTo(centreOf(target)) <= TASK_RADIUS ** 2;

export const destinationFor = (
  entity: EntityParams,
  target: Vector<2>
): Vector<2> => {
  const centre = centreOf(target);

  return centre.lerp(
    (TASK_RADIUS - DESTINATION_EPSILON) / entity.position.distTo(centre),
    entity.position
  );
};
