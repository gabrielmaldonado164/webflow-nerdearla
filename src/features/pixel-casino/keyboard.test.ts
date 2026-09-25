import { describe, expect, it } from "vitest";

import type { Action } from "@/blackjack";

import { keyToCommand } from "./keyboard";

const ALL_ACTIONS: Action[] = ["hit", "stand", "double", "split"];

describe("keyToCommand — choosing an action", () => {
  it.each([
    ["h", "hit"],
    ["H", "hit"],
    ["s", "stand"],
    ["S", "stand"],
    ["d", "double"],
    ["D", "double"],
    ["p", "split"],
    ["P", "split"],
  ] as const)("maps %s to choosing %s", (key, action) => {
    expect(
      keyToCommand(key, { hasFeedback: false, availableActions: ALL_ACTIONS, isGameOver: false }),
    ).toEqual({ type: "choose", action });
  });

  it("rejects an action key that isn't available for the current hand", () => {
    expect(
      keyToCommand("p", { hasFeedback: false, availableActions: ["hit", "stand"], isGameOver: false }),
    ).toBeNull();
  });

  it("returns null for a key with no mapping", () => {
    expect(
      keyToCommand("x", { hasFeedback: false, availableActions: ALL_ACTIONS, isGameOver: false }),
    ).toBeNull();
  });

  it("does not choose while feedback is pending", () => {
    expect(
      keyToCommand("h", { hasFeedback: true, availableActions: ALL_ACTIONS, isGameOver: false }),
    ).toBeNull();
  });

  it("does not choose once the run is over", () => {
    expect(
      keyToCommand("h", { hasFeedback: false, availableActions: ALL_ACTIONS, isGameOver: true }),
    ).toBeNull();
  });

  it("Enter does not choose an action (it advances instead)", () => {
    expect(
      keyToCommand("Enter", { hasFeedback: false, availableActions: ALL_ACTIONS, isGameOver: false }),
    ).toBeNull();
  });
});

describe("keyToCommand — advancing to the next hand", () => {
  it("Enter advances when feedback exists", () => {
    expect(
      keyToCommand("Enter", { hasFeedback: true, availableActions: ALL_ACTIONS, isGameOver: false }),
    ).toEqual({ type: "next" });
  });

  it("is case-insensitive for Enter's spelling variants it might receive", () => {
    expect(
      keyToCommand("enter", { hasFeedback: true, availableActions: ALL_ACTIONS, isGameOver: false }),
    ).toEqual({ type: "next" });
  });

  it("does not advance without feedback", () => {
    expect(
      keyToCommand("Enter", { hasFeedback: false, availableActions: ALL_ACTIONS, isGameOver: false }),
    ).toBeNull();
  });

  it("other keys do not advance even with feedback pending", () => {
    expect(
      keyToCommand("s", { hasFeedback: true, availableActions: ALL_ACTIONS, isGameOver: false }),
    ).toBeNull();
  });
});

describe("keyToCommand — restarting a finished run", () => {
  it("Enter restarts when the run is over", () => {
    expect(
      keyToCommand("Enter", { hasFeedback: true, availableActions: ALL_ACTIONS, isGameOver: true }),
    ).toEqual({ type: "restart" });
  });

  it("R restarts when the run is over, case-insensitive", () => {
    expect(
      keyToCommand("r", { hasFeedback: false, availableActions: ALL_ACTIONS, isGameOver: true }),
    ).toEqual({ type: "restart" });
    expect(
      keyToCommand("R", { hasFeedback: false, availableActions: ALL_ACTIONS, isGameOver: true }),
    ).toEqual({ type: "restart" });
  });

  it("game over takes priority over pending feedback: Enter restarts, not advances", () => {
    expect(
      keyToCommand("Enter", { hasFeedback: true, availableActions: ALL_ACTIONS, isGameOver: true }),
    ).toEqual({ type: "restart" });
  });

  it("action keys do nothing once the run is over", () => {
    expect(
      keyToCommand("h", { hasFeedback: false, availableActions: ALL_ACTIONS, isGameOver: true }),
    ).toBeNull();
  });

  it("R does nothing while the run is still playing", () => {
    expect(
      keyToCommand("r", { hasFeedback: false, availableActions: ALL_ACTIONS, isGameOver: false }),
    ).toBeNull();
  });
});
