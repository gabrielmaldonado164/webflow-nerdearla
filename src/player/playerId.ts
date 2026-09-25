/**
 * Anonymous player identity (D4): a UUID minted client-side-free, carried
 * in a long-lived cookie (wired in Phase 2b T2). Pure validation +
 * generation only — no cookie or HTTP concerns here.
 */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when `value` is a syntactically valid UUID string. */
export function isValidPlayerId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/** Mints a fresh anonymous player id. */
export function generatePlayerId(): string {
  return crypto.randomUUID();
}
