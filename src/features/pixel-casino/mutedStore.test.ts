import { describe, expect, it, vi } from "vitest";

import { createMutedStore } from "./mutedStore";

describe("createMutedStore", () => {
  it("lazily loads the initial value from persistence on the first read, not eagerly", () => {
    const load = vi.fn(() => true);
    const store = createMutedStore({ load, save: vi.fn() });

    expect(load).not.toHaveBeenCalled();
    expect(store.getMuted()).toBe(true);
    expect(load).toHaveBeenCalledTimes(1);

    store.getMuted();
    expect(load).toHaveBeenCalledTimes(1); // Not reloaded on subsequent reads.
  });

  it("toggles the in-memory value even when persisting it is a silent no-op (storage unavailable/blocked)", () => {
    // Mirrors saveMuted's real contract: it never throws, it just no-ops
    // when storage is unavailable or write access is blocked.
    const store = createMutedStore({ load: () => false, save: () => {} });

    expect(store.getMuted()).toBe(false);
    store.toggle();
    expect(store.getMuted()).toBe(true); // Flips regardless of the no-op save.
    store.toggle();
    expect(store.getMuted()).toBe(false);
  });

  it("persists the flipped value on toggle when storage works", () => {
    const save = vi.fn();
    const store = createMutedStore({ load: () => false, save });

    store.toggle();
    expect(save).toHaveBeenCalledWith(true);

    store.toggle();
    expect(save).toHaveBeenCalledWith(false);
  });

  it("notifies subscribed listeners on toggle", () => {
    const store = createMutedStore({ load: () => false, save: () => {} });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.toggle();
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    store.toggle();
    expect(listener).toHaveBeenCalledTimes(1); // No longer notified after unsubscribing.
  });
});
