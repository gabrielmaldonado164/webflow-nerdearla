import { describe, expect, it } from "vitest";

import { availableActions } from "./actions";
import type { Card } from "./cards";
import { DEFAULT_RULES } from "./rules";

function card(rank: Card["rank"], suit: Card["suit"] = "spades"): Card {
  return { rank, suit };
}

describe("availableActions", () => {
  it("always allows hit and stand", () => {
    const actions = availableActions(
      [card("7"), card("7"), card("7")],
      DEFAULT_RULES,
    );
    expect(actions).toContain("hit");
    expect(actions).toContain("stand");
  });

  it("allows double only with exactly two cards", () => {
    expect(availableActions([card("6"), card("5")], DEFAULT_RULES)).toContain(
      "double",
    );
    expect(
      availableActions([card("6"), card("5"), card("2")], DEFAULT_RULES),
    ).not.toContain("double");
  });

  it("allows split only for a two-card pair", () => {
    expect(availableActions([card("8"), card("8")], DEFAULT_RULES)).toContain(
      "split",
    );
    expect(availableActions([card("K"), card("Q")], DEFAULT_RULES)).toContain(
      "split",
    );
    expect(availableActions([card("8"), card("9")], DEFAULT_RULES)).not.toContain(
      "split",
    );
  });

  it("never allows split after a split (no resplitting)", () => {
    const actions = availableActions([card("8"), card("8")], DEFAULT_RULES, {
      isAfterSplit: true,
    });
    expect(actions).not.toContain("split");
  });

  it("gates double after split on rules.doubleAfterSplit", () => {
    const noDas = { ...DEFAULT_RULES, doubleAfterSplit: false };
    expect(
      availableActions([card("6"), card("5")], noDas, { isAfterSplit: true }),
    ).not.toContain("double");
    expect(
      availableActions([card("6"), card("5")], DEFAULT_RULES, {
        isAfterSplit: true,
      }),
    ).toContain("double");
  });
});
