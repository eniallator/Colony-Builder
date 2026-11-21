import type { EntityId, Inventory, Task, World } from "@colony-builder/shared";
import type { UnionToTuple } from "niall-utils/core";
import type { Vector } from "vectyped";

import type { PlayerState } from "../state.ts";

export interface EntityParams {
  id: EntityId;
  position: Vector<2>;
  inventory: Inventory;
}

type TaskRunResult<S extends Task> =
  { done: false } | { done: true; cleanTask: S | null };

export interface TaskRunnerCtx<T extends Task> {
  entity: EntityParams;
  task: T;
  world: World;
  players: Map<EntityId, PlayerState>;
  dt: number;
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
