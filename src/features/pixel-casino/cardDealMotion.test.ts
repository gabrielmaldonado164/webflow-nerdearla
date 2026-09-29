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

  it("starts an already-dealt card at rest so a remount never replays the deal", () => {
    // The hole card swaps to its flip component at reveal; its faces must flip in place.
    expect(cardDealMotion(false, 3, { alreadyDealt: true }).initial).toBe(false);
    expect(cardDealMotion(null, 3, { alreadyDealt: true }).initial).toBe(false);
  });

  it("settles every card at rest", () => {
    expect(cardDealMotion(null, 2).animate).toEqual({ x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 });
  });

  it.each([
    ["narrow mobile", 57, 83],
    ["mobile", 63, 91],
    ["desktop", 88, 120],
  ])("keeps the %s deal inside its resting horizontal lane and below its top edge", (_, width, height) => {
    const initial = cardDealMotion(false, 4).initial;
    if (initial === false) throw new Error("A new card must animate into place");

    const radians = initial.rotate * Math.PI / 180;
    const animatedWidth = initial.scale * (
      width * Math.abs(Math.cos(radians)) + height * Math.abs(Math.sin(radians))
    );
    const animatedHeight = initial.scale * (
      width * Math.abs(Math.sin(radians)) + height * Math.abs(Math.cos(radians))
    );

    // The rightmost card has no spare space beside the fan on a narrow stage.
    // Staying inside its resting lane also prevents crossing over the coach.
    expect(Math.abs(initial.x) + animatedWidth / 2).toBeLessThanOrEqual(width / 2);
    expect(initial.y + (height - animatedHeight) / 2).toBeGreaterThanOrEqual(0);
  });

  it("skips the deal animation when the player prefers reduced motion", () => {
    expect(cardDealMotion(true, 3).transition).toEqual({ duration: 0 });
  });

  it("staggers the spring deal by deal index otherwise", () => {
    expect(cardDealMotion(false, 3).transition).toMatchObject({ type: "spring", delay: 3 * 0.13 });
    expect(cardDealMotion(null, 0).transition).toMatchObject({ type: "spring", delay: 0 });
  });
});
