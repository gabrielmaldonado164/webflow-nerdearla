import { describe, expect, it } from "vitest";

import { isValidPlayerId } from "./playerId";
import {
  PLAYER_COOKIE_MAX_AGE_SECONDS,
  PLAYER_COOKIE_NAME,
  playerCookieOptions,
  resolvePlayerId,
} from "./playerCookie";

const VALID_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

describe("resolvePlayerId", () => {
  it("reuses a valid existing cookie value", () => {
    const result = resolvePlayerId(VALID_ID);
    expect(result).toEqual({ playerId: VALID_ID, isNew: false });
  });

  it("mints a fresh id when no cookie value is present", () => {
    const result = resolvePlayerId(undefined);
    expect(result.isNew).toBe(true);
    expect(isValidPlayerId(result.playerId)).toBe(true);
  });

  it("mints a fresh id when the cookie value is not a valid UUID (tampered)", () => {
    const result = resolvePlayerId("not-a-uuid");
    expect(result.isNew).toBe(true);
    expect(isValidPlayerId(result.playerId)).toBe(true);
    expect(result.playerId).not.toBe("not-a-uuid");
  });

  it("mints a fresh id for an empty string", () => {
    const result = resolvePlayerId("");
    expect(result.isNew).toBe(true);
  });
});

describe("playerCookieOptions", () => {
  it("returns httpOnly, sameSite=lax, path=/ and the ~1 year maxAge", () => {
    const options = playerCookieOptions(VALID_ID, false);
    expect(options).toEqual({
      name: PLAYER_COOKIE_NAME,
      value: VALID_ID,
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: PLAYER_COOKIE_MAX_AGE_SECONDS,
    });
  });

  it("sets secure true when asked to", () => {
    const options = playerCookieOptions(VALID_ID, true);
    expect(options.secure).toBe(true);
  });

  it("uses a maxAge of about one year", () => {
    const oneYearInSeconds = 60 * 60 * 24 * 365;
    expect(PLAYER_COOKIE_MAX_AGE_SECONDS).toBe(oneYearInSeconds);
  });
});
