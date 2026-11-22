import { raise, type ReadonlyNonEmptyArray } from "niall-utils/core";
import { typedFromEntries, typedToEntries } from "niall-utils/data";

import { DirtyTracker } from "../dirty.ts";
import {
  componentNames,
  unsafeEntityId,
  type ComponentName,
  type Components,
  type EntityId,
  type EntitySnapshot,
  type OptionalComponentName,
  type StoreComponents,
} from "./types.ts";

export class EntityStore {
  private entityCount: number = 0;
  private readonly stores: {
    [C in ComponentName]: Map<EntityId, StoreComponents[C]>;
  } = typedFromEntries(componentNames.map(name => [name, new Map()]));
  private readonly dirtyEntities: DirtyTracker<EntityId>;

  constructor(trackChanges: boolean = true) {
    this.dirtyEntities = new DirtyTracker(trackChanges);
  }

  get ids(): MapIterator<EntityId> {
    return this.stores[
      "position" satisfies Exclude<ComponentName, OptionalComponentName>
    ].keys();
  }

  add<C extends ComponentName>(
    entity: EntityId,
    name: C,
    component: StoreComponents[C]
  ): void {
    this.stores[name].set(entity, component);
    this.dirtyEntities.mark(entity);
  }

  optGet<C extends ComponentName>(
    id: EntityId,
    name: C
  ): StoreComponents[C] | undefined {
    return this.stores[name].get(id);
  }

  get<C extends ComponentName>(id: EntityId, name: C): StoreComponents[C] {
    return (
      this.optGet(id, name) ??
      raise(new Error(`Entity ${id} has no "${name}" component`))
    );
  }

  delete(id: EntityId, name: ComponentName): boolean {
    const deleted = this.stores[name].delete(id);
    if (deleted) this.dirtyEntities.mark(id);
    return deleted;
  }

  queryWithIds<
    Coll extends { filter: (predicate: (id: EntityId) => boolean) => Coll },
  >(ids: Coll, ...names: readonly ComponentName[]): Coll {
    return ids.filter(id => names.every(name => this.stores[name].has(id)));
  }

  query(...[first, ...rest]: ReadonlyNonEmptyArray<ComponentName>): EntityId[] {
    return [...this.queryWithIds(this.stores[first].keys(), ...rest)];
  }

  spawn(components: Partial<Components> = {}): EntityId {
    const id = unsafeEntityId(this.entityCount++);
    for (const [name, value] of typedToEntries(components)) {
      if (value !== undefined) this.stores[name].set(id, value as never);
    }
    this.dirtyEntities.mark(id);
    return id;
  }

  despawn(id: EntityId): void {
    for (const name of componentNames) this.stores[name].delete(id);
    this.dirtyEntities.mark(id);
  }

  takeSnapshot(ids: EntityId[]): EntitySnapshot {
    return new Map(
      ids.map(id => [
        id,
        typedFromEntries(
          componentNames.map(name => [name, this.stores[name].get(id)])
        ),
      ])
    );
  }

  applySnapshot(snapshot: EntitySnapshot): void {
    for (const [id, components] of snapshot) {
      for (const name of componentNames) {
        const value = components[name];
        if (value !== undefined) this.stores[name].set(id, value as never);
        else this.stores[name].delete(id);
      }
    }
  }

  flushDirtyEntities(): EntityId[] {
    return this.dirtyEntities.flush();
  }
}
