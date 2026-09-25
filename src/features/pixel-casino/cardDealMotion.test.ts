import { describe, expect, it } from "vitest";
import { cardDealMotion } from "./cardDealMotion";

describe("cardDealMotion", () => {
  it("uses the same initial pose on the server and on the client, whatever the motion preference", () => {
    // The server cannot read prefers-reduced-motion (useReducedMotion returns null),
    // so a preference-dependent initial pose causes a hydration mismatch.
    const server = cardDealMotion(null, 0).initial;
    expect(cardDealMotion(true, 0).initial).toEqual(server);
    expect(cardDealMotion(false, 0).initial).toEqual(server);
  });

  it("settles every card at rest", () => {
    expect(cardDealMotion(null, 2).animate).toEqual({ x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 });
  });

  it("skips the deal animation when the player prefers reduced motion", () => {
    expect(cardDealMotion(true, 3).transition).toEqual({ duration: 0 });
  });

  it("staggers the spring deal by deal index otherwise", () => {
    expect(cardDealMotion(false, 3).transition).toMatchObject({ type: "spring", delay: 3 * 0.13 });
    expect(cardDealMotion(null, 0).transition).toMatchObject({ type: "spring", delay: 0 });
  });
});
