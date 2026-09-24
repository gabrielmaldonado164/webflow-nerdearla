/**
 * Pure "Practice weakness" toggle logic for the Skill Map panel (Phase
 * 3 T4). Bridges the panel's boolean toggle state to `weightsFromStats`
 * (`src/training/weights.ts`, Phase 3 T3): off still biases scenario
 * generation adaptively (every category weighted by its own error
 * rate), just without the extra push toward the single weakest one; on
 * adds that push. With no server stats at all (offline, or a brand-new
 * player), there is nothing to adapt from, so this returns `undefined`
 * regardless of the toggle — the engine's own default uniform
 * weighting — rather than biasing off of stale or fabricated data.
 */

import type { CategoryWeights } from "@/blackjack";
import type { PlayerStats } from "@/player/playerStats";
import { weightsFromStats } from "@/training/weights";

export function computeToggleWeights(
  serverStats: PlayerStats | null,
  focusWeakness: boolean,
): CategoryWeights | undefined {
  if (!serverStats) return undefined;
  return weightsFromStats(serverStats, { focusWeakness });
}
