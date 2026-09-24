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

export async function streamCoachReply(
  input: { mode: "why" | "chat"; hand?: CoachHand; message?: string },
  signal: AbortSignal,
  onText: (text: string) => void,
): Promise<boolean> {
  try {
    const response = await fetch(coachUrl("stream"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ mode: input.mode, ...input.hand, message: input.message }),
      signal,
    });
    if (!response.ok || !response.body) return false;
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
    return text.trim().length > 0;
  } catch {
    return false;
  }
}
