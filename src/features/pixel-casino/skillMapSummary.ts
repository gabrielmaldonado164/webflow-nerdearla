/**
 * Pure short-summary line for the game-over overlay (Phase 3 T4),
 * built from the same `SkillMapViewModel` the panel renders — so the
 * summary always reflects whatever data the panel would show, server
 * or offline fallback alike, and never diverges from it.
 *
 * Priority: a named weakest category (the most actionable thing a
 * player can do next) beats a badge count, which beats a generic
 * encouragement when there's simply not enough data yet.
 */

import { CATEGORY_LABEL, type SkillMapViewModel } from "./skillMapViewModel";

export function summarizeForGameOver(vm: SkillMapViewModel): string {
  if (vm.weakestCategory) {
    const row = vm.categories.find((c) => c.category === vm.weakestCategory);
    const accuracyLabel = row?.accuracy === null || row?.accuracy === undefined ? "--" : `${row.accuracy}%`;
    return `Weakest spot: ${CATEGORY_LABEL[vm.weakestCategory]} (${accuracyLabel}) — keep practicing!`;
  }

  const earnedCount = vm.achievements?.filter((a) => a.earned).length ?? 0;
  if (earnedCount > 0) {
    return `${earnedCount} badge${earnedCount === 1 ? "" : "s"} earned so far. Keep it up!`;
  }

  return "Play more hands to reveal your skill map.";
}
