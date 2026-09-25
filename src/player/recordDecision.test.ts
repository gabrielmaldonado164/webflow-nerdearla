import { describe, expect, it, vi } from "vitest";

import type { Card } from "@/blackjack";

import type { DecisionRepository, DecisionRow } from "./recordDecision";
import { recordDecision } from "./recordDecision";

function card(rank: Card["rank"], suit: Card["suit"] = "spades"): Card {
  return { rank, suit };
}

function fakeRepo(): DecisionRepository & { inserted: DecisionRow[] } {
  const inserted: DecisionRow[] = [];
  return {
    inserted,
    async insertDecision(row) {
      inserted.push(row);
    },
  };
}

const PLAYER_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

describe("recordDecision", () => {
  it("re-grades a hard-total decision with the engine and inserts the row", async () => {
    const repo = fakeRepo();

    const result = await recordDecision(
      {
        playerId: PLAYER_ID,
        playerCards: [card("10"), card("6")],
        dealerUpcard: card("10"),
        userAction: "hit",
      },
      repo,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.row.playerId).toBe(PLAYER_ID);
    expect(result.row.optimalAction).toBe("hit");
    expect(result.row.isCorrect).toBe(true);
    expect(result.row.category).toBe("hard");
    expect(result.row.availableActions).toEqual(["hit", "stand", "double"]);
    expect(repo.inserted).toHaveLength(1);
    expect(repo.inserted[0]).toBe(result.row);
  });

  it("grades a pair decision as incorrect when the user picks the wrong action", async () => {
    const repo = fakeRepo();

    const result = await recordDecision(
      {
        playerId: PLAYER_ID,
        playerCards: [card("8"), card("8")],
        dealerUpcard: card("6"),
        userAction: "hit",
      },
      repo,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.row.category).toBe("pair");
    expect(result.row.optimalAction).toBe("split");
    expect(result.row.isCorrect).toBe(false);
  });

  it("ignores a client-computed grading and always recomputes it server-side", async () => {
    const repo = fakeRepo();

    const result = await recordDecision(
      {
        playerId: PLAYER_ID,
        playerCards: [card("8"), card("8")],
        dealerUpcard: card("6"),
        userAction: "split",
      },
      repo,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.isCorrect).toBe(true);
  });

  it("rejects a user action that is not in the hand's available actions", async () => {
    const repo = fakeRepo();

    const result = await recordDecision(
      {
        playerId: PLAYER_ID,
        // Three cards: double is never available.
        playerCards: [card("10"), card("6"), card("2")],
        dealerUpcard: card("10"),
        userAction: "double",
      },
      repo,
    );

    expect(result.ok).toBe(false);
    expect(repo.inserted).toHaveLength(0);
  });

  it("rejects split for a two-card hand that is not a pair", async () => {
    const repo = fakeRepo();

    const result = await recordDecision(
      {
        playerId: PLAYER_ID,
        playerCards: [card("10"), card("6")],
        dealerUpcard: card("10"),
        userAction: "split",
      },
      repo,
    );

    expect(result.ok).toBe(false);
    expect(repo.inserted).toHaveLength(0);
  });

  it("assigns a fresh id and an ISO createdAt timestamp to the row", async () => {
    const repo = fakeRepo();

    const result = await recordDecision(
      {
        playerId: PLAYER_ID,
        playerCards: [card("10"), card("6")],
        dealerUpcard: card("10"),
        userAction: "hit",
      },
      repo,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(() => new Date(result.row.createdAt).toISOString()).not.toThrow();
  });

  it("propagates a repository failure instead of swallowing it", async () => {
    const repo: DecisionRepository = {
      insertDecision: vi.fn().mockRejectedValue(new Error("D1 unavailable")),
    };

    await expect(
      recordDecision(
        {
          playerId: PLAYER_ID,
          playerCards: [card("10"), card("6")],
          dealerUpcard: card("10"),
          userAction: "hit",
        },
        repo,
      ),
    ).rejects.toThrow("D1 unavailable");
  });
});
