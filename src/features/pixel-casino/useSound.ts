"use client";

/**
 * Tiny client hook wiring the synthesized SFX player (`sound.ts`) to the
 * persisted mute preference (`preferences.ts`). Not wired into any screen
 * yet — that's T5's job.
 */

import { useCallback, useRef, useSyncExternalStore } from "react";

import { createMutedStore } from "./mutedStore";
import { DEFAULT_MUTED, loadMuted, saveMuted } from "./preferences";
import { createSoundPlayer, type CueNotesOptions, type SoundCue, type SoundPlayer } from "./sound";

export interface UseSound {
  muted: boolean;
  toggleMuted: () => void;
  /** No-op while `muted`. */
  play: (cue: SoundCue, options?: CueNotesOptions) => void;
}

// `muted` reads a real external system (`localStorage`, via `preferences.ts`),
// so it's read through `useSyncExternalStore` rather than a `useState` primed
// from an effect: the server snapshot always returns the fixed default (so
// the server and first client render agree — no hydration mismatch from a
// player who has muted before), and every mounted `useSound()` re-renders
// together when `toggleMuted` changes it.
//
// The in-memory `mutedStore` (not `loadMuted()`/`saveMuted()` directly) is
// the source of truth for the snapshot: `saveMuted` is a guarded no-op when
// `localStorage` is unavailable or throws, so reading `loadMuted()` back
// right after a toggle used to silently undo it on those browsers (see
// `mutedStore.ts`).
const mutedStore = createMutedStore({ load: loadMuted, save: saveMuted });

function subscribeToMuted(onStoreChange: () => void): () => void {
  return mutedStore.subscribe(onStoreChange);
}

function getMutedSnapshot(): boolean {
  return mutedStore.getMuted();
}

function getMutedServerSnapshot(): boolean {
  return DEFAULT_MUTED;
}

export function useSound(): UseSound {
  const muted = useSyncExternalStore(subscribeToMuted, getMutedSnapshot, getMutedServerSnapshot);
  // Lazily created on the first `play()` call, i.e. after a real user
  // gesture — never eagerly, since browsers require that before audio
  // can actually start (see `createSoundPlayer`).
  const playerRef = useRef<SoundPlayer | null>(null);

  const toggleMuted = useCallback(() => {
    mutedStore.toggle();
  }, []);

  const play = useCallback(
    (cue: SoundCue, options?: CueNotesOptions) => {
      if (muted) return;
      if (!playerRef.current) playerRef.current = createSoundPlayer();
      playerRef.current.play(cue, options);
    },
    [muted],
  );

  return { muted, toggleMuted, play };
}
