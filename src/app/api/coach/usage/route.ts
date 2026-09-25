/**
 * GET /api/coach/usage — thin adapter wiring the real Next.js runtime
 * (`cookies()`, D1) to `handleCoachUsageRequest`, which holds all the
 * actual logic and is unit-tested with fakes (Phase 5 T1). This file
 * only reads the real cookie jar and turns the handler's plain result
 * into a `Response`. Never sets a cookie.
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { cookies } from "next/headers";

import { getCoachUsage } from "@/coach/rateLimit";
import { PLAYER_COOKIE_NAME } from "@/player/playerCookie";

import { handleCoachUsageRequest } from "./handler";

export const runtime = "nodejs";

export async function GET() {
  const cookieStore = await cookies();

  const result = await handleCoachUsageRequest({
    readCookie: () => cookieStore.get(PLAYER_COOKIE_NAME)?.value,
    today: () => new Date().toISOString().slice(0, 10),
    repo: {
      getCoachUsage: async (playerId, date) => {
        const { DB } = getCloudflareContext().env as { DB: D1Database };
        return getCoachUsage(DB, playerId, date);
      },
    },
  });

  return Response.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "no-store" },
  });
}
