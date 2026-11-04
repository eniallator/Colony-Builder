import { raise, type ReadonlyNonEmptyArray } from "niall-utils/core";
import { typedFromEntries, typedToEntries } from "niall-utils/data";

import {
  componentNames,
  unsafeEntityId,
  type ComponentName,
  type Components,
  type EntityId,
  type OptionalComponentName,
  type StoreComponents,
} from "../entity/index.ts";
import type { EntitySnapshot } from "../protocol/message.ts";

export class EntityStore {
  private entityCount: number = 0;
  private readonly stores: {
    [C in ComponentName]: Map<EntityId, StoreComponents[C]>;
  } = typedFromEntries(componentNames.map(name => [name, new Map()]));

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
    return this.stores[name].delete(id);
  }

  query(...[first, ...rest]: ReadonlyNonEmptyArray<ComponentName>): EntityId[] {
    return [...this.stores[first].keys()].filter(id =>
      rest.every(name => this.stores[name].has(id))
    );
  }

  spawn(components: Partial<Components> = {}): EntityId {
    const id = unsafeEntityId(this.entityCount++);
    for (const [name, value] of typedToEntries(components)) {
      if (value !== undefined) this.stores[name].set(id, value as never);
    }
    return id;
  }

  despawn(id: EntityId): void {
    for (const name of componentNames) this.stores[name].delete(id);
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
    const seen = new Set<EntityId>();

    for (const [id, components] of snapshot) {
      seen.add(id);

      for (const name of componentNames) {
        const value = components[name];
        if (value !== undefined) this.stores[name].set(id, value as never);
        else this.stores[name].delete(id);
      }
    }

    for (const id of this.ids) {
      if (!seen.has(id)) this.despawn(id);
    }
  }
}
