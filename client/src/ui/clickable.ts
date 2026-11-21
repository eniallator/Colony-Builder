import type {
  EntityId,
  EntityType,
  RegionId,
  StructureType,
  SubRegionId,
} from "@colony-builder/shared";
import { typedToEntries } from "niall-utils/data";
import type { Vector } from "vectyped";

export type ClickableTarget =
  | {
      domain: "entity";
      type: EntityType;
      id: EntityId;
    }
  | {
      domain: "structure";
      type: StructureType;
      regionId: RegionId;
      subRegionId: SubRegionId;
    };

export interface ClickDetails {
  target: ClickableTarget | null;
  worldPos: Vector<2>;
}

export interface SelectOption<V> {
  label: string;
  value: V;
}

export interface ClickableSelect<V> {
  type: "select";
  title: string;
  options: SelectOption<V>[];
  onSelect: (value: V) => void;
}

// oxlint-disable-next-line typescript/no-explicit-any
export type AnyClickableSelect = ClickableSelect<any>;

export interface ClickableCallback {
  type: "callback";
  onClick: () => void;
}

export const clickableSelect = <const V>(
  title: string,
  options: SelectOption<V>[],
  onSelect: (value: V) => void
): ClickableSelect<V> => ({ type: "select", title, options, onSelect });

export const clickableCallback = (onClick: () => void): ClickableCallback => ({
  type: "callback",
  onClick,
});

export const isSameTarget = (
  a: ClickableTarget | null,
  b: ClickableTarget | null
): boolean =>
  a === b ||
  (a != null &&
    b != null &&
    typedToEntries(a).every(([key, value]) => value === b[key]));
