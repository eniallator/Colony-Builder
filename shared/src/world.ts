import { raise, tuple, type ReadonlyNonEmptyArray } from "niall-utils/core";
import { typedFromEntries } from "niall-utils/data";

import {
  componentNames,
  type ComponentName,
  type Components,
} from "./component.ts";
import { unsafeEntityId, type EntityId } from "./entity/index.ts";

export class World {
  private entityCount: number = 0;
  private readonly stores: {
    [C in ComponentName]: Map<EntityId, Components[C]>;
  } = typedFromEntries(componentNames.map(name => tuple(name, new Map())));

  spawn(): EntityId {
    return unsafeEntityId(this.entityCount++);
  }

  despawn(id: EntityId) {
    for (const store of Object.values(this.stores)) store.delete(id);
  }

  delete(id: EntityId, name: ComponentName): boolean {
    return this.stores[name].delete(id);
  }

  add<C extends ComponentName>(
    entity: EntityId,
    name: C,
    component: Components[C]
  ) {
    this.stores[name].set(entity, component);
  }

  optGet<C extends ComponentName>(
    id: EntityId,
    name: C
  ): Components[C] | undefined {
    return this.stores[name].get(id);
  }

  get<C extends ComponentName>(id: EntityId, name: C): Components[C] {
    return (
      this.optGet(id, name) ??
      raise(new Error(`Entity ${id} has no "${name}" component`))
    );
  }

  query(...[first, ...rest]: ReadonlyNonEmptyArray<ComponentName>): EntityId[] {
    return [...this.stores[first].keys()].filter(entity =>
      rest.every(name => this.stores[name].has(entity))
    );
  }
}
