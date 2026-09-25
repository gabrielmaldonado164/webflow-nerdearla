"use client";

/** Full-screen overlay shown once a run's lives run out: final score, best score, accuracy, restart. */

import { ArrowClockwise, Trophy } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";

import styles from "./GameOverOverlay.module.css";

export interface GameOverOverlayProps {
  score: number;
  bestScore: number;
  isNewBest: boolean;
  /** This run's accuracy (0-100), or `null` if no decision was made. */
  accuracy: number | null;
  onRestart: () => void;
  /**
   * Short Skill Map summary line (Phase 3 T4, `skillMapSummary.ts`):
   * weakest category + accuracy, an earned-badge count, or an
   * encouraging generic line when there isn't enough data yet.
   * `summarizeForGameOver` always returns a non-empty string — it
   * never returns `null` — so this is never absent. What it says can
   * still change between renders: it may start from the in-session
   * fallback and switch to server-backed text once `/api/stats`
   * resolves (T5 review follow-up on T4: the doc previously claimed
   * `null` "while unloaded", which never actually happened).
   */
  summary: string;
  onWhy?: () => void;
}

export function GameOverOverlay({ score, bestScore, isNewBest, accuracy, onRestart, summary, onWhy }: GameOverOverlayProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={styles.overlay}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="pixel-casino-game-over-heading"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div
        className={styles.card}
        initial={reduceMotion ? false : { scale: 0.85, y: 18, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
      >
        <h2 id="pixel-casino-game-over-heading" className={styles.heading}>GAME OVER</h2>
        {isNewBest && (
          <p className={styles.newBest}>
            <Trophy weight="fill" aria-hidden="true" /> NEW BEST!
          </p>
        )}
        <div className={styles.stats}>
          <div><small>SCORE</small><strong>{score}</strong></div>
          <div><small>BEST</small><strong>{bestScore}</strong></div>
          <div><small>ACCURACY</small><strong>{accuracy === null ? "--" : `${accuracy}%`}</strong></div>
        </div>
        {summary && <p className={styles.skillSummary}>{summary}</p>}
        {onWhy && <button type="button" className={styles.whyButton} onClick={onWhy}>WHY DID I MISS?</button>}
        <button type="button" className={styles.restartButton} onClick={onRestart}>
          <ArrowClockwise weight="bold" aria-hidden="true" /> RESTART <kbd>ENTER</kbd>
        </button>
      </motion.div>
    </motion.div>
  );
}
