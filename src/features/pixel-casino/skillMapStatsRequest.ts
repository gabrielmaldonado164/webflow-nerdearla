/**
 * Pure request-URL builder for `GET /api/stats` (Phase 3 T4). Mirrors
 * `src/features/practice/decisionRequest.ts`: prefixed with
 * `NEXT_PUBLIC_BASE_PATH` (never `basePath`/`assetPrefix`, which
 * Webflow Cloud injects at build time) so a plain `fetch` call resolves
 * correctly once mounted under a sub-path.
 */

export function buildStatsRequestUrl(): string {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return `${basePath}/api/stats`;
}
