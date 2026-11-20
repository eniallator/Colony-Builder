import type {
  EntityId,
  EntityType,
  RegionId,
  StructureType,
  SubRegionId,
} from "@colony-builder/shared";

export type ClickableTarget =
  | [type: `entity.${EntityType}`, id: EntityId]
  | [
      type: `structure.${StructureType}`,
      regionId: RegionId,
      subRegionId: SubRegionId,
    ];

export type ClickableId = number | bigint;

export type TargetIds<T extends ClickableTarget> = T extends [
  string,
  ...infer Ids extends ClickableId[],
]
  ? Ids
  : never;

export interface SelectOption<V> {
  label: string;
  value: V;
}

export interface ClickableSelect<Ids extends ClickableId[], V> {
  type: "Select";
  options: SelectOption<V>[];
  onSelect: (value: V, ...ids: Ids) => void;
}

export interface ClickableCallback<Ids extends ClickableId[]> {
  type: "Callback";
  onClick: (...ids: Ids) => void;
}

export type ClickableRun<Ids extends ClickableId[], V = unknown> =
  ClickableSelect<Ids, V> | ClickableCallback<Ids>;

export type ClickableHandlers = {
  // oxlint-disable-next-line typescript/no-explicit-any
  [T in ClickableTarget as T[0]]: ClickableRun<TargetIds<T>, any>;
};

export const clickableSelect = <const Ids extends ClickableId[], const V>(
  options: SelectOption<V>[],
  onSelect: (value: V, ...ids: Ids) => void
): ClickableSelect<Ids, V> => ({ type: "Select", options, onSelect });

export const clickableCallback = <const Ids extends ClickableId[]>(
  onClick: (...ids: Ids) => void
): ClickableCallback<Ids> => ({ type: "Callback", onClick });

export type ClickableAction =
  | { type: "Callback"; run: () => void }
  | {
      type: "Select";
      options: SelectOption<unknown>[];
      run: (value: unknown) => void;
    };

// oxlint-disable-next-line typescript/no-explicit-any
type AnyRun = ClickableRun<any[], any>;

export const isSameTarget = (
  a: ClickableTarget | null,
  b: ClickableTarget | null
): boolean =>
  a === b ||
  (a != null && a.length === b?.length && a.every((part, i) => part === b[i]));

export const actionFor = (
  handlers: Partial<ClickableHandlers>,
  target: ClickableTarget
): ClickableAction | undefined => {
  const handler: AnyRun | undefined = handlers[target[0]];
  if (handler == null) return undefined;

  const [_type, ...ids] = target;
  return handler.type === "Callback"
    ? {
        type: "Callback",
        run: () => {
          handler.onClick(...ids);
        },
      }
    : {
        type: "Select",
        options: handler.options,
        run: value => {
          handler.onSelect(value, ...ids);
        },
      };
};
