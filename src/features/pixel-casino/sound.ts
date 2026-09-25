/**
 * 8-bit-style sound effects, synthesized entirely with the Web Audio API —
 * no audio files. Each cue is modeled as pure data first (`cueNotes`, a
 * list of `{ frequency, startOffset, duration, waveform, gain }` notes),
 * kept separate from the player that actually schedules oscillators, so
 * the cue design is unit-testable without a DOM or an `AudioContext`.
 *
 * `createSoundPlayer` is the impure half: it lazily creates its
 * `AudioContext` on the first `play()` call (browsers require a user
 * gesture before audio can start, so it must never be created eagerly),
 * resumes it if suspended, and schedules each note as a short oscillator
 * + gain envelope. It is a no-op on the server or wherever Web Audio
 * isn't available.
 */

export type SoundCue =
  | "deal"
  | "flip"
  | "correct"
  | "mistake"
  | "combo"
  | "win"
  | "lose"
  | "push"
  | "gameOver";

export interface SoundNote {
  /** In Hz. */
  frequency: number;
  /** Seconds from when `play()` was called. */
  startOffset: number;
  /** In seconds. */
  duration: number;
  waveform: OscillatorType;
  /** Peak gain for this note, before `MASTER_VOLUME` is applied. */
  gain: number;
}

export interface CueNotesOptions {
  /** For `combo`: the current combo multiplier (>= 1). Higher multiplier plays higher. Ignored for every other cue. */
  comboMultiplier?: number;
}

/** Keeps the synthesized SFX from ever overpowering the (silent) UI. */
export const MASTER_VOLUME = 0.6;

interface NoteSpec {
  /** Semitones from A4 (440 Hz). */
  semitone: number;
  start: number;
  duration: number;
  waveform: OscillatorType;
  gain: number;
}

const A4_HZ = 440;

function semitoneToFrequency(semitone: number): number {
  return A4_HZ * 2 ** (semitone / 12);
}

function specsToNotes(specs: readonly NoteSpec[]): SoundNote[] {
  return specs.map((spec) => ({
    frequency: semitoneToFrequency(spec.semitone),
    startOffset: spec.start,
    duration: spec.duration,
    waveform: spec.waveform,
    gain: spec.gain,
  }));
}

type FixedCue = Exclude<SoundCue, "combo">;

const CUE_SPECS: Record<FixedCue, NoteSpec[]> = {
  // A short, dry tick — a card sliding onto the felt.
  deal: [{ semitone: -12, start: 0, duration: 0.05, waveform: "square", gain: 0.22 }],
  // Two quick notes, low then high — the hole card turning over.
  flip: [
    { semitone: -5, start: 0, duration: 0.04, waveform: "square", gain: 0.2 },
    { semitone: 2, start: 0.045, duration: 0.05, waveform: "square", gain: 0.22 },
  ],
  // A bright rising major triad — the player read the chart right.
  correct: [
    { semitone: 0, start: 0, duration: 0.08, waveform: "triangle", gain: 0.25 },
    { semitone: 4, start: 0.08, duration: 0.08, waveform: "triangle", gain: 0.27 },
    { semitone: 7, start: 0.16, duration: 0.12, waveform: "triangle", gain: 0.3 },
  ],
  // A flat, buzzy drop — the player missed the optimal play.
  mistake: [
    { semitone: -2, start: 0, duration: 0.09, waveform: "square", gain: 0.26 },
    { semitone: -7, start: 0.09, duration: 0.16, waveform: "square", gain: 0.22 },
  ],
  // A short ascending run, resolving up an octave.
  win: [
    { semitone: 0, start: 0, duration: 0.1, waveform: "triangle", gain: 0.26 },
    { semitone: 4, start: 0.1, duration: 0.1, waveform: "triangle", gain: 0.28 },
    { semitone: 7, start: 0.2, duration: 0.1, waveform: "triangle", gain: 0.3 },
    { semitone: 12, start: 0.3, duration: 0.22, waveform: "triangle", gain: 0.32 },
  ],
  // The inverse of `win`, ending low.
  lose: [
    { semitone: 0, start: 0, duration: 0.12, waveform: "square", gain: 0.24 },
    { semitone: -3, start: 0.12, duration: 0.12, waveform: "square", gain: 0.22 },
    { semitone: -7, start: 0.24, duration: 0.22, waveform: "square", gain: 0.2 },
  ],
  // A single neutral blip — nothing won, nothing lost.
  push: [{ semitone: 0, start: 0, duration: 0.12, waveform: "triangle", gain: 0.2 }],
  // A four-note descending phrase — the run is over.
  gameOver: [
    { semitone: 7, start: 0, duration: 0.16, waveform: "square", gain: 0.28 },
    { semitone: 3, start: 0.17, duration: 0.16, waveform: "square", gain: 0.26 },
    { semitone: 0, start: 0.34, duration: 0.16, waveform: "square", gain: 0.24 },
    { semitone: -5, start: 0.51, duration: 0.32, waveform: "square", gain: 0.22 },
  ],
};

/** Shape of the `combo` arpeggio, before the per-multiplier pitch shift. */
const COMBO_ARPEGGIO_SEMITONES = [0, 4, 7];
/** Semitones the whole `combo` arpeggio shifts up per extra multiplier level. */
const COMBO_SEMITONES_PER_LEVEL = 3;

/** Clamps to the lowest multiplier for anything that isn't a real, finite number (undefined, NaN, Infinity). */
function clampComboMultiplier(comboMultiplier: number | undefined): number {
  if (comboMultiplier === undefined || !Number.isFinite(comboMultiplier)) return 1;
  return Math.max(1, comboMultiplier);
}

function comboNotes(comboMultiplier: number | undefined): SoundNote[] {
  const multiplier = clampComboMultiplier(comboMultiplier);
  const shift = (multiplier - 1) * COMBO_SEMITONES_PER_LEVEL;
  return specsToNotes(
    COMBO_ARPEGGIO_SEMITONES.map((semitone, index) => ({
      semitone: semitone + shift,
      start: index * 0.06,
      duration: 0.08,
      waveform: "square" as const,
      gain: 0.24,
    })),
  );
}

/** Pure: the notes that make up `cue`, given `options` (only meaningful for `combo`). */
export function cueNotes(cue: SoundCue, options: CueNotesOptions = {}): SoundNote[] {
  if (cue === "combo") return comboNotes(options.comboMultiplier);
  return specsToNotes(CUE_SPECS[cue]);
}

export interface SoundPlayer {
  /** No-op while muted control lives in the caller (see `useSound`); this always plays. */
  play(cue: SoundCue, options?: CueNotesOptions): void;
}

/** Short fades so notes don't click at the start/end of their gain envelope. */
const ATTACK_SECONDS = 0.005;
const RELEASE_SECONDS = 0.03;

function resolveAudioContextCtor(): typeof AudioContext | undefined {
  if (typeof window === "undefined") return undefined;
  const withWebkit = window as typeof window & { webkitAudioContext?: typeof AudioContext };
  return withWebkit.AudioContext ?? withWebkit.webkitAudioContext;
}

function scheduleNote(ctx: AudioContext, note: SoundNote, playAt: number): void {
  const oscillator = ctx.createOscillator();
  oscillator.type = note.waveform;
  oscillator.frequency.value = note.frequency;

  const gainNode = ctx.createGain();
  const startAt = playAt + note.startOffset;
  const stopAt = startAt + note.duration;
  const peakGain = note.gain * MASTER_VOLUME;
  const releaseAt = Math.max(startAt + ATTACK_SECONDS, stopAt - RELEASE_SECONDS);

  gainNode.gain.setValueAtTime(0, startAt);
  gainNode.gain.linearRampToValueAtTime(peakGain, startAt + ATTACK_SECONDS);
  gainNode.gain.setValueAtTime(peakGain, releaseAt);
  gainNode.gain.linearRampToValueAtTime(0, stopAt);

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.start(startAt);
  oscillator.stop(stopAt);
}

export interface CreateSoundPlayerOptions {
  /**
   * Overrides the `AudioContext` constructor the player uses. Only meant
   * for tests (a fake or throwing constructor); production always
   * resolves it from `window`.
   */
  audioContextCtor?: new () => AudioContext;
}

/**
 * Creates a player with its own lazily-created `AudioContext`. Safe to
 * construct anywhere (including on the server); it only touches the
 * `AudioContext` once `play()` is actually called.
 *
 * SFX is pure decoration: nothing here — a browser that refuses to
 * construct `AudioContext`, a `resume()` that rejects (no user gesture
 * yet, some browsers), or scheduling on a closed/broken context — may
 * ever throw synchronously or leak an unhandled rejection out of
 * `play()`. Once the context is confirmed unavailable, later `play()`
 * calls short-circuit instead of retrying the failing constructor.
 */
export function createSoundPlayer(options: CreateSoundPlayerOptions = {}): SoundPlayer {
  let ctx: AudioContext | null = null;
  let unavailable = false;

  function getContext(): AudioContext | null {
    if (ctx) return ctx;
    if (unavailable) return null;
    const AudioContextCtor = options.audioContextCtor ?? resolveAudioContextCtor();
    if (!AudioContextCtor) {
      unavailable = true; // Server, or Web Audio unavailable.
      return null;
    }
    try {
      ctx = new AudioContextCtor();
      return ctx;
    } catch {
      // Construction can throw (e.g. some browsers before a user
      // gesture, or a locked-down/test environment).
      unavailable = true;
      return null;
    }
  }

  return {
    play(cue: SoundCue, options?: CueNotesOptions): void {
      const audioCtx = getContext();
      if (!audioCtx) return;

      try {
        if (audioCtx.state === "suspended") {
          void audioCtx.resume()?.catch(() => {
            // No user gesture yet, or the browser refused to resume:
            // the next call to play() will try resuming again.
          });
        }

        const now = audioCtx.currentTime;
        for (const note of cueNotes(cue, options)) {
          scheduleNote(audioCtx, note, now);
        }
      } catch {
        // Scheduling failed (closed/broken context, an oscillator type
        // the browser rejects, etc.) — never worth crashing the game.
      }
    },
  };
}
