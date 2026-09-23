"use client";

/**
 * Tiny client hook wiring the synthesized SFX player (`sound.ts`) to the
 * persisted mute preference (`preferences.ts`). Not wired into any screen
 * yet — that's T5's job.
 */

import { useCallback, useRef, useState } from "react";

import { loadMuted, saveMuted } from "./preferences";
import { createSoundPlayer, type CueNotesOptions, type SoundCue, type SoundPlayer } from "./sound";

export interface UseSound {
  muted: boolean;
  toggleMuted: () => void;
  /** No-op while `muted`. */
  play: (cue: SoundCue, options?: CueNotesOptions) => void;
}

export function useSound(): UseSound {
  const [muted, setMuted] = useState<boolean>(() => loadMuted());
  // Lazily created on the first `play()` call, i.e. after a real user
  // gesture — never eagerly, since browsers require that before audio
  // can actually start (see `createSoundPlayer`).
  const playerRef = useRef<SoundPlayer | null>(null);

  const toggleMuted = useCallback(() => {
    setMuted((wasMuted) => {
      const nextMuted = !wasMuted;
      saveMuted(nextMuted);
      return nextMuted;
    });
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
