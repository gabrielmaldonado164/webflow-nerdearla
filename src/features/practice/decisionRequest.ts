/**
 * Pure request-shape builder for persisting a decision (Phase 2b T3).
 * Sends only what `recordDecision` (src/player) actually re-grades from
 * — `playerCards`, `dealerUpcard`, `userAction` — never the client's own
 * `availableActions`/`optimalAction`/`isCorrect`/`category`/`label`,
 * which the server never trusts anyway (D2).
 *
 * The URL is prefixed with `NEXT_PUBLIC_BASE_PATH` (never `basePath` /
 * `assetPrefix`, which Webflow Cloud injects at build time) so a plain
 * `fetch` call resolves correctly once mounted under a sub-path.
 */

import type { DecisionRecord } from "./types";

export interface DecisionRequest {
  url: string;
  body: string;
}

export function buildDecisionRequest(record: DecisionRecord): DecisionRequest {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return {
    url: `${basePath}/api/decisions`,
    body: JSON.stringify({
      playerCards: record.playerCards,
      dealerUpcard: record.dealerUpcard,
      userAction: record.userAction,
    }),
  };
}
