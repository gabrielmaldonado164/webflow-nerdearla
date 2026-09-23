/**
 * Pure pixel-art data for the croupier coach: a palette map plus one
 * string-row grid per pose. Each row is a string of single characters, one
 * per pixel column; `.` is transparent, every other character is a key in
 * `PALETTE`. `CroupierCoach.tsx` renders a frame as merged horizontal
 * `<rect>` runs (`frameToRects`) so the DOM stays small.
 *
 * The grids themselves are assembled from small rectangular segments (see
 * `row` below) rather than hand-typed character-by-character strings: it
 * keeps the art maintainable and each pose's differences (eyes, eyebrow,
 * mouth, the arm holding the card) legible as a short list of shapes
 * layered over a shared `BASE` bust. `outline` then draws a 1px silhouette
 * automatically from whatever shape was painted, so the outline can never
 * drift out of sync with the shape.
 */

export const SPRITE_WIDTH = 26;
export const SPRITE_HEIGHT = 28;

/** Palette key -> CSS color. Chosen to sit with the table's felt/brass theme. */
export const PALETTE: Record<string, string> = {
  o: "#17110d", // outline
  h: "#241c14", // hair, slicked back
  f: "#e3a874", // face skin
  d: "#b97f4e", // face shadow (sideburn / jaw)
  v: "#4fe08f", // eyeshade visor, felt green
  V: "#237049", // visor underside / trim
  e: "#f4ecd6", // eye white
  p: "#1c1712", // pupil
  m: "#6b4a32", // mouth line
  s: "#f4ecd6", // shirt
  w: "#cfc4a8", // shirt shadow
  b: "#c23b3b", // bow tie
  j: "#5c1f2e", // vest, burgundy
  k: "#3d131e", // vest shadow
  g: "#c8a761", // sleeve garter, brass/gold
  c: "#f8f1d9", // playing card
  x: "#17110d", // card pip
};

export type CroupierPose = "idleOpen" | "idleBlink" | "celebrate" | "teach" | "gameOver";

export const CROUPIER_POSES: readonly CroupierPose[] = ["idleOpen", "idleBlink", "celebrate", "teach", "gameOver"];

interface Segment {
  row: number;
  from: number;
  to: number; // exclusive
  char: string;
}

function paint(width: number, height: number, segments: readonly Segment[]): string[][] {
  const grid: string[][] = Array.from({ length: height }, () => new Array(width).fill("."));
  for (const { row, from, to, char } of segments) {
    if (row < 0 || row >= height) continue;
    const start = Math.max(0, from);
    const end = Math.min(width, to);
    for (let col = start; col < end; col++) grid[row][col] = char;
  }
  return grid;
}

/** Draws a 1px `o` outline on every transparent cell adjacent to a painted one. */
function outline(grid: readonly string[][]): string[][] {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const next = grid.map((row) => [...row]);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (grid[y][x] !== ".") continue;
      const hasNeighbor =
        (grid[y - 1]?.[x] ?? ".") !== "." ||
        (grid[y + 1]?.[x] ?? ".") !== "." ||
        (grid[y]?.[x - 1] ?? ".") !== "." ||
        (grid[y]?.[x + 1] ?? ".") !== ".";
      if (hasNeighbor) next[y][x] = "o";
    }
  }
  return next;
}

function toRows(grid: readonly string[][]): string[] {
  return grid.map((row) => row.join(""));
}

// --- Shared bust: hair, visor, face silhouette, neck, shirt/vest, torso ---
const BASE_SEGMENTS: readonly Segment[] = [
  // Hair (rounded top, tapering out).
  { row: 0, from: 10, to: 16, char: "h" },
  { row: 1, from: 9, to: 17, char: "h" },
  { row: 2, from: 8, to: 18, char: "h" },
  { row: 3, from: 7, to: 19, char: "h" },
  { row: 4, from: 7, to: 9, char: "h" },
  { row: 4, from: 17, to: 19, char: "h" },
  { row: 4, from: 9, to: 17, char: "f" },
  // Visor eyeshade band across the forehead.
  { row: 5, from: 7, to: 19, char: "v" },
  { row: 6, from: 7, to: 19, char: "v" },
  { row: 7, from: 7, to: 19, char: "V" },
  // Face.
  { row: 8, from: 7, to: 8, char: "h" },
  { row: 8, from: 18, to: 19, char: "h" },
  { row: 8, from: 8, to: 18, char: "f" },
  { row: 9, from: 7, to: 8, char: "h" },
  { row: 9, from: 18, to: 19, char: "h" },
  { row: 9, from: 8, to: 18, char: "f" },
  { row: 10, from: 7, to: 19, char: "f" },
  { row: 11, from: 7, to: 8, char: "d" },
  { row: 11, from: 18, to: 19, char: "d" },
  { row: 11, from: 8, to: 18, char: "f" },
  { row: 12, from: 8, to: 18, char: "f" },
  { row: 13, from: 9, to: 10, char: "d" },
  { row: 13, from: 16, to: 17, char: "d" },
  { row: 13, from: 10, to: 16, char: "f" },
  { row: 14, from: 10, to: 11, char: "d" },
  { row: 14, from: 15, to: 16, char: "d" },
  { row: 14, from: 11, to: 15, char: "f" },
  // Neck + collar.
  { row: 15, from: 11, to: 15, char: "f" },
  { row: 16, from: 11, to: 15, char: "f" },
  { row: 16, from: 8, to: 11, char: "s" },
  { row: 16, from: 15, to: 18, char: "s" },
  // Bow tie: a knot flanked by two wider wings, so it reads as a bow
  // rather than a solid block of color.
  { row: 17, from: 7, to: 19, char: "s" },
  { row: 16, from: 12, to: 14, char: "b" },
  { row: 17, from: 9, to: 12, char: "b" },
  { row: 17, from: 14, to: 17, char: "b" },
  { row: 17, from: 12, to: 14, char: "k" },
  // Shoulders widen into the vest and shirt sleeves.
  { row: 18, from: 4, to: 22, char: "s" },
  { row: 18, from: 10, to: 16, char: "j" },
  { row: 19, from: 2, to: 9, char: "s" },
  { row: 19, from: 9, to: 17, char: "j" },
  { row: 20, from: 2, to: 9, char: "s" },
  { row: 20, from: 9, to: 17, char: "j" },
  { row: 20, from: 12, to: 14, char: "k" },
  { row: 21, from: 2, to: 9, char: "s" },
  { row: 21, from: 9, to: 17, char: "j" },
  { row: 22, from: 2, to: 9, char: "s" },
  { row: 22, from: 9, to: 17, char: "j" },
  { row: 22, from: 12, to: 14, char: "k" },
  { row: 23, from: 2, to: 9, char: "s" },
  { row: 23, from: 9, to: 17, char: "j" },
  { row: 24, from: 1, to: 10, char: "s" },
  { row: 24, from: 10, to: 16, char: "j" },
  { row: 25, from: 1, to: 10, char: "s" },
  { row: 25, from: 10, to: 16, char: "j" },
  { row: 25, from: 12, to: 14, char: "k" },
  { row: 26, from: 0, to: 11, char: "s" },
  { row: 26, from: 11, to: 15, char: "j" },
  { row: 27, from: 0, to: 11, char: "s" },
  { row: 27, from: 11, to: 15, char: "j" },
];

/** Round pupils looking forward, eyebrows relaxed. */
const EYES_OPEN: readonly Segment[] = [
  { row: 9, from: 9, to: 11, char: "e" },
  { row: 9, from: 10, to: 11, char: "p" },
  { row: 9, from: 15, to: 17, char: "e" },
  { row: 9, from: 16, to: 17, char: "p" },
];

/** A closed-eye blink: a single dark line where the pupils sat. */
const EYES_BLINK: readonly Segment[] = [
  { row: 9, from: 9, to: 11, char: "d" },
  { row: 9, from: 15, to: 17, char: "d" },
];

/** Eyes closed shut for the game-over pose (fuller line, brow drops with them). */
const EYES_CLOSED_SAD: readonly Segment[] = [
  { row: 8, from: 9, to: 11, char: "d" },
  { row: 9, from: 9, to: 11, char: "d" },
  { row: 8, from: 15, to: 17, char: "d" },
  { row: 9, from: 15, to: 17, char: "d" },
];

/** Happy upward eye arcs for celebrate. */
const EYES_HAPPY: readonly Segment[] = [
  { row: 8, from: 9, to: 11, char: "d" },
  { row: 9, from: 9, to: 11, char: "e" },
  { row: 8, from: 15, to: 17, char: "d" },
  { row: 9, from: 15, to: 17, char: "e" },
];

const MOUTH_NEUTRAL: readonly Segment[] = [{ row: 12, from: 12, to: 15, char: "m" }];
const MOUTH_SMILE: readonly Segment[] = [
  { row: 12, from: 11, to: 12, char: "m" },
  { row: 12, from: 15, to: 16, char: "m" },
  { row: 13, from: 12, to: 15, char: "m" },
];
const MOUTH_FLAT_SAD: readonly Segment[] = [{ row: 13, from: 11, to: 16, char: "m" }];

/** One eyebrow raised (a short dark bar over the left eye) for the teach pose. */
const EYEBROW_RAISED: readonly Segment[] = [{ row: 7, from: 9, to: 11, char: "h" }];

/** The croupier's right arm, bent, holding a face-up Ace of spades near the chest. */
const ARM_CARD_NEUTRAL: readonly Segment[] = [
  { row: 19, from: 17, to: 24, char: "s" },
  { row: 20, from: 17, to: 22, char: "s" },
  { row: 20, from: 19, to: 23, char: "g" },
  { row: 21, from: 17, to: 21, char: "s" },
  { row: 21, from: 21, to: 26, char: "c" },
  { row: 22, from: 17, to: 21, char: "s" },
  { row: 22, from: 21, to: 26, char: "c" },
  { row: 22, from: 23, to: 24, char: "x" },
  { row: 23, from: 17, to: 21, char: "f" },
  { row: 23, from: 21, to: 26, char: "c" },
  { row: 24, from: 21, to: 26, char: "c" },
];

/** The same arm, lifted a couple of rows for the celebrate pose. */
const ARM_CARD_RAISED: readonly Segment[] = [
  { row: 16, from: 17, to: 24, char: "s" },
  { row: 17, from: 17, to: 22, char: "s" },
  { row: 17, from: 19, to: 23, char: "g" },
  { row: 18, from: 17, to: 21, char: "s" },
  { row: 18, from: 21, to: 26, char: "c" },
  { row: 19, from: 17, to: 21, char: "s" },
  { row: 19, from: 21, to: 26, char: "c" },
  { row: 19, from: 23, to: 24, char: "x" },
  { row: 20, from: 17, to: 21, char: "f" },
  { row: 20, from: 21, to: 26, char: "c" },
  { row: 21, from: 21, to: 26, char: "c" },
];

/** The arm lowered to the side, card down, for the game-over pose. */
const ARM_CARD_LOWERED: readonly Segment[] = [
  { row: 20, from: 17, to: 24, char: "s" },
  { row: 21, from: 17, to: 22, char: "s" },
  { row: 21, from: 19, to: 23, char: "g" },
  { row: 22, from: 17, to: 21, char: "s" },
  { row: 22, from: 21, to: 26, char: "c" },
  { row: 23, from: 17, to: 21, char: "s" },
  { row: 23, from: 21, to: 26, char: "c" },
  { row: 24, from: 17, to: 21, char: "f" },
  { row: 24, from: 21, to: 26, char: "c" },
  { row: 24, from: 23, to: 24, char: "x" },
];

function buildFrame(...layers: readonly (readonly Segment[])[]): string[] {
  const grid = paint(SPRITE_WIDTH, SPRITE_HEIGHT, layers.flat());
  return toRows(outline(grid));
}

export const CROUPIER_FRAMES: Record<CroupierPose, readonly string[]> = {
  idleOpen: buildFrame(BASE_SEGMENTS, ARM_CARD_NEUTRAL, EYES_OPEN, MOUTH_NEUTRAL),
  idleBlink: buildFrame(BASE_SEGMENTS, ARM_CARD_NEUTRAL, EYES_BLINK, MOUTH_NEUTRAL),
  celebrate: buildFrame(BASE_SEGMENTS, ARM_CARD_RAISED, EYES_HAPPY, MOUTH_SMILE),
  teach: buildFrame(BASE_SEGMENTS, ARM_CARD_NEUTRAL, EYES_OPEN, EYEBROW_RAISED, MOUTH_NEUTRAL),
  gameOver: buildFrame(BASE_SEGMENTS, ARM_CARD_LOWERED, EYES_CLOSED_SAD, MOUTH_FLAT_SAD),
};

export interface SpriteRect {
  x: number;
  y: number;
  width: number;
  color: string;
}

/**
 * Merges consecutive same-color pixels within each row into one rect
 * (never merged across rows), skipping transparent (`.`) pixels — so a
 * frame renders as a handful of `<rect>`s instead of one per pixel.
 */
export function frameToRects(rows: readonly string[], palette: Record<string, string>): SpriteRect[] {
  const rects: SpriteRect[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const char = row[x];
      if (char === ".") {
        x++;
        continue;
      }
      let width = 1;
      while (x + width < row.length && row[x + width] === char) width++;
      rects.push({ x, y, width, color: palette[char] });
      x += width;
    }
  });
  return rects;
}
