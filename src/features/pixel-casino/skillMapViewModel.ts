/**
 * Pure view-model builder for the Skill Map panel (Phase 3 T4): unifies
 * the two possible data sources — the persisted cross-session
 * `PlayerStats`/`Achievement[]` from `GET /api/stats`, or the ephemeral
 * in-browser `SessionStats` fallback (`sessionStats.ts`) used when the
 * API call fails — into one shape the panel and the game-over summary
 * both render from, so neither has to branch on which source it got.
 *
 * `SessionStats` has no `strongestCategory` (only `weakestCategory`,
 * `sessionStats.ts`'s own deliberately narrower scope) and no
 * achievements (achievements need the full persisted `DecisionRow`
 * history, not the session's `DecisionRecord`s), so the offline view
 * model reports `strongestCategory: null` and `achievements: null`
 * rather than inventing values the fallback data can't support.
 */

import type { ScenarioCategory } from "@/blackjack";
import type { SessionStats } from "@/features/practice/sessionStats";
import type { Achievement } from "@/player/achievements";

import type { StatsResponseBody } from "./skillMapStatsResponse";

const CATEGORY_ORDER: readonly ScenarioCategory[] = ["hard", "soft", "pair"];

/**
 * Single source of truth for the display label of each scenario
 * category (T5 review follow-up on T4: previously duplicated in
 * `PixelCasinoScreen.tsx`, `SkillMapPanel.tsx`, and
 * `skillMapSummary.ts`).
 */
export const CATEGORY_LABEL: Record<ScenarioCategory, string> = {
  hard: "Hard hands",
  soft: "Soft hands",
  pair: "Pairs",
};

export interface SkillMapCategoryRow {
  category: ScenarioCategory;
  attempts: number;
  /** Percentage 0-100, or `null` when there are no attempts yet. */
  accuracy: number | null;
}

export interface SkillMapViewModel {
  /** Whether this view model reflects the persisted server stats or the offline session fallback. */
  source: "server" | "offline";
  totalAttempts: number;
  /** Percentage 0-100, or `null` when there are no attempts yet. */
  overallAccuracy: number | null;
  currentStreak: number;
  bestStreak: number;
  categories: SkillMapCategoryRow[];
  strongestCategory: ScenarioCategory | null;
  weakestCategory: ScenarioCategory | null;
  /** `null` when offline: the session fallback has no achievement data. */
  achievements: Achievement[] | null;
}

export interface BuildSkillMapViewModelInput {
  server: StatsResponseBody | null;
  session: SessionStats;
}

export function buildSkillMapViewModel({ server, session }: BuildSkillMapViewModelInput): SkillMapViewModel {
  if (server) {
    const { stats, achievements } = server;
    return {
      source: "server",
      totalAttempts: stats.totalDecisions,
      overallAccuracy: stats.accuracy,
      currentStreak: stats.currentStreak,
      bestStreak: stats.bestStreak,
      categories: CATEGORY_ORDER.map((category) => ({
        category,
        attempts: stats.categoryStats[category].attempts,
        accuracy: stats.categoryStats[category].accuracy,
      })),
      strongestCategory: stats.strongestCategory,
      weakestCategory: stats.weakestCategory,
      achievements,
    };
  }

  return {
    source: "offline",
    totalAttempts: session.handsPlayed,
    overallAccuracy: session.accuracy,
    currentStreak: session.currentStreak,
    bestStreak: session.bestStreak,
    categories: CATEGORY_ORDER.map((category) => ({
      category,
      attempts: session.categoryStats[category].attempts,
      accuracy: session.categoryStats[category].accuracy,
    })),
    strongestCategory: null,
    weakestCategory: session.weakestCategory,
    achievements: null,
  };
}

export const SKILL_MAP_CATEGORY_ORDER = CATEGORY_ORDER;
