import { describe, expect, it } from "vitest";

import {
  CROUPIER_FRAMES,
  CROUPIER_POSES,
  frameToRects,
  PALETTE,
  SPRITE_HEIGHT,
  SPRITE_WIDTH,
} from "./croupierSprite";

describe("CROUPIER_FRAMES", () => {
  it("gives every pose exactly SPRITE_HEIGHT rows", () => {
    for (const pose of CROUPIER_POSES) {
      expect(CROUPIER_FRAMES[pose].length).toBe(SPRITE_HEIGHT);
    }
  });

  it("gives every row of every pose exactly SPRITE_WIDTH characters", () => {
    for (const pose of CROUPIER_POSES) {
      for (const row of CROUPIER_FRAMES[pose]) {
        expect(row.length).toBe(SPRITE_WIDTH);
      }
    }
  });

  it("uses only '.' (transparent) or a palette key for every pixel", () => {
    for (const pose of CROUPIER_POSES) {
      for (const row of CROUPIER_FRAMES[pose]) {
        for (const char of row) {
          expect(char === "." || char in PALETTE).toBe(true);
        }
      }
    }
  });

  it("draws at least one non-transparent pixel per pose (nothing is blank)", () => {
    for (const pose of CROUPIER_POSES) {
      const hasPixel = CROUPIER_FRAMES[pose].some((row) => [...row].some((char) => char !== "."));
      expect(hasPixel).toBe(true);
    }
  });
});

describe("frameToRects", () => {
  it("merges consecutive same-color pixels within a row into one rect", () => {
    const rows = ["aab.b", "ccccc"];
    const palette = { a: "#111111", b: "#222222", c: "#333333" };

    expect(frameToRects(rows, palette)).toEqual([
      { x: 0, y: 0, width: 2, color: "#111111" },
      { x: 2, y: 0, width: 1, color: "#222222" },
      { x: 4, y: 0, width: 1, color: "#222222" },
      { x: 0, y: 1, width: 5, color: "#333333" },
    ]);
  });

  it("emits no rect for transparent ('.') pixels", () => {
    expect(frameToRects(["..."], { a: "#111111" })).toEqual([]);
  });

  it("reconstructs the exact same pixel grid the rows describe", () => {
    function paintGrid(rows: readonly string[], palette: Record<string, string>): (string | null)[][] {
      return rows.map((row) => [...row].map((char) => (char === "." ? null : palette[char])));
    }

    for (const pose of CROUPIER_POSES) {
      const rows = CROUPIER_FRAMES[pose];
      const expectedGrid = paintGrid(rows, PALETTE);

      const rects = frameToRects(rows, PALETTE);
      const actualGrid: (string | null)[][] = rows.map((row) => new Array(row.length).fill(null));
      for (const rect of rects) {
        for (let dx = 0; dx < rect.width; dx++) {
          actualGrid[rect.y][rect.x + dx] = rect.color;
        }
      }

      expect(actualGrid).toEqual(expectedGrid);
    }
  });
});
