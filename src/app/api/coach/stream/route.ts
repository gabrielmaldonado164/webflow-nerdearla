/**
 * POST /api/coach/stream — thin adapter wiring the real Next.js runtime
 * (`Request`, `cookies()`, D1, Cloudflare env, the AI provider) to
 * `handleCoachStreamRequest`, which holds all the actual logic and is
 * unit-tested with fakes (Phase 5 T2b). This file only reads the raw
 * body text, reads/writes the real cookie jar, resolves the Cloudflare
 * env, and turns the handler's plain result into a `Response` — JSON for
 * an error, a `text/plain` `ReadableStream` for a successful stream.
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { cookies } from "next/headers";

import { startCoachStream } from "@/coach/stream";
import { getCoachUsage, releaseCoachCall, reserveCoachCall } from "@/coach/rateLimit";
import { getDb } from "@/db/client";
import { ensurePlayer } from "@/db/decisionsRepository";
import { PLAYER_COOKIE_NAME, resolvePlayerId } from "@/player/playerCookie";

import { handleCoachStreamRequest, type CoachProviderConfig } from "./handler";

export const runtime = "nodejs";

interface CoachEnv {
  DB: D1Database;
  COMMAND_CODE_API_KEY?: string;
  COMMAND_CODE_MODEL?: string;
}

/** Resolves the Cloudflare env once per request; `null` means unavailable. */
function resolveEnv(): CoachEnv | null {
  try {
    return getCloudflareContext().env as CoachEnv;
  } catch (error) {
    // `next dev` has no D1 context unless explicitly initialized. The
    // coach must degrade to the built-in explanation, not an HTML 500.
    console.error("Coach runtime unavailable:", error);
    return null;
  }
}

export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();
  const cookieStore = await cookies();
  const env = resolveEnv();

  const getProviderConfig = (): CoachProviderConfig | null => {
    if (!env?.COMMAND_CODE_API_KEY || !env.COMMAND_CODE_MODEL) return null;
    return { apiKey: env.COMMAND_CODE_API_KEY, model: env.COMMAND_CODE_MODEL };
  };

  const result = await handleCoachStreamRequest(rawBody, {
    readCookie: () => cookieStore.get(PLAYER_COOKIE_NAME)?.value,
    resolvePlayerId,
    today: () => new Date().toISOString().slice(0, 10),
    secure: process.env.NODE_ENV === "production",
    getProviderConfig,
    repo: {
      ensurePlayer: (playerId) => ensurePlayer(getDb(), playerId),
      reserveCoachCall: (playerId, date) => reserveCoachCall(env!.DB, playerId, date),
      releaseCoachCall: (playerId, date) => releaseCoachCall(env!.DB, playerId, date),
      getCoachUsage: (playerId, date) => getCoachUsage(env!.DB, playerId, date),
    },
    startCoachStream,
  });

  if (result.setCookie) {
    const { name, value, ...options } = result.setCookie;
    cookieStore.set(name, value, options);
  }

  if (result.kind === "error") {
    return Response.json(result.body, { status: result.status });
  }

  const encoder = new TextEncoder();
  const iterator = result.iterator;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(result.first));
      try {
        for (;;) {
          const next = await iterator.next();
          if (next.done) break;
          controller.enqueue(encoder.encode(next.value));
        }
      } catch (error) {
        console.error("Coach stream interrupted:", error);
      } finally {
        controller.close();
      }
    },
    cancel() { void iterator.return?.(); },
  });

  const headers: Record<string, string> = {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  };
  if (result.remaining !== null) headers["X-Coach-Remaining"] = String(result.remaining);

  return new Response(stream, { headers });
}
