/**
 * GET /api/stats — thin adapter wiring the real Next.js runtime
 * (`cookies()`, D1) to `handleStatsRequest`, which holds all the actual
 * logic and is unit-tested with fakes (Phase 3 T1). This file only
 * reads the real cookie jar and turns the handler's plain result into a
 * `Response`. Never sets a cookie.
 */

import { cookies } from "next/headers";

import { getDb } from "@/db/client";
import { listPlayerDecisions } from "@/db/decisionsRepository";
import { PLAYER_COOKIE_NAME } from "@/player/playerCookie";

import { handleStatsRequest } from "./handler";

export const runtime = "nodejs";

export async function GET() {
  const cookieStore = await cookies();

  const result = await handleStatsRequest({
    readCookie: () => cookieStore.get(PLAYER_COOKIE_NAME)?.value,
    repo: {
      listPlayerDecisions: (playerId) => listPlayerDecisions(getDb(), playerId),
    },
  });

  return Response.json(result.body, { status: result.status });
}
