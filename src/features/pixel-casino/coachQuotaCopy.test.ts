import { describe, expect, it } from "vitest";

import { coachQuotaCopy } from "./coachQuotaCopy";

describe("coachQuotaCopy", () => {
  it("hides the counter and notes when no usage or outcome is known yet", () => {
    expect(coachQuotaCopy({ limit: null, remaining: null, outcomeKind: null })).toEqual({
      counter: null,
      limitMessage: null,
      refundMessage: null,
    });
  });

  it("shows the counter once usage is known, with no note before any stream outcome", () => {
    expect(coachQuotaCopy({ limit: 20, remaining: 12, outcomeKind: null })).toEqual({
      counter: "12/20 AI questions left today",
      limitMessage: null,
      refundMessage: null,
    });
  });

  it("keeps the counter hidden when usage is known but incomplete", () => {
    expect(coachQuotaCopy({ limit: 20, remaining: null, outcomeKind: null })).toEqual({
      counter: null,
      limitMessage: null,
      refundMessage: null,
    });
  });

  it("shows a distinct limit-reached note and a 0/limit counter on a limit outcome", () => {
    expect(coachQuotaCopy({ limit: 20, remaining: 0, outcomeKind: "limit" })).toEqual({
      counter: "0/20 AI questions left today",
      limitMessage: "Daily AI limit reached. It resets at 00:00 UTC; the built-in explanations still work.",
      refundMessage: null,
    });
  });

  it("notes the refund only when the provider failure's remaining count is known", () => {
    expect(coachQuotaCopy({ limit: 20, remaining: 9, outcomeKind: "unavailable" })).toEqual({
      counter: "9/20 AI questions left today",
      limitMessage: null,
      refundMessage: "This didn't use one of your questions.",
    });
  });

  it("omits the refund note when the failed request's remaining is unknown", () => {
    expect(coachQuotaCopy({ limit: 20, remaining: null, outcomeKind: "unavailable" })).toEqual({
      counter: null,
      limitMessage: null,
      refundMessage: null,
    });
  });

  it("shows no note for a successful ok outcome", () => {
    expect(coachQuotaCopy({ limit: 20, remaining: 15, outcomeKind: "ok" })).toEqual({
      counter: "15/20 AI questions left today",
      limitMessage: null,
      refundMessage: null,
    });
  });
});
