/**
 * POST /api/decisions — thin adapter wiring the real Next.js runtime
 * (`Request`, `cookies()`, D1) to `handleDecisionRequest`, which holds
 * all the actual logic and is unit-tested with fakes (Phase 2b T4).
 * This file only reads the raw body text, reads/writes the real cookie
 * jar, and turns the handler's plain result into a `Response`.
 */

import { cookies } from "next/headers";

import { getDb } from "@/db/client";
import { createD1DecisionRepository, ensurePlayer } from "@/db/decisionsRepository";
import { PLAYER_COOKIE_NAME } from "@/player/playerCookie";
import { generatePlayerId } from "@/player/playerId";

import { handleDecisionRequest } from "./handler";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const cookieStore = await cookies();

  const result = await handleDecisionRequest(rawBody, {
    readCookie: () => cookieStore.get(PLAYER_COOKIE_NAME)?.value,
    newId: generatePlayerId,
    secure: process.env.NODE_ENV === "production",
    repo: {
      ensurePlayer: (playerId) => ensurePlayer(getDb(), playerId),
      insertDecision: (row) => createD1DecisionRepository(getDb()).insertDecision(row),
    },
  });

  if (result.setCookie) {
    const { name, value, ...options } = result.setCookie;
    cookieStore.set(name, value, options);
  }

  return Response.json(result.body, { status: result.status });
}
