/** Remembers which ids changed since the last `flush`; remembers nothing when disabled. */
export class DirtyTracker<Id> {
  private readonly dirty: Set<Id> = new Set();
  private readonly enabled: boolean;

  constructor(enabled: boolean) {
    this.enabled = enabled;
  }

  mark(id: Id): void {
    if (this.enabled) this.dirty.add(id);
  }

  flush(): Id[] {
    const ids = [...this.dirty];
    this.dirty.clear();
    return ids;
  }
}
