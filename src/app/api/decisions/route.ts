/**
 * POST /api/decisions — thin adapter over the `src/player` domain.
 * Resolves (or mints) the anonymous player cookie, insert-if-missing the
 * `players` row, parses and validates the request body, then re-grades
 * and persists the decision via `recordDecision` (D2: the client's own
 * grading is never trusted). Fire-and-forget on the client (T3): a
 * failure here must never surface as a blocking error to the player.
 */

import { cookies } from "next/headers";

import { getDb } from "@/db/client";
import { createD1DecisionRepository, ensurePlayer } from "@/db/decisionsRepository";
import { parseDecisionPayload } from "@/player/decisionPayload";
import { playerCookieOptions, resolvePlayerId, PLAYER_COOKIE_NAME } from "@/player/playerCookie";
import { recordDecision } from "@/player/recordDecision";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const { playerId } = resolvePlayerId(cookieStore.get(PLAYER_COOKIE_NAME)?.value);

  try {
    const db = getDb();
    await ensurePlayer(db, playerId);

    const options = playerCookieOptions(playerId, process.env.NODE_ENV === "production");
    cookieStore.set(options.name, options.value, options);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "invalid JSON body" }, { status: 400 });
    }

    const parsed = parseDecisionPayload(body);
    if (!parsed.ok) {
      return Response.json({ error: parsed.reason }, { status: 400 });
    }

    const result = await recordDecision(
      { ...parsed.value, playerId },
      createD1DecisionRepository(db),
    );

    if (!result.ok) {
      return Response.json({ error: result.reason }, { status: 400 });
    }

    return Response.json({ id: result.row.id }, { status: 201 });
  } catch (error) {
    console.error("Failed to record decision:", error);
    return Response.json({ error: "failed to record decision" }, { status: 500 });
  }
}
