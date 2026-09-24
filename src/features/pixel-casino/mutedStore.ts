/**
 * Pure, testable mute store: the in-memory `muted` value is the single
 * source of truth, decoupled from whether persisting it actually works.
 *
 * `useSound`'s `toggleMuted` used to do `saveMuted(!loadMuted())` and let
 * later reads go through `loadMuted()` again. `saveMuted` is a guarded
 * no-op when `localStorage` is unavailable or throws (private browsing,
 * blocked storage — see `preferences.ts`), so on those browsers the next
 * `loadMuted()` read back the *same* unchanged value and mute silently
 * never toggled, even though the player pressed the button.
 *
 * Here `toggle()` flips the in-memory value directly and *then*
 * best-effort mirrors it via `persistence.save`; a failing or no-op save
 * never stops the toggle from taking effect for the rest of the session.
 * The value is lazily loaded from `persistence.load()` on the first read
 * rather than eagerly at module init, so a server-rendered snapshot never
 * touches storage.
 */

export interface MutedPersistence {
  load(): boolean;
  save(muted: boolean): void;
}

export interface MutedStore {
  /** The current muted value, loading it from persistence on first call. */
  getMuted(): boolean;
  /** Flips the in-memory value, best-effort persists it, then notifies listeners. */
  toggle(): void;
  subscribe(listener: () => void): () => void;
}

export function createMutedStore(persistence: MutedPersistence): MutedStore {
  let loaded = false;
  let muted = false;
  const listeners = new Set<() => void>();

  function ensureLoaded(): void {
    if (loaded) return;
    loaded = true;
    muted = persistence.load();
  }

  return {
    getMuted(): boolean {
      ensureLoaded();
      return muted;
    },
    toggle(): void {
      ensureLoaded();
      muted = !muted;
      persistence.save(muted);
      for (const listener of listeners) listener();
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
