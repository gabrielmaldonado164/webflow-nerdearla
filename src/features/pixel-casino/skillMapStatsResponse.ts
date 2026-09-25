/**
 * Pure validation for the parsed JSON body of `GET /api/stats` (Phase 3
 * T4, Skill Map UI). The panel never trusts a fetch response at face
 * value — a network hiccup, a proxy error page, the handler's own
 * generic `{ error }` 500 body, or a future/incompatible API shape must
 * all fall back to in-session stats instead of rendering `undefined`s
 * or throwing mid-render. This is the single gate that decides "trust
 * this" vs. "fall back".
 */

import type { ScenarioCategory } from "@/blackjack";
import type { Achievement } from "@/player/achievements";
import type { PlayerCategoryStats, PlayerStats } from "@/player/playerStats";

import { SKILL_MAP_CATEGORY_ORDER } from "./skillMapViewModel";

export interface StatsResponseBody {
  stats: PlayerStats;
  achievements: Achievement[];
}

function isScenarioCategory(value: unknown): value is ScenarioCategory {
  return value === "hard" || value === "soft" || value === "pair";
}

function isNumberOrNull(value: unknown): value is number | null {
  return value === null || typeof value === "number";
}

function isCategoryStatsEntry(value: unknown): value is PlayerCategoryStats {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return (
    isScenarioCategory(entry.category) &&
    typeof entry.attempts === "number" &&
    typeof entry.correct === "number" &&
    isNumberOrNull(entry.accuracy)
  );
}

function isPlayerStats(value: unknown): value is PlayerStats {
  if (!value || typeof value !== "object") return false;
  const stats = value as Record<string, unknown>;

  if (typeof stats.totalDecisions !== "number") return false;
  if (typeof stats.correctDecisions !== "number") return false;
  if (!isNumberOrNull(stats.accuracy)) return false;
  if (typeof stats.currentStreak !== "number") return false;
  if (typeof stats.bestStreak !== "number") return false;
  if (!(stats.strongestCategory === null || isScenarioCategory(stats.strongestCategory))) return false;
  if (!(stats.weakestCategory === null || isScenarioCategory(stats.weakestCategory))) return false;

  const categoryStats = stats.categoryStats;
  if (!categoryStats || typeof categoryStats !== "object") return false;
  const record = categoryStats as Record<string, unknown>;
  return SKILL_MAP_CATEGORY_ORDER.every((category) => isCategoryStatsEntry(record[category]));
}

function isAchievement(value: unknown): value is Achievement {
  if (!value || typeof value !== "object") return false;
  const achievement = value as Record<string, unknown>;
  return (
    typeof achievement.id === "string" &&
    typeof achievement.title === "string" &&
    typeof achievement.description === "string" &&
    typeof achievement.earned === "boolean" &&
    typeof achievement.progress === "number"
  );
}

/**
 * Validates a parsed `GET /api/stats` JSON body. Returns the typed
 * `{ stats, achievements }` when every field matches the expected
 * shape, otherwise `null`.
 */
export function parseStatsResponse(json: unknown): StatsResponseBody | null {
  if (!json || typeof json !== "object") return null;
  const body = json as Record<string, unknown>;

  if (!isPlayerStats(body.stats)) return null;
  if (!Array.isArray(body.achievements) || !body.achievements.every(isAchievement)) return null;

  return { stats: body.stats, achievements: body.achievements };
}
