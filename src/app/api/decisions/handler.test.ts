import { describe, expect, it, vi } from "vitest";

import type { DecisionRow } from "@/player/recordDecision";

import type { DecisionHandlerDeps, DecisionHandlerRepo } from "./handler";
import { handleDecisionRequest } from "./handler";

const VALID_EXISTING_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const MINTED_ID = "3fa85f64-5717-4562-b3fc-2c963f66afa6";

const validBody = JSON.stringify({
  playerCards: [
    { rank: "10", suit: "spades" },
    { rank: "6", suit: "hearts" },
  ],
  dealerUpcard: { rank: "9", suit: "clubs" },
  userAction: "hit",
});

function fakeRepo(): DecisionHandlerRepo & {
  ensurePlayerCalls: string[];
  inserted: DecisionRow[];
} {
  const ensurePlayerCalls: string[] = [];
  const inserted: DecisionRow[] = [];
  return {
    ensurePlayerCalls,
    inserted,
    async ensurePlayer(playerId) {
      ensurePlayerCalls.push(playerId);
    },
    async insertDecision(row) {
      inserted.push(row);
    },
  };
}

function baseDeps(overrides: Partial<DecisionHandlerDeps> = {}): DecisionHandlerDeps {
  return {
    readCookie: () => undefined,
    repo: fakeRepo(),
    newId: () => MINTED_ID,
    secure: false,
    ...overrides,
  };
}

describe("handleDecisionRequest", () => {
  it("mints a fresh id, ensures the player, and returns 201 for a new player", async () => {
    const repo = fakeRepo();
    const deps = baseDeps({ readCookie: () => undefined, repo });

    const result = await handleDecisionRequest(validBody, deps);

    expect(result.status).toBe(201);
    expect(result.body).toHaveProperty("id");
    expect(repo.ensurePlayerCalls).toEqual([MINTED_ID]);
    expect(repo.inserted).toHaveLength(1);
    expect(repo.inserted[0].playerId).toBe(MINTED_ID);
    expect(result.setCookie).toMatchObject({ value: MINTED_ID, secure: false });
  });

  it("reuses a valid existing cookie and never calls newId", async () => {
    const repo = fakeRepo();
    const newId = vi.fn(() => MINTED_ID);
    const deps = baseDeps({ readCookie: () => VALID_EXISTING_ID, repo, newId });

    const result = await handleDecisionRequest(validBody, deps);

    expect(result.status).toBe(201);
    expect(newId).not.toHaveBeenCalled();
    expect(repo.ensurePlayerCalls).toEqual([VALID_EXISTING_ID]);
    expect(result.setCookie).toMatchObject({ value: VALID_EXISTING_ID });
  });

  it("replaces an invalid (tampered) cookie with a freshly minted id", async () => {
    const repo = fakeRepo();
    const deps = baseDeps({ readCookie: () => "not-a-uuid", repo });

    const result = await handleDecisionRequest(validBody, deps);

    expect(result.status).toBe(201);
    expect(repo.ensurePlayerCalls).toEqual([MINTED_ID]);
    expect(result.setCookie).toMatchObject({ value: MINTED_ID });
  });

  it("returns 400 with zero repo calls for a body that fails to parse as JSON", async () => {
    const repo = fakeRepo();
    const deps = baseDeps({ repo });

    const result = await handleDecisionRequest("{not json", deps);

    expect(result.status).toBe(400);
    expect(repo.ensurePlayerCalls).toHaveLength(0);
    expect(repo.inserted).toHaveLength(0);
    expect(result.setCookie).toBeUndefined();
  });

  it("returns 400 with zero repo calls for an unknown (illegal) action", async () => {
    const repo = fakeRepo();
    const deps = baseDeps({ repo });
    const body = JSON.stringify({
      playerCards: [
        { rank: "10", suit: "spades" },
        { rank: "6", suit: "hearts" },
      ],
      dealerUpcard: { rank: "9", suit: "clubs" },
      userAction: "surrender",
    });

    const result = await handleDecisionRequest(body, deps);

    expect(result.status).toBe(400);
    expect(repo.ensurePlayerCalls).toHaveLength(0);
    expect(repo.inserted).toHaveLength(0);
    expect(result.setCookie).toBeUndefined();
  });

  it("returns 400 with zero repo calls for a hand that is already bust", async () => {
    const repo = fakeRepo();
    const deps = baseDeps({ repo });
    const body = JSON.stringify({
      playerCards: [
        { rank: "10", suit: "spades" },
        { rank: "9", suit: "hearts" },
        { rank: "5", suit: "clubs" },
      ],
      dealerUpcard: { rank: "9", suit: "clubs" },
      userAction: "hit",
    });

    const result = await handleDecisionRequest(body, deps);

    expect(result.status).toBe(400);
    expect(repo.ensurePlayerCalls).toHaveLength(0);
    expect(repo.inserted).toHaveLength(0);
  });

  it("establishes player identity but inserts nothing when the action is game-illegal for this hand", async () => {
    const repo = fakeRepo();
    const deps = baseDeps({ repo });
    // Three cards: double is never available.
    const body = JSON.stringify({
      playerCards: [
        { rank: "10", suit: "spades" },
        { rank: "6", suit: "hearts" },
        { rank: "2", suit: "clubs" },
      ],
      dealerUpcard: { rank: "9", suit: "clubs" },
      userAction: "double",
    });

    const result = await handleDecisionRequest(body, deps);

    expect(result.status).toBe(400);
    expect(repo.ensurePlayerCalls).toEqual([MINTED_ID]);
    expect(repo.inserted).toHaveLength(0);
    expect(result.setCookie).toMatchObject({ value: MINTED_ID });
  });

  it("returns 500 with a generic message and no stack when ensurePlayer throws", async () => {
    const repo: DecisionHandlerRepo = {
      ensurePlayer: vi.fn().mockRejectedValue(new Error("D1 unavailable: secret-dsn")),
      insertDecision: vi.fn(),
    };
    const deps = baseDeps({ repo });

    const result = await handleDecisionRequest(validBody, deps);

    expect(result.status).toBe(500);
    expect(result.body.error).not.toContain("secret-dsn");
    expect(result.body).not.toHaveProperty("stack");
  });

  it("returns 500 with a generic message and no stack when insertDecision throws", async () => {
    const repo: DecisionHandlerRepo = {
      ensurePlayer: vi.fn().mockResolvedValue(undefined),
      insertDecision: vi.fn().mockRejectedValue(new Error("D1 unavailable: secret-dsn")),
    };
    const deps = baseDeps({ repo });

    const result = await handleDecisionRequest(validBody, deps);

    expect(result.status).toBe(500);
    expect(result.body.error).not.toContain("secret-dsn");
    expect(result.body).not.toHaveProperty("stack");
  });

  it("marks the cookie secure when deps.secure is true", async () => {
    const deps = baseDeps({ secure: true });

    const result = await handleDecisionRequest(validBody, deps);

    expect(result.setCookie).toMatchObject({ secure: true });
  });
});
