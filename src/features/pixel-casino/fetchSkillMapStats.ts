/**
 * Fetches and validates `GET /api/stats` for the Skill Map panel (Phase
 * 3 T4). Resilience over correctness (D7-style): every failure — a
 * rejected fetch, `fetch` throwing synchronously, a non-2xx response,
 * unparsable JSON, or a body that doesn't match the expected shape —
 * resolves to `null` instead of throwing, so the caller can always fall
 * back to in-session stats. Never mutates anything; safe to call
 * repeatedly (e.g. debounced, after each decision, while the panel is
 * open).
 */

import { parseStatsResponse, type StatsResponseBody } from "./skillMapStatsResponse";
import { buildStatsRequestUrl } from "./skillMapStatsRequest";

export async function fetchSkillMapStats(): Promise<StatsResponseBody | null> {
  try {
    const response = await fetch(buildStatsRequestUrl(), { credentials: "same-origin" });
    if (!response.ok) return null;
    const json: unknown = await response.json();
    return parseStatsResponse(json);
  } catch {
    return null;
  }
}
