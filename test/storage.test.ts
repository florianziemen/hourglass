import { describe, expect, it } from "vitest";
import { WebStorageStore } from "../src/storage";
import { emptyState } from "../src/model";
import { withCategory } from "./helpers";

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
}

describe("WebStorageStore", () => {
  it("returns an empty state when nothing is stored", () => {
    expect(new WebStorageStore(new MemoryStorage()).load()).toEqual(
      emptyState(),
    );
  });

  it("saves and loads", () => {
    const store = new WebStorageStore(new MemoryStorage());
    const [s] = withCategory();
    store.save(s);
    expect(store.load()).toEqual(s);
  });

  it("loads data stored under the legacy key", () => {
    const mem = new MemoryStorage();
    const [s] = withCategory();
    mem.setItem("updown.state.v1", JSON.stringify(s));
    expect(new WebStorageStore(mem).load()).toEqual(s);
  });

  it("backs up corrupt data and starts fresh", () => {
    const mem = new MemoryStorage();
    mem.setItem("hourglass.state.v1", "garbage");
    expect(new WebStorageStore(mem).load()).toEqual(emptyState());
    expect(mem.length).toBe(2);
  });
});
