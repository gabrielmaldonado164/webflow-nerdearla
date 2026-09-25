import { describe, expect, it } from "vitest";

import { outcomeCopy } from "./outcomeCopy";

describe("outcomeCopy", () => {
  it("labels a win with no note when the decision was also correct", () => {
    const copy = outcomeCopy({ outcome: "win", isCorrectDecision: true });
    expect(copy.banner).toBe("WIN");
    expect(copy.note).toBeNull();
  });

  it("labels a natural blackjack with no note when the decision was also correct", () => {
    const copy = outcomeCopy({ outcome: "blackjack", isCorrectDecision: true });
    expect(copy.banner).toBe("BLACKJACK!");
    expect(copy.note).toBeNull();
  });

  it("labels a push with no note, regardless of decision correctness", () => {
    expect(outcomeCopy({ outcome: "push", isCorrectDecision: true }).note).toBeNull();
    expect(outcomeCopy({ outcome: "push", isCorrectDecision: false }).note).toBeNull();
    expect(outcomeCopy({ outcome: "push", isCorrectDecision: true }).banner).toBe("PUSH");
  });

  it("labels a loss with no note when the decision was also wrong", () => {
    const copy = outcomeCopy({ outcome: "lose", isCorrectDecision: false });
    expect(copy.banner).toBe("LOSE");
    expect(copy.note).toBeNull();
  });

  it("explains that the right call still lost, when the decision was correct but the hand lost", () => {
    const copy = outcomeCopy({ outcome: "lose", isCorrectDecision: true });
    expect(copy.banner).toBe("LOSE");
    expect(copy.note).toMatch(/right call/i);
  });

  it("credits luck, not skill, when the decision was wrong but the hand won", () => {
    const copy = outcomeCopy({ outcome: "win", isCorrectDecision: false });
    expect(copy.banner).toBe("WIN");
    expect(copy.note).toMatch(/luck/i);
  });

  it("credits luck, not skill, when the decision was wrong but the hand hit blackjack", () => {
    const copy = outcomeCopy({ outcome: "blackjack", isCorrectDecision: false });
    expect(copy.banner).toBe("BLACKJACK!");
    expect(copy.note).toMatch(/luck/i);
  });
});
