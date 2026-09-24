/**
 * Pure handler for `POST /api/coach/stream` (Phase 5 T2b). Everything the
 * route actually does — parsing the body, resolving the player, reserving
 * and (on failure) refunding a daily quota slot, and driving the provider
 * stream — lives here behind injected dependencies
 * (`CoachStreamHandlerDeps`), unit-testable with fakes instead of a real
 * Next.js `Request`/`cookies()`/D1/Cloudflare binding. `route.ts` is a
 * thin adapter wiring these deps to the real runtime and turning the
 * result into a `Response` (JSON for an error, a `ReadableStream` for a
 * successful stream).
 *
 * Refund contract: `reserveCoachCall` is optimistic — it increments the
 * counter before the provider is called. If the provider throws, or
 * returns an empty stream (no text delivered), the reserved slot is
 * refunded via `releaseCoachCall` so the player never loses a question to
 * an outage. A stream interrupted *after* the first chunk was already
 * handed to the caller still counts (the route continues draining it).
 *
 * A failed post-reservation usage read (the read used only to report
 * `remaining` on success) must never turn into a lost slot or a spurious
 * 503: the reservation already succeeded, so the request proceeds with
 * `remaining: null` (the route omits the header) instead of refunding a
 * slot that was validly used.
 */

import type { CoachRequest } from "@/coach/request";
import { parseCoachRequest } from "@/coach/request";
import type { PlayerCookieOptions } from "@/player/playerCookie";
import { playerCookieOptions } from "@/player/playerCookie";

export interface CoachUsageSnapshot {
  limit: number;
  used: number;
  remaining: number;
}

export interface CoachStreamHandlerRepo {
  ensurePlayer(playerId: string): Promise<void>;
  reserveCoachCall(playerId: string, date: string): Promise<boolean>;
  releaseCoachCall(playerId: string, date: string): Promise<void>;
  getCoachUsage(playerId: string, date: string): Promise<CoachUsageSnapshot>;
}

export interface CoachProviderConfig {
  apiKey: string;
  model: string;
}

export interface CoachStreamHandlerDeps {
  /** Reads the incoming player cookie value, if any. */
  readCookie: () => string | undefined;
  /** Resolves (or mints) the player id from the cookie value. */
  resolvePlayerId: (cookieValue: string | undefined) => { playerId: string };
  /** Today's UTC date as `YYYY-MM-DD`. */
  today: () => string;
  /** Whether the minted cookie should be marked `Secure`. */
  secure: boolean;
  /** `null` when the runtime/provider credentials are unavailable (no reservation is made). */
  getProviderConfig: () => CoachProviderConfig | null;
  repo: CoachStreamHandlerRepo;
  startCoachStream: (
    request: CoachRequest,
    playerId: string,
    config: CoachProviderConfig,
  ) => Promise<AsyncIterable<string>>;
}

export type CoachStreamHandlerResult =
  | { kind: "error"; status: number; body: Record<string, unknown>; setCookie?: PlayerCookieOptions }
  | { kind: "stream"; remaining: number | null; setCookie: PlayerCookieOptions; first: string; iterator: AsyncIterator<string> };

const UNAVAILABLE_BODY = { error: "coach unavailable" };

/** Handles one `POST /api/coach/stream` request. */
export async function handleCoachStreamRequest(
  rawBody: string,
  deps: CoachStreamHandlerDeps,
): Promise<CoachStreamHandlerResult> {
  let raw: unknown;
  try {
    raw = JSON.parse(rawBody);
  } catch {
    return { kind: "error", status: 400, body: { error: "invalid JSON body" } };
  }

  const parsed = parseCoachRequest(raw);
  if (!parsed.ok) return { kind: "error", status: 400, body: { error: parsed.reason } };

  const provider = deps.getProviderConfig();
  if (!provider) {
    return { kind: "error", status: 503, body: UNAVAILABLE_BODY };
  }

  const { playerId } = deps.resolvePlayerId(deps.readCookie());
  const today = deps.today();

  let remaining: number | null;
  try {
    await deps.repo.ensurePlayer(playerId);
    const allowed = await deps.repo.reserveCoachCall(playerId, today);
    if (!allowed) {
      return { kind: "error", status: 429, body: { error: "daily coach limit reached", remaining: 0 } };
    }
    try {
      remaining = (await deps.repo.getCoachUsage(playerId, today)).remaining;
    } catch (error) {
      // The reservation already succeeded; a failed read here must not
      // refund the slot or fail the request. Proceed with an unknown
      // remaining count — the route omits the header in that case.
      console.error("Failed to read coach usage after reservation:", error);
      remaining = null;
    }
  } catch (error) {
    console.error("Failed to reserve coach call:", error);
    return { kind: "error", status: 503, body: UNAVAILABLE_BODY };
  }

  const setCookie = playerCookieOptions(playerId, deps.secure);

  // Refunds the slot reserved above when the provider fails before any
  // text is delivered, so the player never loses a question to an
  // outage. A stream interrupted after text was sent still counts.
  const refund = async (): Promise<number | null> => {
    try {
      await deps.repo.releaseCoachCall(playerId, today);
    } catch (error) {
      console.error("Failed to refund coach call:", error);
    }
    try {
      return (await deps.repo.getCoachUsage(playerId, today)).remaining;
    } catch (error) {
      console.error("Failed to read coach usage after refund:", error);
      return remaining;
    }
  };

  try {
    const iterable = await deps.startCoachStream(parsed.value, playerId, provider);
    const iterator = iterable[Symbol.asyncIterator]();
    // Preflight the first text chunk so provider failures return a real 503
    // rather than an empty 200 stream that would overwrite the template.
    const first = await iterator.next();
    if (first.done) {
      const refunded = await refund();
      return { kind: "error", status: 503, body: { error: "coach unavailable", remaining: refunded }, setCookie };
    }
    return { kind: "stream", remaining, setCookie, first: first.value, iterator };
  } catch (error) {
    console.error("Coach provider unavailable:", error);
    const refunded = await refund();
    return { kind: "error", status: 503, body: { error: "coach unavailable", remaining: refunded }, setCookie };
  }
}
