"use client";

/**
 * The pixel-art croupier coach: renders one `CROUPIER_FRAMES` pose as an
 * `<svg>` of merged-run `<rect>`s (see `frameToRects`). Purely decorative
 * (`aria-hidden`); the speech bubble text carrying the actual message
 * lives in the caller.
 *
 * `pose="idle"` blinks every few seconds by swapping between the
 * `idleOpen`/`idleBlink` frames on a timer, and bobs via a CSS animation
 * on the wrapper. Both respect `prefers-reduced-motion`: the blink timer
 * doesn't start and the bob animation is disabled globally by the
 * screen's `@media (prefers-reduced-motion: reduce)` rule.
 */

import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";

import { CROUPIER_FRAMES, frameToRects, PALETTE, SPRITE_HEIGHT, SPRITE_WIDTH } from "./croupierSprite";
import styles from "./CroupierCoach.module.css";

export type CroupierDisplayPose = "idle" | "celebrate" | "teach" | "gameOver";

export interface CroupierCoachProps {
  pose: CroupierDisplayPose;
  className?: string;
}

/** How often the idle pose blinks, in milliseconds. */
const BLINK_INTERVAL_MS = 3400;
/** How long a blink stays closed before reopening, in milliseconds. */
const BLINK_DURATION_MS = 160;

export function CroupierCoach({ pose, className }: CroupierCoachProps) {
  const reduceMotion = useReducedMotion();
  const [blinking, setBlinking] = useState(false);

  useEffect(() => {
    if (pose !== "idle" || reduceMotion) return;
    const interval = window.setInterval(() => {
      setBlinking(true);
      window.setTimeout(() => setBlinking(false), BLINK_DURATION_MS);
    }, BLINK_INTERVAL_MS);
    return () => {
      window.clearInterval(interval);
      setBlinking(false);
    };
  }, [pose, reduceMotion]);

  const frameKey = pose === "idle" && !reduceMotion ? (blinking ? "idleBlink" : "idleOpen") : pose === "idle" ? "idleOpen" : pose;
  const rows = CROUPIER_FRAMES[frameKey];
  const rects = frameToRects(rows, PALETTE);

  return (
    <svg
      className={`${styles.sprite} ${pose === "idle" && !reduceMotion ? styles.bob : ""} ${className ?? ""}`}
      viewBox={`0 0 ${SPRITE_WIDTH} ${SPRITE_HEIGHT}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {rects.map((rect, index) => (
        <rect key={index} x={rect.x} y={rect.y} width={rect.width} height={1} fill={rect.color} />
      ))}
    </svg>
  );
}
