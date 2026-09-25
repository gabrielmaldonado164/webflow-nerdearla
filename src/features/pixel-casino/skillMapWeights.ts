/**
 * Pure "Practice weakness" toggle logic for the Skill Map panel (Phase
 * 3 T4, tightened by the owner's 2026-09-24 decision, T5). Adaptive
 * weighting applies ONLY while the toggle is explicitly on — the
 * scenario distribution must never change without the player's
 * explicit choice. With the toggle off, this always returns
 * `undefined` (the engine's own default uniform weighting), regardless
 * of what server stats exist or whether the run just ended. With the
 * toggle on and server stats available, it returns
 * `weightsFromStats(stats, { focusWeakness: true })`
 * (`src/training/weights.ts`, Phase 3 T3). With the toggle on but no
 * server stats yet (offline, or a brand-new player — there is nothing
 * to adapt from), it also returns `undefined`, matching the toggle's
 * own disabled state in that case (see `SkillMapPanel.tsx`).
 */

import type { CategoryWeights } from "@/blackjack";
import type { PlayerStats } from "@/player/playerStats";
import { weightsFromStats } from "@/training/weights";

export function computeToggleWeights(
  serverStats: PlayerStats | null,
  focusWeakness: boolean,
): CategoryWeights | undefined {
  if (!focusWeakness) return undefined;
  if (!serverStats) return undefined;
  return weightsFromStats(serverStats, { focusWeakness: true });
}
