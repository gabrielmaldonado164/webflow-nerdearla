import type { Action, Card } from "@/blackjack";

export interface CoachHand {
  playerCards: Card[];
  dealerUpcard: Card;
  availableActions: Action[];
  userAction: Action;
}

export interface CoachEvidence {
  optimalAction: Action;
  ev: { action: Action; ev: number; iterations: number }[];
}

function coachUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/coach/${path}`;
}

export async function fetchCoachEvidence(hand: CoachHand, signal: AbortSignal): Promise<CoachEvidence | null> {
  try {
    const response = await fetch(coachUrl("evidence"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(hand),
      signal,
    });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    if (!body || typeof body !== "object") return null;
    const value = body as Partial<CoachEvidence>;
    if (!Array.isArray(value.ev) || !value.ev.every((row) =>
      row && typeof row === "object" &&
      ["hit", "stand", "double", "split"].includes(row.action) &&
      Number.isFinite(row.ev) && Number.isInteger(row.iterations)
    )) return null;
    if (!["hit", "stand", "double", "split"].includes(value.optimalAction ?? "")) return null;
    return value as CoachEvidence;
  } catch {
    return null;
  }
}

export type CoachStreamOutcome =
  | { kind: "ok"; remaining: number | null }
  | { kind: "limit"; remaining: 0 }
  /**
   * `refunded` is true only when the server confirmed it released the
   * reserved slot: a 503 JSON body with a numeric `remaining` (the
   * post-refund read). It is false for a network error, a pre-reservation
   * 503 (no numeric `remaining`, nothing was ever reserved), and an empty
   * 200 stream (the server does not refund a slot for that case).
   */
  | { kind: "unavailable"; remaining: number | null; refunded: boolean };

/** Non-negative integer or `null`; rejects anything else (NaN, floats, negatives, wrong type). */
function parseRemaining(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

async function readRemainingFromBody(response: Response): Promise<number | null> {
  try {
    const body: unknown = await response.json();
    if (!body || typeof body !== "object") return null;
    return parseRemaining((body as { remaining?: unknown }).remaining);
  } catch {
    return null;
  }
}

export async function streamCoachReply(
  input: { mode: "why" | "chat"; hand?: CoachHand; message?: string },
  signal: AbortSignal,
  onText: (text: string) => void,
): Promise<CoachStreamOutcome> {
  try {
    const response = await fetch(coachUrl("stream"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ mode: input.mode, ...input.hand, message: input.message }),
      signal,
    });

    if (response.status === 429) {
      return { kind: "limit", remaining: 0 };
    }
    if (!response.ok || !response.body) {
      const remaining = await readRemainingFromBody(response);
      // Only a 503 with a numeric `remaining` is the server's post-refund
      // read; any other non-2xx (a pre-reservation 503, a 500, etc.) never
      // confirms a refund, even if it happens to carry a numeric body.
      return { kind: "unavailable", remaining, refunded: response.status === 503 && remaining !== null };
    }

    const remaining = parseRemaining(
      (() => {
        const header = response.headers.get("X-Coach-Remaining");
        if (header === null) return null;
        const parsed = Number(header);
        return Number.isInteger(parsed) ? parsed : null;
      })(),
    );

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let text = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      onText(text);
    }
    text += decoder.decode();
    onText(text);

    // A 200 with an empty stream is never a server-confirmed refund.
    if (text.trim().length === 0) return { kind: "unavailable", remaining, refunded: false };
    return { kind: "ok", remaining };
  } catch {
    return { kind: "unavailable", remaining: null, refunded: false };
  }
}

export async function fetchCoachUsage(
  signal: AbortSignal,
): Promise<{ limit: number; used: number; remaining: number } | null> {
  try {
    const response = await fetch(coachUrl("usage"), { credentials: "same-origin", signal });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    if (!body || typeof body !== "object") return null;
    const value = body as Partial<{ limit: unknown; used: unknown; remaining: unknown }>;
    if (
      typeof value.limit !== "number" || !Number.isInteger(value.limit) || value.limit < 0 ||
      typeof value.used !== "number" || !Number.isInteger(value.used) || value.used < 0 ||
      typeof value.remaining !== "number" || !Number.isInteger(value.remaining) || value.remaining < 0
    ) return null;
    return { limit: value.limit, used: value.used, remaining: value.remaining };
  } catch {
    return null;
  }
}
