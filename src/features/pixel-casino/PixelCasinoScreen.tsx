"use client";

import { ArrowRight, BookOpen, Lightning, Sparkle, Spade, Target, Trophy } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Action, Card, ScenarioCategory, Suit } from "@/blackjack";
import { handValue, rankValue } from "@/blackjack";
import { sendDecision } from "@/features/practice/sendDecision";
import type { DecisionRecord } from "@/features/practice/types";
import { usePracticeSession } from "@/features/practice/usePracticeSession";
import { CoachPanel } from "./CoachPanel";
import { DailyChallengePanel } from "./DailyChallengePanel";
import type { CoachHand } from "./coachRequest";
import { GameOverOverlay } from "./GameOverOverlay";
import { handTotalLabel } from "./handTotalLabel";
import { currentHandNumber } from "./handNumber";
import { Hud } from "./Hud";
import { keyToCommand } from "./keyboard";
import { OutcomeBanner } from "./OutcomeBanner";
import { loadBestScore, saveBestScore } from "./preferences";
import { CORRECT_DECISION_XP, INCORRECT_DECISION_XP } from "./progress";
import { planImmediateCue, planTimedReveal } from "./revealPlan";
import {
  DEFAULT_REVEAL_TIMING,
  INSTANT_REVEAL_TIMING,
  revealedDealerCards,
  revealedHandCards,
} from "./revealSchedule";
import { computeRunAccuracy, isNewBestScore } from "./runSummary";
import { SkillMapPanel } from "./SkillMapPanel";
import { computeToggleWeights } from "./skillMapWeights";
import { summarizeForGameOver } from "./skillMapSummary";
import { buildSkillMapViewModel, CATEGORY_LABEL, SKILL_MAP_CATEGORY_ORDER } from "./skillMapViewModel";
import { useSkillMapData } from "./useSkillMapData";
import { useSound } from "./useSound";
import styles from "./PixelCasinoScreen.module.css";

const ACTIONS: { id: Action; label: string; key: string; detail: string }[] = [
  { id: "hit", label: "Hit", key: "H", detail: "Take a card" },
  { id: "stand", label: "Stand", key: "S", detail: "Keep your hand" },
  { id: "double", label: "Double", key: "D", detail: "One more card" },
  { id: "split", label: "Split", key: "P", detail: "Two hands" },
];

const SUITS: Record<Suit, string> = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
};

const CLUES: Record<ScenarioCategory, string> = {
  hard: "No Ace counts as 11. Compare your total with the dealer's visible card.",
  soft: "An Ace counts as 11. You can draw once without busting.",
  pair: "A pair can stay together or split. The dealer's card changes the choice.",
};

interface GameCardProps {
  card?: Card;
  faceDown?: boolean;
  dealIndex: number;
}

function GameCard({ card, faceDown = false, dealIndex }: GameCardProps) {
  const reduceMotion = useReducedMotion();
  const red = card?.suit === "hearts" || card?.suit === "diamonds";
  const suit = card ? SUITS[card.suit] : "♠";

  return (
    <motion.div
      className={`${styles.card} ${faceDown ? styles.cardBack : ""} ${red ? styles.cardRed : ""}`}
      role="img"
      aria-label={faceDown ? "Face-down dealer card" : card ? `${card.rank} of ${card.suit}` : "Card is being dealt"}
      initial={reduceMotion ? false : { x: 125, y: -75, rotate: 23, scale: 0.8, opacity: 1 }}
      animate={{ x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 }}
      transition={reduceMotion ? { duration: 0 } : { delay: dealIndex * 0.13, type: "spring", stiffness: 255, damping: 20 }}
    >
      {faceDown || !card ? (
        <span className={styles.cardBackSeal} aria-hidden="true">21</span>
      ) : (
        <>
          <span className={styles.cardCorner} aria-hidden="true">{card.rank}<i>{suit}</i></span>
          <span className={styles.cardPip} aria-hidden="true">{suit}</span>
          <span className={`${styles.cardCorner} ${styles.cardCornerBottom}`} aria-hidden="true">{card.rank}<i>{suit}</i></span>
        </>
      )}
    </motion.div>
  );
}

interface HoleCardProps {
  card?: Card;
  revealed: boolean;
  dealIndex: number;
}

/** The dealer's hole card: face-down until `revealed`, then a 3D flip to face-up. */
function HoleCard({ card, revealed, dealIndex }: HoleCardProps) {
  const reduceMotion = useReducedMotion();
  return (
    <div className={styles.flipContainer}>
      <motion.div
        className={styles.flipInner}
        initial={false}
        animate={{ rotateY: revealed ? 180 : 0 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.5, ease: "easeInOut" }}
      >
        <div className={styles.flipFace}>
          <GameCard faceDown dealIndex={dealIndex} />
        </div>
        <div className={`${styles.flipFace} ${styles.flipFaceBack}`}>
          <GameCard card={card} dealIndex={dealIndex} />
        </div>
      </motion.div>
    </div>
  );
}

export function PixelCasinoScreen() {
  // Persists a decision, then — once (and only once) that POST has
  // genuinely settled (see `sendDecision`'s resolve-never-reject
  // contract) — asks the Skill Map data source to refetch (T5: replaces
  // a blind fixed-delay timer keyed off the decision count, which could
  // lag or fire before the write actually finished). `notifyDecisionSettledRef`
  // is populated below, once `useSkillMapData` exists; using a ref
  // (rather than a direct dependency) lets `handleDecision` stay a
  // stable identity and keeps this declared before `usePracticeSession`,
  // which needs it as `onDecision`. The game itself never awaits this —
  // `usePracticeSession` calls `onDecision` fire-and-forget.
  const notifyDecisionSettledRef = useRef<() => void>(() => {});
  const handleDecision = useCallback((record: DecisionRecord) => {
    void sendDecision(record).then(() => {
      notifyDecisionSettledRef.current();
    });
  }, []);

  const {
    scenario,
    feedback,
    decisions,
    stats,
    run,
    choose,
    next,
    restart,
    setBestScore,
    setWeights,
  } = usePracticeSession({ onDecision: handleDecision });
  const { muted, toggleMuted, play } = useSound();
  const [showClue, setShowClue] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);
  const [dailyChallengeOpen, setDailyChallengeOpen] = useState(false);
  const [coachMode, setCoachMode] = useState<"why" | "chat">("chat");
  const [pendingAction, setPendingAction] = useState<Action | null>(null);
  const [handSequence, setHandSequence] = useState(0);
  const pendingTimer = useRef<number | null>(null);
  const reduceMotion = useReducedMotion();

  // --- Skill Map (Phase 3 T4) -----------------------------------------
  const [skillMapOpen, setSkillMapOpen] = useState(false);
  const [focusWeakness, setFocusWeakness] = useState(false);
  const runOverForSkillMap = run.status === "over";
  const skillMapActive = skillMapOpen || runOverForSkillMap;
  const { data: skillMapServerData, notifyDecisionSettled } = useSkillMapData({
    active: skillMapActive,
  });
  useEffect(() => {
    notifyDecisionSettledRef.current = notifyDecisionSettled;
  }, [notifyDecisionSettled]);
  const skillMapViewModel = useMemo(
    () => buildSkillMapViewModel({ server: skillMapServerData, session: stats }),
    [skillMapServerData, stats],
  );
  const gameOverSummary = useMemo(() => summarizeForGameOver(skillMapViewModel), [skillMapViewModel]);

  // Applies adaptive practice weighting ONLY while the "Practice
  // weakness" toggle is explicitly on (owner decision, 2026-09-24, T5):
  // the scenario distribution must never change without the player's
  // explicit choice. `computeToggleWeights` owns that gating — off
  // always resolves to `undefined` regardless of `skillMapServerData`,
  // so fetching stats for the game-over summary (triggered merely by
  // the run ending, via `skillMapActive`) never itself starts biasing
  // scenario generation; only flipping the toggle does. A failed
  // refetch also can't change the weights: `useSkillMapData` keeps the
  // last good `skillMapServerData` (T5 fix 1), so this effect's input
  // is unchanged and it's a no-op re-run.
  useEffect(() => {
    setWeights(computeToggleWeights(skillMapServerData?.stats ?? null, focusWeakness));
  }, [skillMapServerData, focusWeakness, setWeights]);

  // Kept current without re-triggering effects that shouldn't fire again
  // just because the mute state (and so `play`'s identity) changed
  // mid-animation.
  const playRef = useRef(play);
  useEffect(() => {
    playRef.current = play;
  }, [play]);

  // --- Hand resolution reveal state ---------------------------------
  const [revealedStepCount, setRevealedStepCount] = useState(0);
  const [holeRevealed, setHoleRevealed] = useState(false);
  const [showOutcome, setShowOutcome] = useState(false);

  // Resets the reveal state the moment a new (or cleared) `feedback`
  // shows up — done directly during render, comparing against a *state*
  // copy of the previous value (React's documented pattern for
  // "adjusting state when a prop changes"; refs can't be read or written
  // during render) rather than in an effect, so there's no extra
  // committed frame where stale reveal state from the previous hand
  // would flash.
  const [prevFeedback, setPrevFeedback] = useState(feedback);
  if (prevFeedback !== feedback) {
    setPrevFeedback(feedback);
    setRevealedStepCount(0);
    setHoleRevealed(false);
    setShowOutcome(false);
  }

  // Schedules the reveal timeline (extra cards landing, the hole-card
  // flip, then the outcome banner) and their sound cues, as computed by
  // the pure `planTimedReveal` (see `revealPlan.ts`): this effect just
  // turns each planned step into a `setTimeout` and clears them on
  // cleanup. `playRef` keeps `play` out of the dependency list on purpose
  // (see above). A decision that ends the run freezes the table —
  // `planTimedReveal` returns no steps at all, so nothing is revealed or
  // played behind the game-over overlay.
  const runOver = run.status === "over";
  useEffect(() => {
    const timing = reduceMotion ? INSTANT_REVEAL_TIMING : DEFAULT_REVEAL_TIMING;
    const plan = planTimedReveal(feedback, runOver, timing);

    const timers = plan.map((step) =>
      window.setTimeout(() => {
        if (step.kind === "step") setRevealedStepCount((count) => Math.max(count, step.index + 1));
        else if (step.kind === "hole") setHoleRevealed(true);
        else setShowOutcome(true);
        playRef.current(step.sound);
      }, step.atMs),
    );

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [feedback, reduceMotion, runOver]);

  // Immediate decision-grading feedback: correct/mistake sound, plus
  // mistake juice (screen shake is CSS-only via .stageMiss below;
  // vibration is skipped under reduced motion, same as the shake). The
  // cue and vibrate decision come from the pure `planImmediateCue`: once
  // the run is over, it swaps the mistake sound for silence since the
  // game-over cue (below) replaces it, but vibration is unaffected.
  useEffect(() => {
    const cue = planImmediateCue(feedback, runOver);
    if (cue.sound) playRef.current(cue.sound);
    if (cue.vibrate && !reduceMotion) {
      try {
        navigator.vibrate?.(120);
      } catch {
        // Unsupported, blocked, or a non-secure context — no-op.
      }
    }
  }, [feedback, reduceMotion, runOver]);

  // --- Combo multiplier: pulse (visual, computed during render) + sound (effect) ---
  const [prevMultiplier, setPrevMultiplier] = useState(run.multiplier);
  const [comboPulseToken, setComboPulseToken] = useState(0);
  if (run.multiplier !== prevMultiplier) {
    const rose = run.multiplier > prevMultiplier;
    setPrevMultiplier(run.multiplier);
    if (rose) setComboPulseToken((token) => token + 1);
  }

  const prevMultiplierForSoundRef = useRef(run.multiplier);
  useEffect(() => {
    if (run.multiplier > prevMultiplierForSoundRef.current) {
      playRef.current("combo", { comboMultiplier: run.multiplier });
    }
    prevMultiplierForSoundRef.current = run.multiplier;
  }, [run.multiplier]);

  // --- Best score: load after mount (hydration-safe), save + sound on game over ---
  useEffect(() => {
    setBestScore(loadBestScore());
  }, [setBestScore]);

  // The best score this run started with (for "New best!" detection at
  // game over). Tracked with the same render-time state-diff pattern as
  // above: while no decision has been made yet in this run, it follows
  // `run.bestScore` (which itself may still be catching up to storage,
  // see the `setBestScore` effect above); once the first decision lands,
  // it freezes for the rest of the run.
  const [enteringBestScore, setEnteringBestScore] = useState(run.bestScore);
  if (run.decisions === 0 && run.bestScore !== enteringBestScore) {
    setEnteringBestScore(run.bestScore);
  }

  const wasOverRef = useRef(false);
  useEffect(() => {
    if (run.status === "over" && !wasOverRef.current) {
      playRef.current("gameOver");
      saveBestScore(run.bestScore);
    }
    wasOverRef.current = run.status === "over";
  }, [run.status, run.bestScore]);

  const chooseAction = useCallback((action: Action) => {
    if (!scenario || feedback || pendingAction || !scenario.availableActions.includes(action)) return;
    setPendingAction(action);
    pendingTimer.current = window.setTimeout(() => {
      choose(action);
      setPendingAction(null);
      pendingTimer.current = null;
    }, reduceMotion ? 0 : action === scenario.optimalAction ? 130 : 320);
  }, [scenario, feedback, pendingAction, choose, reduceMotion]);

  const nextHand = useCallback(() => {
    if (!feedback) return;
    setShowClue(false);
    setHandSequence((current) => current + 1);
    next();
  }, [feedback, next]);

  useEffect(() => () => {
    if (pendingTimer.current !== null) window.clearTimeout(pendingTimer.current);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // The Skill Map panel owns Esc itself and must be the only thing
      // reacting to keys while it's open — the table's H/S/D/P/Enter
      // shortcuts must not fire underneath it (T4 requirement).
      if (skillMapOpen || coachOpen || dailyChallengeOpen) return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      if (event.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
      // Enter also activates a focused button (e.g. "Deal next hand"); let
      // the button's own click handler run instead of double-firing here.
      if (event.key === "Enter" && event.target instanceof HTMLButtonElement) return;

      const command = keyToCommand(event.key, {
        hasFeedback: Boolean(feedback),
        availableActions: scenario?.availableActions ?? [],
        isGameOver: run.status === "over",
      });
      if (!command) return;

      event.preventDefault();
      if (command.type === "choose") chooseAction(command.action);
      else if (command.type === "next") nextHand();
      else restart();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [feedback, scenario, run.status, chooseAction, nextHand, restart, skillMapOpen, coachOpen, dailyChallengeOpen]);

  const coachHand: CoachHand | null = useMemo(() => {
    if (!scenario || !feedback) return null;
    return {
      playerCards: scenario.playerCards,
      dealerUpcard: scenario.dealerUpcard,
      availableActions: scenario.availableActions,
      userAction: feedback.userAction,
    };
  }, [scenario, feedback]);

  const resolution = feedback?.resolution ?? null;
  const isSplit = (resolution?.playerHands.length ?? 0) > 1;
  const initialCardCount = feedback?.userAction === "split" ? 1 : 2;

  const dealerVisibleCards = resolution
    ? revealedDealerCards(resolution.dealerCards, resolution.steps, revealedStepCount, holeRevealed)
    : null;

  const visiblePlayerHands = resolution
    ? resolution.playerHands.map((hand, handIndex) => revealedHandCards(hand.cards, initialCardCount, handIndex, resolution.steps, revealedStepCount))
    : null;
  const total = visiblePlayerHands && !isSplit
    ? handTotalLabel(visiblePlayerHands[0])
    : scenario ? handValue(scenario.playerCards).total : null;
  const handNumber = currentHandNumber(run.decisions, Boolean(feedback));
  const splitSelected = feedback?.userAction === "split" || pendingAction === "split";
  const bestAction = feedback && ACTIONS.find(({ id }) => id === feedback.optimalAction)?.label;
  const isGameOver = run.status === "over";

  return (
    <main className={styles.game}>
      <header className={styles.topHud}>
        <div className={styles.brand}><span className={styles.brandSymbol}><Spade weight="fill" aria-hidden="true" /></span><div><strong>21 LAB</strong><small>PLAY · LEARN · LEVEL UP</small></div></div>
        <Hud
          run={run}
          muted={muted}
          onToggleMuted={toggleMuted}
          comboPulseToken={comboPulseToken}
          reduceMotion={Boolean(reduceMotion)}
          onOpenSkillMap={() => setSkillMapOpen(true)}
          skillMapOpen={skillMapOpen}
          onOpenDailyChallenge={() => setDailyChallengeOpen(true)}
          dailyChallengeOpen={dailyChallengeOpen}
        />
      </header>

      <div className={styles.gameLayout}>
        <div className={styles.playColumn}>
          <section className={`${styles.stage} ${feedback?.isCorrect ? styles.stageWin : ""} ${feedback && !feedback.isCorrect ? styles.stageMiss : ""}`} aria-label="Pixel casino blackjack table">
            <Image src="/pixel-casino-room.webp" alt="" fill priority unoptimized sizes="(max-width: 780px) 100vw, 76vw" className={styles.roomArt} aria-hidden="true" />
            <div className={styles.roomShade} aria-hidden="true" />
            <div className={styles.overheadLight} aria-hidden="true" />
            <div className={styles.sceneTop}><span>STRATEGY TABLE</span><span>HAND {handNumber.toString().padStart(2, "0")}</span></div>
            <div className={`${styles.coach} ${feedback?.isCorrect ? styles.coachCelebrate : ""}`} aria-hidden="true">
              <span className={styles.coachBubble}>{isGameOver ? "TABLE'S CLOSED!" : feedback ? (feedback.isCorrect ? "NICE READ!" : "LEARN IT!") : "YOUR MOVE!"}</span>
              <Image src="/characters/dealer.webp" alt="" width={272} height={286} unoptimized />
            </div>
            <div className={styles.cardDeck} aria-hidden="true"><i /><i /><i /><i /></div>

            <div className={styles.tableShadow} aria-hidden="true" />
            <div className={styles.tableCamera}>
              <div className={styles.tableBody}>
                <div className={styles.railHighlight} aria-hidden="true" />
                <div className={styles.rulePlaque}>DEALER STANDS ON SOFT 17</div>
                <div className={styles.felt}>
                  <div className={styles.feltGrain} aria-hidden="true" />
                  <div className={styles.feltArc} aria-hidden="true" />
                  <div className={styles.dealerHand}>
                    <div className={styles.handName}>DEALER <b>{dealerVisibleCards && holeRevealed ? handTotalLabel(dealerVisibleCards) : scenario ? rankValue(scenario.dealerUpcard.rank) : "·"}</b></div>
                    <div className={styles.cardFan} key={`dealer-${handSequence}`}>
                      {scenario && <GameCard card={scenario.dealerUpcard} dealIndex={1} />}
                      {resolution ? (
                        <HoleCard card={resolution.dealerCards[1]} revealed={holeRevealed} dealIndex={3} />
                      ) : (
                        <GameCard faceDown dealIndex={3} />
                      )}
                      {dealerVisibleCards && dealerVisibleCards.slice(2).map((card, index) => (
                        <GameCard key={`dealer-draw-${index}-${card.rank}-${card.suit}`} card={card} dealIndex={4 + index} />
                      ))}
                    </div>
                  </div>

                  {isSplit && resolution ? (
                    <div className={styles.playerHand}>
                      <div className={styles.splitHandsRow}>
                        {resolution.playerHands.map((hand, handIndex) => (
                          <div className={styles.miniHand} key={handIndex}>
                            <div className={styles.miniHandName}>HAND {handIndex + 1} <b>{handTotalLabel(visiblePlayerHands?.[handIndex] ?? hand.cards)}</b></div>
                            <div className={styles.cardFan}>
                              {(visiblePlayerHands?.[handIndex] ?? []).map((card, index) => (
                                <GameCard key={`split-${handIndex}-${index}-${card.rank}-${card.suit}`} card={card} dealIndex={index} />
                              ))}
                              {showOutcome && feedback && (
                                <OutcomeBanner hand={hand} isCorrectDecision={feedback.isCorrect} />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className={styles.playerHand}>
                      <div className={styles.handName}>YOUR HAND <b>{total ?? "·"}</b></div>
                      <div className={`${styles.cardFan} ${splitSelected ? styles.splitFan : ""}`} key={`player-${handSequence}`}>
                        {visiblePlayerHands
                          ? visiblePlayerHands[0].map((card, index) => (
                            <div key={`${index}-${card.rank}-${card.suit}`} className={styles.cardSlot}><GameCard card={card} dealIndex={index === 0 ? 0 : 2} /></div>
                          ))
                          : scenario?.playerCards.map((card, index) => <div key={`${index}-${card.rank}-${card.suit}`} className={styles.cardSlot}><GameCard card={card} dealIndex={index === 0 ? 0 : 2} /></div>)}
                        {!scenario && !resolution && <><div className={styles.cardSlot}><GameCard faceDown dealIndex={0} /></div><div className={styles.cardSlot}><GameCard faceDown dealIndex={2} /></div></>}
                        {showOutcome && feedback && resolution && (
                          <OutcomeBanner hand={resolution.playerHands[0]} isCorrectDecision={feedback.isCorrect} />
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div className={styles.frontRail} aria-hidden="true"><div className={styles.railBadge}><strong>21 LAB</strong><span>BLACKJACK PAYS 3 TO 2</span></div></div>
              </div>
            </div>
            {/* Hidden once the per-hand outcome banner(s) take over (showOutcome),
                which are anchored to each player hand's own cards instead of
                this stage-centered stamp (see OutcomeBanner). */}
            <AnimatePresence>
              {feedback && !showOutcome && !isGameOver && <motion.div key={`stamp-${stats.handsPlayed}`} className={`${styles.resultStamp} ${feedback.isCorrect ? styles.resultCorrect : styles.resultIncorrect}`} initial={reduceMotion ? false : { opacity: 0, scale: 2.1, rotate: -8 }} animate={{ opacity: 1, scale: 1, rotate: -5 }} exit={reduceMotion ? undefined : { opacity: 0, scale: 0.85 }} transition={{ type: "spring", stiffness: 290, damping: 17 }} aria-hidden="true">{feedback.isCorrect ? "PERFECT!" : "KEEP LEARNING"}</motion.div>}
            </AnimatePresence>
            {feedback?.isCorrect && !showOutcome && !isGameOver && <div className={styles.rewardParticles} key={`burst-${stats.handsPlayed}`} aria-hidden="true">{Array.from({ length: 8 }, (_, index) => <Sparkle key={index} weight="fill" />)}</div>}
            <AnimatePresence>
              {isGameOver && (
                <GameOverOverlay
                  score={run.score}
                  bestScore={run.bestScore}
                  isNewBest={isNewBestScore(enteringBestScore, run.score)}
                  accuracy={computeRunAccuracy(decisions, run.decisions)}
                  onRestart={restart}
                  summary={gameOverSummary}
                  onWhy={feedback && !feedback.isCorrect ? () => { setCoachMode("why"); setCoachOpen(true); } : undefined}
                />
              )}
            </AnimatePresence>
          </section>

          <section className={`${styles.console} ${isGameOver ? styles.consoleLocked : ""}`} aria-label="Choose your move" inert={isGameOver}>
            <div className={styles.consoleTop}><div><small>CHOOSE YOUR MOVE</small><strong>{scenario ? `${CATEGORY_LABEL[scenario.category]} · ${scenario.label}` : "Dealing a hand..."}</strong></div>{!feedback && <button type="button" className={styles.clueButton} disabled={!scenario || Boolean(pendingAction)} aria-expanded={showClue} onClick={() => setShowClue((value) => !value)}><BookOpen weight="fill" aria-hidden="true" /> {showClue ? "Hide clue" : "Need a clue?"}</button>}</div>
            {showClue && scenario && !feedback && <p className={styles.clue}><Sparkle weight="fill" aria-hidden="true" />{CLUES[scenario.category]}</p>}
            <AnimatePresence mode="wait">
              {feedback ? <motion.div key={`feedback-${stats.handsPlayed}`} className={`${styles.feedback} ${feedback.isCorrect ? styles.feedbackGood : styles.feedbackBad}`} initial={reduceMotion ? false : { opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0 }} aria-live="polite">
                <div className={styles.feedbackBadge}>{feedback.isCorrect ? <Trophy weight="fill" aria-hidden="true" /> : <BookOpen weight="fill" aria-hidden="true" />}</div>
                <div className={styles.feedbackText}><strong>{feedback.isCorrect ? "Perfect move!" : "Not quite. Now you know."}</strong><p>{feedback.message}</p>{!feedback.isCorrect && <small>Best move: {bestAction}</small>}<span>+{feedback.isCorrect ? CORRECT_DECISION_XP : INCORRECT_DECISION_XP} SESSION XP</span>{!feedback.isCorrect && <button type="button" className={styles.whyButton} onClick={() => { setCoachMode("why"); setCoachOpen(true); }}>WHY? SEE THE ODDS</button>}</div>
                {!isGameOver && <button type="button" className={styles.nextButton} onClick={nextHand}>DEAL NEXT HAND <ArrowRight weight="bold" aria-hidden="true" /></button>}
              </motion.div> : <motion.div key="actions" className={styles.actions} initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                {ACTIONS.map(({ id, label, key, detail }) => <button key={id} type="button" className={`${styles.actionButton} ${pendingAction === id ? styles.actionPressed : ""} ${pendingAction === id && scenario?.optimalAction !== id ? styles.actionWrong : ""}`} disabled={!scenario || Boolean(pendingAction) || !scenario.availableActions.includes(id)} onClick={() => chooseAction(id)} aria-label={`${label}: ${detail}`}><kbd>{key}</kbd><strong>{label}</strong><span>{detail}</span></button>)}
              </motion.div>}
            </AnimatePresence>
          </section>
        </div>

        <aside className={styles.playerPanel} aria-label="Session game progress">
          <div className={styles.panelTitle}><Target weight="fill" aria-hidden="true" /><div><small>PLAYER CARD</small><strong>Learn every hand.</strong></div></div>
          <div className={styles.scoreLine}><div><small>ACCURACY</small><strong>{stats.accuracy === null ? "--" : `${stats.accuracy}%`}</strong></div><div><small>CORRECT</small><strong>{stats.correctCount}/{stats.handsPlayed}</strong></div></div>
          <div className={styles.skillHeading}><span>SKILL MAP</span><small>SESSION</small></div>
          {SKILL_MAP_CATEGORY_ORDER.map((category) => {
            const skill = stats.categoryStats[category];
            return <div className={styles.skillRow} key={category}><span>{CATEGORY_LABEL[category]}</span><div className={styles.skillTrack}><i style={{ width: `${skill.accuracy ?? 0}%` }} /></div><b>{skill.accuracy === null ? "--" : `${skill.accuracy}%`}</b></div>;
          })}
          <div className={styles.panelPrompt}><Lightning weight="fill" aria-hidden="true" /><p><strong>Small decisions. Big improvement.</strong><span>Pick a move, learn why, then try another hand. No bets, no chips, just skill.</span><span>Soft hands and pairs come up more often than in a real deck, so you practice the tricky spots.</span></p></div>
          <button type="button" className={styles.askDealerButton} onClick={() => { setCoachMode("chat"); setCoachOpen(true); }}><Sparkle weight="fill" aria-hidden="true" /> ASK THE DEALER</button>
          <small className={styles.sessionOnly}>Progress resets when this session ends.</small>
          <small className={styles.webflowCredit}>Built on Webflow Cloud. Independent 21 Lab project.</small>
        </aside>
      </div>

      <SkillMapPanel
        open={skillMapOpen}
        onClose={() => setSkillMapOpen(false)}
        viewModel={skillMapViewModel}
        focusWeakness={focusWeakness}
        onToggleFocusWeakness={() => setFocusWeakness((value) => !value)}
      />
      <DailyChallengePanel open={dailyChallengeOpen} onClose={() => setDailyChallengeOpen(false)} />
      {coachOpen && <CoachPanel
        open={coachOpen}
        mode={coachMode}
        hand={coachHand}
        template={feedback?.message ?? "The coach is unavailable right now. Keep playing and use the built-in strategy hints."}
        onClose={() => setCoachOpen(false)}
      />}
    </main>
  );
}
