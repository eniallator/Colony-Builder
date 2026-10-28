import { tuple } from "niall-utils/core";
import type { Vector } from "vectyped";

import type { EntityType } from "./entity/types.ts";

export interface Components {
  entityType: EntityType;
  position: Vector<2>;
  destination: Vector<2>;
  controller: { destination: Vector<2> };
  speed: number;
}

export const componentNames = tuple(
  "entityType",
  "position",
  "destination",
  "controller",
  "speed"
);
export type ComponentName = (typeof componentNames)[number];

const _check: keyof Components extends ComponentName
  ? ComponentName extends keyof Components
    ? unknown
    : never
  : never = null;
