import { describe, expect, it } from "vitest";

import { coachQuotaCopy, shouldApplyUsageFetch } from "./coachQuotaCopy";

describe("coachQuotaCopy", () => {
  it("hides the counter and notes when no usage or outcome is known yet", () => {
    expect(coachQuotaCopy({ limit: null, remaining: null, outcomeKind: null, refunded: false })).toEqual({
      counter: null,
      limitMessage: null,
      refundMessage: null,
    });
  });

  it("shows the counter once usage is known, with no note before any stream outcome", () => {
    expect(coachQuotaCopy({ limit: 20, remaining: 12, outcomeKind: null, refunded: false })).toEqual({
      counter: "12/20 AI questions left today",
      limitMessage: null,
      refundMessage: null,
    });
  });

  it("keeps the counter hidden when usage is known but incomplete", () => {
    expect(coachQuotaCopy({ limit: 20, remaining: null, outcomeKind: null, refunded: false })).toEqual({
      counter: null,
      limitMessage: null,
      refundMessage: null,
    });
  });

  it("shows a distinct limit-reached note and a 0/limit counter on a limit outcome", () => {
    expect(coachQuotaCopy({ limit: 20, remaining: 0, outcomeKind: "limit", refunded: false })).toEqual({
      counter: "0/20 AI questions left today",
      limitMessage: "Daily AI limit reached. It resets at 00:00 UTC; the built-in explanations still work.",
      refundMessage: null,
    });
  });

  it("notes the refund only when the server confirmed it (refunded: true)", () => {
    expect(coachQuotaCopy({ limit: 20, remaining: 9, outcomeKind: "unavailable", refunded: true })).toEqual({
      counter: "9/20 AI questions left today",
      limitMessage: null,
      refundMessage: "This didn't use one of your questions.",
    });
  });

  it("omits the refund note for an unavailable outcome the server did not confirm as refunded, even with a known remaining", () => {
    expect(coachQuotaCopy({ limit: 20, remaining: 12, outcomeKind: "unavailable", refunded: false })).toEqual({
      counter: "12/20 AI questions left today",
      limitMessage: null,
      refundMessage: null,
    });
  });

  it("omits the refund note when the failed request's remaining is unknown", () => {
    expect(coachQuotaCopy({ limit: 20, remaining: null, outcomeKind: "unavailable", refunded: false })).toEqual({
      counter: null,
      limitMessage: null,
      refundMessage: null,
    });
  });

  it("shows no note for a successful ok outcome", () => {
    expect(coachQuotaCopy({ limit: 20, remaining: 15, outcomeKind: "ok", refunded: false })).toEqual({
      counter: "15/20 AI questions left today",
      limitMessage: null,
      refundMessage: null,
    });
  });
});

describe("shouldApplyUsageFetch", () => {
  it("applies the usage fetch when no stream outcome has landed yet", () => {
    expect(shouldApplyUsageFetch({ limit: null, remaining: null, outcomeKind: null, refunded: false })).toBe(true);
  });

  it("ignores a usage fetch resolving after a stream outcome already updated quota", () => {
    expect(shouldApplyUsageFetch({ limit: 20, remaining: 17, outcomeKind: "ok", refunded: false })).toBe(false);
    expect(shouldApplyUsageFetch({ limit: 20, remaining: 0, outcomeKind: "limit", refunded: false })).toBe(false);
    expect(shouldApplyUsageFetch({ limit: 20, remaining: 18, outcomeKind: "unavailable", refunded: true })).toBe(false);
  });
});

describe("coachQuotaCopy when the day's quota is already used up", () => {
  it("shows the limit note on open, before any question is asked", () => {
    const copy = coachQuotaCopy({ limit: 20, remaining: 0, outcomeKind: null, refunded: false });
    expect(copy.counter).toBe("0/20 AI questions left today");
    expect(copy.limitMessage).toMatch(/Daily AI limit reached/);
  });
});
