/**
 * POST /api/decisions — thin adapter over the `src/player` domain.
 * Parses and structurally validates the request body FIRST, before doing
 * anything else: an invalid body (malformed JSON, unknown card/action
 * values, a hand that's already bust/at 21, or an oversized hand) returns
 * `400` with zero DB writes — no player cookie is minted, no `players`
 * row is inserted. Only once the payload passes structural validation
 * does the route resolve/mint the anonymous player cookie, insert-if-
 * missing the `players` row, and re-grade + persist via `recordDecision`
 * (D2: the client's own grading is never trusted). Fire-and-forget on the
 * client (T3): a failure here must never surface as a blocking error to
 * the player.
 */

import { cookies } from "next/headers";

import { getDb } from "@/db/client";
import { createD1DecisionRepository, ensurePlayer } from "@/db/decisionsRepository";
import { parseDecisionPayload } from "@/player/decisionPayload";
import { playerCookieOptions, resolvePlayerId, PLAYER_COOKIE_NAME } from "@/player/playerCookie";
import { recordDecision } from "@/player/recordDecision";

export const runtime = "nodejs";

export async function POST(request: Request) {
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

  const cookieStore = await cookies();
  const { playerId } = resolvePlayerId(cookieStore.get(PLAYER_COOKIE_NAME)?.value);

  try {
    const db = getDb();
    await ensurePlayer(db, playerId);

    const options = playerCookieOptions(playerId, process.env.NODE_ENV === "production");
    cookieStore.set(options.name, options.value, options);

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
