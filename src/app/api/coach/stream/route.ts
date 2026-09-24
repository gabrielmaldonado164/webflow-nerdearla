import { getCloudflareContext } from "@opennextjs/cloudflare";
import { cookies } from "next/headers";

import { parseCoachRequest } from "@/coach/request";
import { startCoachStream } from "@/coach/stream";
import { getCoachUsage, releaseCoachCall, reserveCoachCall } from "@/coach/rateLimit";
import { getDb } from "@/db/client";
import { ensurePlayer } from "@/db/decisionsRepository";
import { PLAYER_COOKIE_NAME, playerCookieOptions, resolvePlayerId } from "@/player/playerCookie";

export const runtime = "nodejs";

interface CoachEnv {
  DB: D1Database;
  COMMAND_CODE_API_KEY?: string;
  COMMAND_CODE_MODEL?: string;
}

export async function POST(request: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const parsed = parseCoachRequest(raw);
  if (!parsed.ok) return Response.json({ error: parsed.reason }, { status: 400 });

  let env: CoachEnv;
  try {
    env = getCloudflareContext().env as CoachEnv;
  } catch (error) {
    // `next dev` has no D1 context unless explicitly initialized. The
    // coach must degrade to the built-in explanation, not an HTML 500.
    console.error("Coach runtime unavailable:", error);
    return Response.json({ error: "coach unavailable" }, { status: 503 });
  }
  const apiKey = env.COMMAND_CODE_API_KEY;
  const model = env.COMMAND_CODE_MODEL;
  if (!apiKey || !model) {
    return Response.json({ error: "coach unavailable" }, { status: 503 });
  }

  const cookieStore = await cookies();
  const { playerId } = resolvePlayerId(cookieStore.get(PLAYER_COOKIE_NAME)?.value);
  const today = new Date().toISOString().slice(0, 10);
  let remaining: number;
  try {
    await ensurePlayer(getDb(), playerId);
    const allowed = await reserveCoachCall(env.DB, playerId, today);
    if (!allowed) return Response.json({ error: "daily coach limit reached", remaining: 0 }, { status: 429 });
    remaining = (await getCoachUsage(env.DB, playerId, today)).remaining;
  } catch (error) {
    console.error("Failed to reserve coach call:", error);
    return Response.json({ error: "coach unavailable" }, { status: 503 });
  }

  const cookie = playerCookieOptions(playerId, process.env.NODE_ENV === "production");
  const { name, value, ...options } = cookie;
  cookieStore.set(name, value, options);

  // Refunds the slot reserved above when the provider fails before any
  // text is delivered, so the player never loses a question to an
  // outage. A stream interrupted after text was sent still counts.
  const refund = async (): Promise<number> => {
    try {
      await releaseCoachCall(env.DB, playerId, today);
    } catch (error) {
      console.error("Failed to refund coach call:", error);
    }
    try {
      return (await getCoachUsage(env.DB, playerId, today)).remaining;
    } catch (error) {
      console.error("Failed to read coach usage after refund:", error);
      return remaining;
    }
  };

  try {
    const iterable = await startCoachStream(parsed.value, playerId, { apiKey, model });
    const iterator = iterable[Symbol.asyncIterator]();
    // Preflight the first text chunk so provider failures return a real 503
    // rather than an empty 200 stream that would overwrite the template.
    const first = await iterator.next();
    if (first.done) {
      const refunded = await refund();
      return Response.json({ error: "coach unavailable", remaining: refunded }, { status: 503 });
    }
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(encoder.encode(first.value));
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
    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Coach-Remaining": String(remaining),
      },
    });
  } catch (error) {
    console.error("Coach provider unavailable:", error);
    const refunded = await refund();
    return Response.json({ error: "coach unavailable", remaining: refunded }, { status: 503 });
  }
}
