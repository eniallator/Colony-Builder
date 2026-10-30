import { raise, tuple, type ReadonlyNonEmptyArray } from "niall-utils/core";
import { typedFromEntries } from "niall-utils/data";

import {
  componentNames,
  type ComponentName,
  type OptionalComponentName,
  type StoreComponents,
} from "./component.ts";
import type { EntityId } from "./entity/index.ts";
import type { WorldSnapshot } from "./protocol/index.ts";

export class EntityStore {
  private readonly stores: {
    [C in ComponentName]: Map<EntityId, StoreComponents[C]>;
  } = typedFromEntries(componentNames.map(name => tuple(name, new Map())));

  get ids(): MapIterator<EntityId> {
    return this.stores[
      "position" satisfies Exclude<ComponentName, OptionalComponentName>
    ].keys();
  }

  delete(id: EntityId, name: ComponentName): boolean {
    return this.stores[name].delete(id);
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

  query(...[first, ...rest]: ReadonlyNonEmptyArray<ComponentName>): EntityId[] {
    return [...this.stores[first].keys()].filter(id =>
      rest.every(name => this.stores[name].has(id))
    );
  }

  applySnapshot(snapshot: WorldSnapshot): void {
    const seen = new Set<EntityId>();

    for (const { id, ...entity } of snapshot.entities) {
      seen.add(id);

      for (const name of componentNames) {
        const value = entity[name];
        if (value !== undefined) this.stores[name].set(id, value as never);
        else this.stores[name].delete(id);
      }
    }

    for (const id of this.ids) {
      if (seen.has(id)) continue;
      for (const store of Object.values(this.stores)) store.delete(id);
    }
  }
}
