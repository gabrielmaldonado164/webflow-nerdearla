/**
 * Pure handler for `POST /api/decisions` (Phase 2b T4). Everything the
 * route actually does — reading the raw body, resolving/minting the
 * player id, structural + domain validation, and persistence — lives
 * here, behind injected dependencies (`DecisionHandlerDeps`), so it's
 * unit-testable with fakes instead of a real Next.js `Request`,
 * `cookies()`, or D1 binding. `route.ts` is a thin adapter that wires
 * these deps to the real runtime and turns the result into a `Response`.
 *
 * Never returns `error.message` or a stack for a repository failure
 * (500): only a fixed, generic message. The real error is expected to
 * be logged by the caller for operability.
 */

import { parseDecisionPayload } from "@/player/decisionPayload";
import type { PlayerCookieOptions } from "@/player/playerCookie";
import { playerCookieOptions } from "@/player/playerCookie";
import { isValidPlayerId } from "@/player/playerId";
import type { DecisionRow } from "@/player/recordDecision";
import { recordDecision } from "@/player/recordDecision";

export interface DecisionHandlerRepo {
  ensurePlayer(playerId: string): Promise<void>;
  insertDecision(row: DecisionRow): Promise<void>;
}

export interface DecisionHandlerDeps {
  /** Reads the incoming player cookie value, if any. */
  readCookie: () => string | undefined;
  repo: DecisionHandlerRepo;
  /** Mints a fresh player id when no valid cookie is present. */
  newId: () => string;
  /** Whether the minted cookie should be marked `Secure`. */
  secure: boolean;
}

export interface DecisionHandlerResult {
  status: number;
  body: Record<string, unknown>;
  setCookie?: PlayerCookieOptions;
}

const GENERIC_SERVER_ERROR = "failed to record decision";

/**
 * Handles one `POST /api/decisions` request. `rawBody` is the request
 * body as text (not yet JSON-parsed): parsing happens here so an
 * invalid-JSON body is testable without a real `Request` object.
 *
 * Structural validation (`parseDecisionPayload`) happens before the
 * player cookie is resolved/minted or `ensurePlayer` runs — an
 * invalid body writes nothing and sets no cookie. A structurally valid
 * but game-illegal action (rejected by `recordDecision`) still
 * establishes player identity, since determining legality needs the
 * same engine step that would also produce the `decisions` row.
 */
export async function handleDecisionRequest(
  rawBody: string,
  deps: DecisionHandlerDeps,
): Promise<DecisionHandlerResult> {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: { error: "invalid JSON body" } };
  }

  const parsed = parseDecisionPayload(parsedJson);
  if (!parsed.ok) {
    return { status: 400, body: { error: parsed.reason } };
  }

  const cookieValue = deps.readCookie();
  const playerId = isValidPlayerId(cookieValue) ? cookieValue : deps.newId();

  try {
    await deps.repo.ensurePlayer(playerId);
    const setCookie = playerCookieOptions(playerId, deps.secure);

    const result = await recordDecision(
      { ...parsed.value, playerId },
      { insertDecision: (row) => deps.repo.insertDecision(row) },
    );

    if (!result.ok) {
      return { status: 400, body: { error: result.reason }, setCookie };
    }

    return { status: 201, body: { id: result.row.id }, setCookie };
  } catch (error) {
    console.error("Failed to record decision:", error);
    return { status: 500, body: { error: GENERIC_SERVER_ERROR } };
  }
}
