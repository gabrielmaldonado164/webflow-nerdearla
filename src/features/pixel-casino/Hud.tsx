"use client";

/** HUD strip for run mode: lives, score, combo multiplier, best score, mute toggle. */

import { Heart, Medal, SpeakerHigh, SpeakerSlash } from "@phosphor-icons/react";
import { motion } from "motion/react";

import { STARTING_LIVES, type RunState } from "@/training/run";
import styles from "./Hud.module.css";

export interface HudProps {
  run: RunState;
  muted: boolean;
  onToggleMuted: () => void;
  /** Changes whenever the multiplier just rose, so the badge re-plays its pop-in. */
  comboPulseToken: number;
  reduceMotion: boolean;
}

export function Hud({ run, muted, onToggleMuted, comboPulseToken, reduceMotion }: HudProps) {
  return (
    <div className={styles.hud} aria-label="Run status">
      <div className={styles.lives} role="img" aria-label={`${run.lives} of ${STARTING_LIVES} lives left`}>
        {Array.from({ length: STARTING_LIVES }, (_, index) => (
          <Heart
            key={index}
            weight={index < run.lives ? "fill" : "regular"}
            className={index < run.lives ? styles.lifeFull : styles.lifeLost}
            aria-hidden="true"
          />
        ))}
      </div>

      <div className={styles.score}>
        <small>SCORE</small>
        <strong>{run.score}</strong>
      </div>

      {run.multiplier > 1 && (
        <motion.span
          key={comboPulseToken}
          className={styles.comboBadge}
          initial={reduceMotion ? false : { scale: 1.7, opacity: 0.4 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 420, damping: 15 }}
          aria-label={`Combo multiplier x${run.multiplier}`}
        >
          x{run.multiplier}
        </motion.span>
      )}

      <div className={styles.bestScore}>
        <Medal weight="fill" aria-hidden="true" />
        <div><small>BEST</small><strong>{run.bestScore}</strong></div>
      </div>

      <button
        type="button"
        className={styles.muteButton}
        onClick={onToggleMuted}
        aria-pressed={muted}
        aria-label={muted ? "Unmute sound" : "Mute sound"}
      >
        {muted ? <SpeakerSlash weight="fill" aria-hidden="true" /> : <SpeakerHigh weight="fill" aria-hidden="true" />}
      </button>
    </div>
  );
}
