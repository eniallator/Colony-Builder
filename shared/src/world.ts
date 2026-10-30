import { typedFromEntries, typedToEntries } from "niall-utils";

import {
  componentNames,
  isOptionalComponentName,
  type Components,
} from "./component.ts";
import { unsafeEntityId, type EntityId } from "./entity/index.ts";
import { EntityStore } from "./entityStore.ts";
import type { EntitySnapshot, WorldSnapshot } from "./protocol/index.ts";

export class World extends EntityStore {
  private entityCount: number = 0;

  spawn(components: Partial<Components> = {}): EntityId {
    const id = unsafeEntityId(this.entityCount++);
    for (const [name, value] of typedToEntries(components)) {
      if (value !== undefined) this.add(id, name, value);
    }
    return id;
  }

  despawn(id: EntityId): void {
    for (const name of componentNames) this.delete(id, name);
  }

  takeSnapshot(): WorldSnapshot {
    return {
      entities: this.ids.toArray().map((id): EntitySnapshot => ({
        id,
        ...typedFromEntries<Components>(
          componentNames.map(name =>
            isOptionalComponentName(name)
              ? [name, this.optGet(id, name)]
              : [name, this.get(id, name)]
          )
        ),
      })),
    };
  }
}
