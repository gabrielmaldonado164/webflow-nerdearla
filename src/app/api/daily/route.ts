import { cookies } from "next/headers";

import { getDb } from "@/db/client";
import { ensureDailyPlayer, getDailyResult, getOrCreateDailyChallenge, saveDailyResult } from "@/db/dailyRepository";
import { PLAYER_COOKIE_NAME } from "@/player/playerCookie";
import { generatePlayerId } from "@/player/playerId";

import { handleGetDaily, type DailyHandlerDeps } from "./handler";

export const runtime = "nodejs";

export async function GET() {
  const cookieStore = await cookies();
  const deps: DailyHandlerDeps = {
    readCookie: () => cookieStore.get(PLAYER_COOKIE_NAME)?.value,
    newId: generatePlayerId,
    now: () => new Date(),
    secure: process.env.NODE_ENV === "production",
    repo: {
      getOrCreateChallenge: (date) => getOrCreateDailyChallenge(getDb(), date),
      getResult: (playerId, date) => getDailyResult(getDb(), playerId, date),
      ensurePlayer: (playerId) => ensureDailyPlayer(getDb(), playerId),
      saveResult: (playerId, result) => saveDailyResult(getDb(), playerId, result),
    },
  };
  const result = await handleGetDaily(deps);
  return Response.json(result.body, { status: result.status });
}
