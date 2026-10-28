import { parseState } from "./io";
import { type State, emptyState } from "./model";

export interface Store {
  load(): State;
  save(state: State): void;
}

/** Persists the whole state as one JSON blob in a Web Storage instance. */
export class WebStorageStore implements Store {
  constructor(
    private readonly storage: Storage,
    private readonly key = "hourglass.state.v1",
    // Key used before the rename to Hourglass; read when the current key is empty.
    private readonly legacyKey = "updown.state.v1",
  ) {}

  load(): State {
    const raw =
      this.storage.getItem(this.key) ?? this.storage.getItem(this.legacyKey);
    if (raw === null) return emptyState();
    try {
      return parseState(raw);
    } catch (e) {
      // Keep the unreadable data so it can be recovered manually; start fresh.
      this.storage.setItem(`${this.key}.corrupt.${Date.now()}`, raw);
      console.error("Stored state unreadable, starting fresh", e);
      return emptyState();
    }
  }

  save(state: State): void {
    this.storage.setItem(this.key, JSON.stringify(state));
  }
}
