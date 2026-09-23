import { describe, expect, it } from "vitest";

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
});
