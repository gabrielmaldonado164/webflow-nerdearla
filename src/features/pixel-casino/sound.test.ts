import { describe, expect, it, vi } from "vitest";

import { createSoundPlayer, cueNotes, type SoundCue } from "./sound";

const ALL_CUES: SoundCue[] = [
  "deal",
  "flip",
  "correct",
  "mistake",
  "combo",
  "win",
  "lose",
  "push",
  "gameOver",
];

describe("cueNotes", () => {
  it.each(ALL_CUES)("returns a non-empty note list for %s", (cue) => {
    expect(cueNotes(cue).length).toBeGreaterThan(0);
  });

  it.each(ALL_CUES)("gives every note of %s a positive, finite frequency and duration", (cue) => {
    for (const note of cueNotes(cue)) {
      expect(Number.isFinite(note.frequency)).toBe(true);
      expect(note.frequency).toBeGreaterThan(0);
      expect(Number.isFinite(note.duration)).toBe(true);
      expect(note.duration).toBeGreaterThan(0);
      expect(Number.isFinite(note.startOffset)).toBe(true);
      expect(note.startOffset).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(note.gain)).toBe(true);
      expect(note.gain).toBeGreaterThan(0);
      expect(["sine", "square", "sawtooth", "triangle"]).toContain(note.waveform);
    }
  });

  it("raises combo pitch as the multiplier rises", () => {
    const x1 = cueNotes("combo", { comboMultiplier: 1 });
    const x2 = cueNotes("combo", { comboMultiplier: 2 });
    const x4 = cueNotes("combo", { comboMultiplier: 4 });

    expect(x2[0].frequency).toBeGreaterThan(x1[0].frequency);
    expect(x4[0].frequency).toBeGreaterThan(x2[0].frequency);
  });

  it("defaults combo to the lowest multiplier when none is given", () => {
    expect(cueNotes("combo")).toEqual(cueNotes("combo", { comboMultiplier: 1 }));
  });

  it("clamps a non-finite combo multiplier to the lowest multiplier", () => {
    expect(cueNotes("combo", { comboMultiplier: NaN })).toEqual(cueNotes("combo", { comboMultiplier: 1 }));
    expect(cueNotes("combo", { comboMultiplier: Infinity })).toEqual(cueNotes("combo", { comboMultiplier: 1 }));

    for (const notes of [cueNotes("combo", { comboMultiplier: NaN }), cueNotes("combo", { comboMultiplier: Infinity })]) {
      for (const note of notes) {
        expect(Number.isFinite(note.frequency)).toBe(true);
      }
    }
  });

  it("plays gameOver as a descending sequence", () => {
    const notes = cueNotes("gameOver");
    for (let i = 1; i < notes.length; i++) {
      expect(notes[i].frequency).toBeLessThan(notes[i - 1].frequency);
    }
  });
});

describe("createSoundPlayer", () => {
  it("is a no-op that never throws when Web Audio / window is unavailable (server, this test env)", () => {
    const player = createSoundPlayer();
    expect(() => player.play("deal")).not.toThrow();
    expect(() => player.play("combo", { comboMultiplier: 3 })).not.toThrow();
  });

  function fakeOscillator() {
    return {
      type: "square",
      frequency: { value: 0 },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
  }

  function fakeGainNode() {
    return {
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };
  }

  function fakeAudioContext(overrides: Partial<{
    state: string;
    resume: () => Promise<void>;
    createOscillator: () => unknown;
  }> = {}) {
    return {
      state: overrides.state ?? "running",
      currentTime: 0,
      destination: {},
      resume: overrides.resume ?? (() => Promise.resolve()),
      createOscillator: overrides.createOscillator ?? fakeOscillator,
      createGain: fakeGainNode,
    } as unknown as AudioContext;
  }

  function ctorReturning(audioCtx: AudioContext): new () => AudioContext {
    function FakeAudioContext(this: unknown) {
      return audioCtx;
    }
    return FakeAudioContext as unknown as new () => AudioContext;
  }

  it("never throws when the AudioContext constructor itself throws", () => {
    class ThrowingAudioContext {
      constructor() {
        throw new Error("AudioContext blocked");
      }
    }
    const player = createSoundPlayer({ audioContextCtor: ThrowingAudioContext as unknown as new () => AudioContext });

    expect(() => player.play("deal")).not.toThrow();
    // Marked unavailable after the first failure: a second call must not
    // retry the throwing constructor either.
    expect(() => player.play("correct")).not.toThrow();
  });

  it("never leaks an unhandled rejection when resume() rejects", async () => {
    const onUnhandledRejection = vi.fn();
    process.on("unhandledRejection", onUnhandledRejection);

    try {
      const audioCtx = fakeAudioContext({
        state: "suspended",
        resume: () => Promise.reject(new Error("no user gesture yet")),
      });
      const player = createSoundPlayer({ audioContextCtor: ctorReturning(audioCtx) });

      expect(() => player.play("deal")).not.toThrow();
      // Let the rejected promise's microtask settle.
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(onUnhandledRejection).not.toHaveBeenCalled();
    } finally {
      process.off("unhandledRejection", onUnhandledRejection);
    }
  });

  it("never throws when scheduling fails on a closed/broken context", () => {
    const audioCtx = fakeAudioContext({
      createOscillator: () => {
        throw new Error("context is closed");
      },
    });
    const player = createSoundPlayer({ audioContextCtor: ctorReturning(audioCtx) });

    expect(() => player.play("deal")).not.toThrow();
  });
});
