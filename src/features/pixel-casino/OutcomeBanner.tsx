"use client";

/** Per-hand outcome banner(s), shown once a resolved hand's reveal sequence finishes. */

import { motion, useReducedMotion } from "motion/react";

import type { ResolvedPlayerHand } from "@/blackjack";
import { outcomeCopy } from "./outcomeCopy";
import styles from "./OutcomeBanner.module.css";

export interface OutcomeBannerProps {
  hands: readonly ResolvedPlayerHand[];
  /** Whether the player's *decision* (not the outcome) was correct. */
  isCorrectDecision: boolean;
}

export function OutcomeBanner({ hands, isCorrectDecision }: OutcomeBannerProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div className={styles.row} aria-live="polite">
      {hands.map((hand, index) => {
        const copy = outcomeCopy({ outcome: hand.outcome, isCorrectDecision });
        return (
          <motion.div
            key={index}
            className={`${styles.banner} ${styles[hand.outcome]}`}
            initial={reduceMotion ? false : { opacity: 0, scale: 1.35, rotate: -4 }}
            animate={{ opacity: 1, scale: 1, rotate: -2 }}
            transition={{ type: "spring", stiffness: 300, damping: 18 }}
          >
            <strong>{copy.banner}</strong>
            {copy.note && <span>{copy.note}</span>}
          </motion.div>
        );
      })}
    </div>
  );
}
