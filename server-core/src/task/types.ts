import type {
  EntityId,
  Inventory,
  Task,
  Time,
  World,
} from "@colony-builder/shared";
import type { UnionToTuple } from "niall-utils/core";
import type { Vector } from "vectyped";

export interface EntityParams {
  id: EntityId;
  position: Vector<2>;
  inventory: Inventory;
}

// `changed`: the runner mutated its task, so the task list has to be re-added
type TaskRunResult<S extends Task> =
  { done: false; changed: boolean } | { done: true; cleanTask: S | null };

export interface TaskRunnerCtx<T extends Task> {
  entity: EntityParams;
  task: T;
  world: World;
  time: Time;
}

export type TaskRunner<T extends Task> = (
  ctx: TaskRunnerCtx<T>
) => TaskRunResult<T>;

type TaskRunnerInternal<T extends readonly Task[]> = T extends [
  infer T extends Task,
  ...infer Rest extends readonly Task[],
]
  ? { [K in T["type"]]: TaskRunner<T> } & TaskRunnerInternal<Rest>
  : unknown;

export type TaskRunners = TaskRunnerInternal<UnionToTuple<Task>>;
