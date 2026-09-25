/**
 * Pure helpers for the anonymous player cookie (D4). Kept framework-free
 * so they're unit-testable without Next.js's `cookies()`/route runtime;
 * `POST /api/decisions` wires these into the actual request/response.
 */

import { generatePlayerId, isValidPlayerId } from "./playerId";

export const PLAYER_COOKIE_NAME = "lab_player";

/** ~1 year, matching the "long-lived" cookie constraint (D4). */
export const PLAYER_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export interface ResolvedPlayerId {
  playerId: string;
  /** True when no valid cookie was present and a fresh id was minted. */
  isNew: boolean;
}

/**
 * Resolves the player id to use for this request: the existing cookie
 * value when it's a valid UUID, otherwise a freshly minted one. A
 * present-but-invalid (tampered or missing) cookie value is treated the
 * same as absent, never trusted as-is.
 */
export function resolvePlayerId(cookieValue: string | undefined): ResolvedPlayerId {
  if (isValidPlayerId(cookieValue)) {
    return { playerId: cookieValue, isNew: false };
  }
  return { playerId: generatePlayerId(), isNew: true };
}

export interface PlayerCookieOptions {
  name: string;
  value: string;
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
}

/**
 * Builds the `Set-Cookie` options for the player cookie. Pass `secure:
 * true` in production (HTTPS-only); `false` allows the cookie over local
 * HTTP dev.
 */
export function playerCookieOptions(playerId: string, secure: boolean): PlayerCookieOptions {
  return {
    name: PLAYER_COOKIE_NAME,
    value: playerId,
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: PLAYER_COOKIE_MAX_AGE_SECONDS,
  };
}
