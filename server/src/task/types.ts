import type { EntityId, Inventory, Task, World } from "@colony-builder/shared";
import type { UnionToTuple } from "niall-utils";
import type { Vector } from "vectyped";

export interface EntityParams {
  id: EntityId;
  position: Vector<2>;
  inventory: Inventory;
}

type TaskRunResult<S extends Task> =
  { done: false } | { done: true; resetTask: S };

export type TaskRunner<S extends Task> = (
  entity: EntityParams,
  task: S,
  world: World,
  dt: number
) => TaskRunResult<S>;

type TaskRunnerInternal<T extends readonly Task[]> = T extends [
  infer T extends Task,
  ...infer Rest extends readonly Task[],
]
  ? { [K in T["type"]]: TaskRunner<T> } & TaskRunnerInternal<Rest>
  : unknown;

export type TaskRunners = TaskRunnerInternal<UnionToTuple<Task>>;
