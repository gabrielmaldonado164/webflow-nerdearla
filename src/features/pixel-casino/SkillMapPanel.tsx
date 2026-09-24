"use client";

/**
 * Pixel-art Skill Map overlay panel (Phase 3 T4), opened from the HUD's
 * "Skill Map" button (see `Hud.tsx`). Renders per-category bars,
 * overall accuracy, streaks, a strongest/weakest callout, a badge grid,
 * and the "Practice weakness" toggle, all from the same
 * `SkillMapViewModel` the game-over summary is built from — server
 * stats when available, the in-session fallback otherwise (see
 * `skillMapViewModel.ts`).
 *
 * Accessibility: `role="dialog"`/`aria-modal`, Esc and a close button
 * both close it, focus moves into the panel on open and returns to
 * whatever was focused before (the HUD button, in practice) on close.
 * `PixelCasinoScreen`'s own keyboard handler is responsible for not
 * firing the table's H/S/D/P/Enter shortcuts while this is open.
 */

import { CheckCircle, ChartBar, CloudSlash, Lock, X } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

import type { ScenarioCategory } from "@/blackjack";
import type { Achievement } from "@/player/achievements";

import type { SkillMapViewModel } from "./skillMapViewModel";
import styles from "./SkillMapPanel.module.css";

const CATEGORY_LABEL: Record<ScenarioCategory, string> = {
  hard: "Hard hands",
  soft: "Soft hands",
  pair: "Pairs",
};

export interface SkillMapPanelProps {
  open: boolean;
  onClose: () => void;
  viewModel: SkillMapViewModel;
  focusWeakness: boolean;
  onToggleFocusWeakness: () => void;
}

function AccuracyBar({ accuracy }: { accuracy: number | null }) {
  return (
    <div className={styles.track}>
      <i style={{ width: `${accuracy ?? 0}%` }} />
    </div>
  );
}

function BadgeCard({ achievement }: { achievement: Achievement }) {
  return (
    <li className={`${styles.badge} ${achievement.earned ? styles.badgeEarned : styles.badgeLocked}`}>
      <div className={styles.badgeIcon}>
        {achievement.earned ? <CheckCircle weight="fill" aria-hidden="true" /> : <Lock weight="fill" aria-hidden="true" />}
      </div>
      <div className={styles.badgeText}>
        <strong>{achievement.title}</strong>
        <span>{achievement.description}</span>
        {!achievement.earned && (
          <div className={styles.badgeProgressTrack} aria-hidden="true">
            <i style={{ width: `${achievement.progress}%` }} />
          </div>
        )}
      </div>
    </li>
  );
}

export function SkillMapPanel({ open, onClose, viewModel, focusWeakness, onToggleFocusWeakness }: SkillMapPanelProps) {
  const reduceMotion = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Moves focus into the panel on open, and returns it to whatever was
  // focused right before opening (the HUD button, in practice) on
  // close/unmount.
  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus();
    return () => {
      previouslyFocusedRef.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={styles.overlay}
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0 }}
        >
          <motion.div
            className={styles.panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="skill-map-heading"
            tabIndex={-1}
            ref={panelRef}
            initial={reduceMotion ? false : { scale: 0.92, y: 16, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={reduceMotion ? undefined : { scale: 0.94, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
          >
            <div className={styles.header}>
              <div className={styles.headerTitle}>
                <ChartBar weight="fill" aria-hidden="true" />
                <h2 id="skill-map-heading">SKILL MAP</h2>
              </div>
              <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close Skill Map">
                <X weight="bold" aria-hidden="true" />
              </button>
            </div>

            {viewModel.source === "offline" && (
              <p className={styles.offlineNote}>
                <CloudSlash weight="fill" aria-hidden="true" /> Showing this session&apos;s progress — server stats are unavailable right now.
              </p>
            )}

            <div className={styles.summaryRow}>
              <div><small>ACCURACY</small><strong>{viewModel.overallAccuracy === null ? "--" : `${viewModel.overallAccuracy}%`}</strong></div>
              <div><small>CURRENT STREAK</small><strong>{viewModel.currentStreak}</strong></div>
              <div><small>BEST STREAK</small><strong>{viewModel.bestStreak}</strong></div>
            </div>

            <section aria-label="Per-category performance">
              <h3 className={styles.sectionHeading}>Categories</h3>
              {(["hard", "soft", "pair"] as ScenarioCategory[]).map((category) => {
                const row = viewModel.categories.find((c) => c.category === category);
                return (
                  <div className={styles.categoryRow} key={category}>
                    <span>{CATEGORY_LABEL[category]}</span>
                    <AccuracyBar accuracy={row?.accuracy ?? null} />
                    <b>{row?.accuracy === null || row?.accuracy === undefined ? "--" : `${row.accuracy}%`}</b>
                    <small>{row?.attempts ?? 0} attempts</small>
                  </div>
                );
              })}
            </section>

            {(viewModel.strongestCategory || viewModel.weakestCategory) && (
              <div className={styles.callouts}>
                {viewModel.strongestCategory && (
                  <p className={styles.calloutStrong}>Strongest: {CATEGORY_LABEL[viewModel.strongestCategory]}</p>
                )}
                {viewModel.weakestCategory && (
                  <p className={styles.calloutWeak}>Weakest: {CATEGORY_LABEL[viewModel.weakestCategory]}</p>
                )}
              </div>
            )}

            <div className={styles.toggleRow}>
              <div>
                <strong>Practice weakness</strong>
                <span>Deal more hands from your weakest category.</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={focusWeakness}
                aria-label="Toggle practice weakness"
                className={styles.toggle}
                onClick={onToggleFocusWeakness}
                disabled={viewModel.source === "offline"}
              >
                <span className={`${styles.toggleTrack} ${focusWeakness ? styles.toggleOn : ""}`}>
                  <i />
                </span>
              </button>
            </div>
            {viewModel.source === "offline" && (
              <small className={styles.toggleUnavailable}>Available once your stats are synced.</small>
            )}

            <section aria-label="Badges">
              <h3 className={styles.sectionHeading}>Badges</h3>
              {viewModel.achievements === null ? (
                <p className={styles.badgesUnavailable}>Badges unavailable offline.</p>
              ) : (
                <ul className={styles.badgeGrid}>
                  {viewModel.achievements.map((achievement) => (
                    <BadgeCard key={achievement.id} achievement={achievement} />
                  ))}
                </ul>
              )}
            </section>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
