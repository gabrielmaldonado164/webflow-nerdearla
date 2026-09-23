"use client";

/**
 * A resolved hand's outcome banner. Rendered by the caller inside that
 * hand's own card fan (`.cardFan`, which the caller gives `position:
 * relative`), so `.slot` (`inset: 0`) overlays exactly that hand's cards —
 * never the dealer's cards or a sibling split hand — and the hand's total
 * badge above the cards stays visible.
 */

import { motion, useReducedMotion } from "motion/react";

import type { ResolvedPlayerHand } from "@/blackjack";
import { outcomeCopy } from "./outcomeCopy";
import styles from "./OutcomeBanner.module.css";

export interface OutcomeBannerProps {
  hand: ResolvedPlayerHand;
  /** Whether the player's *decision* (not the outcome) was correct. */
  isCorrectDecision: boolean;
}

export function OutcomeBanner({ hand, isCorrectDecision }: OutcomeBannerProps) {
  const reduceMotion = useReducedMotion();
  const copy = outcomeCopy({ outcome: hand.outcome, isCorrectDecision });

  return (
    <div className={styles.slot} aria-live="polite">
      <motion.div
        className={`${styles.banner} ${styles[hand.outcome]}`}
        initial={reduceMotion ? false : { opacity: 0, scale: 1.35, rotate: -4 }}
        animate={{ opacity: 1, scale: 1, rotate: -2 }}
        transition={{ type: "spring", stiffness: 300, damping: 18 }}
      >
        <strong>{copy.banner}</strong>
        {copy.note && <span>{copy.note}</span>}
      </motion.div>
    </div>
  );
}
