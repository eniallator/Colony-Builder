import { tuple } from "niall-utils/core";
import type { Vector } from "vectyped";

import type { EntityType } from "./entity/types.ts";

export interface Components {
  type: EntityType;
  position: Vector<2>;
  destination?: Vector<2>;
  speed?: number;
  conveyable?: true;
}

export type StoreComponents = Required<Components>;

export const componentNames = tuple(
  "type",
  "position",
  "destination",
  "speed",
  "conveyable"
);
export type ComponentName = (typeof componentNames)[number];

const _componentCheck: keyof Components extends ComponentName
  ? ComponentName extends keyof Components
    ? unknown
    : never
  : never = null;
