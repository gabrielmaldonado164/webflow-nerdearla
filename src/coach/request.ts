import { buildEvidence, type EvidenceResult } from "./evidence";

export type CoachRequest =
  | { mode: "why"; evidence: Extract<EvidenceResult, { ok: true }> }
  | { mode: "chat"; message: string; evidence: Extract<EvidenceResult, { ok: true }> | null };

export type ParseCoachRequestResult =
  | { ok: true; value: CoachRequest }
  | { ok: false; reason: string };

export function parseCoachRequest(raw: unknown): ParseCoachRequestResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, reason: "payload must be a JSON object" };
  }
  const body = raw as Record<string, unknown>;
  if (body.mode === "why") {
    const evidence = buildEvidence(body);
    return evidence.ok
      ? { ok: true, value: { mode: "why", evidence } }
      : { ok: false, reason: evidence.reason };
  }
  if (body.mode === "chat") {
    if (typeof body.message !== "string" || !body.message.trim() || body.message.length > 500) {
      return { ok: false, reason: "message must contain 1-500 characters" };
    }
    const hasHand = ["playerCards", "dealerUpcard", "userAction", "availableActions"]
      .some((key) => key in body);
    const evidence = hasHand ? buildEvidence(body) : null;
    if (evidence && !evidence.ok) return { ok: false, reason: evidence.reason };
    return { ok: true, value: { mode: "chat", message: body.message.trim(), evidence } };
  }
  return { ok: false, reason: "mode must be why or chat" };
}
