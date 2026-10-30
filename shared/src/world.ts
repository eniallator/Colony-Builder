import { raise, typedToEntries } from "niall-utils";

import { componentNames, type Components } from "./component.ts";
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

  despawn(id: EntityId) {
    for (const name of componentNames) this.delete(id, name);
  }

  takeSnapshot(): WorldSnapshot {
    return {
      entities: [...this.stores.position].map(
        ([id, position]): EntitySnapshot => ({
          id,
          type:
            this.stores.type.get(id) ??
            raise(new Error(`Entity ${id} has no "type" component`)),
          position,
          destination: this.stores.destination.get(id),
          speed: this.stores.speed.get(id),
          conveyable: this.stores.conveyable.get(id) ?? undefined,
        })
      ),
    };
  }
}
