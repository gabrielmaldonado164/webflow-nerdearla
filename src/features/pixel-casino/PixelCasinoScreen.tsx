"use client";

import { ArrowRight, BookOpen, Fire, Lightning, Sparkle, Spade, Target, Trophy } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Action, Card, ScenarioCategory, Suit } from "@/blackjack";
import { handValue, rankValue } from "@/blackjack";
import { usePracticeSession } from "@/features/practice/usePracticeSession";
import { getArcadeProgress } from "./progress";
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

const CATEGORY_LABEL: Record<ScenarioCategory, string> = {
  hard: "Hard hands",
  soft: "Soft hands",
  pair: "Pairs",
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

export function PixelCasinoScreen() {
  const { scenario, feedback, decisions, stats, choose, next } = usePracticeSession();
  const [showClue, setShowClue] = useState(false);
  const [pendingAction, setPendingAction] = useState<Action | null>(null);
  const [handSequence, setHandSequence] = useState(0);
  const pendingTimer = useRef<number | null>(null);
  const reduceMotion = useReducedMotion();
  const progress = useMemo(() => getArcadeProgress(decisions), [decisions]);

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
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      if (event.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
      if (feedback) {
        if (event.key === "Enter" && !(event.target instanceof HTMLButtonElement)) {
          event.preventDefault();
          nextHand();
        }
        return;
      }
      const action = ACTIONS.find(({ key }) => key.toLowerCase() === event.key.toLowerCase());
      if (action) {
        event.preventDefault();
        chooseAction(action.id);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [feedback, chooseAction, nextHand]);

  const total = scenario ? handValue(scenario.playerCards).total : null;
  const handNumber = stats.handsPlayed + (feedback ? 0 : 1);
  const splitSelected = feedback?.userAction === "split" || pendingAction === "split";
  const bestAction = feedback && ACTIONS.find(({ id }) => id === feedback.optimalAction)?.label;

  return (
    <main className={styles.game}>
      <header className={styles.topHud}>
        <div className={styles.brand}><span className={styles.brandSymbol}><Spade weight="fill" aria-hidden="true" /></span><div><strong>21 LAB</strong><small>PLAY · LEARN · LEVEL UP</small></div></div>
        <div className={styles.hudMetrics} aria-label="Current session progress">
          <div className={styles.levelMeter}><span>LV {progress.level}</span><div className={styles.meterTrack} role="progressbar" aria-label="XP to next session level" aria-valuenow={progress.levelXp} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${progress.levelXp}%` }} /></div><b>{progress.levelXp}/100 XP</b></div>
          <div className={`${styles.streak} ${stats.currentStreak >= 3 ? styles.hotStreak : ""}`} aria-label={`${stats.currentStreak} correct decisions in a row`}><Fire weight="fill" aria-hidden="true" /><strong>{stats.currentStreak}</strong><span>STREAK</span></div>
        </div>
      </header>

      <div className={styles.gameLayout}>
        <div className={styles.playColumn}>
          <section className={`${styles.stage} ${feedback?.isCorrect ? styles.stageWin : ""} ${feedback && !feedback.isCorrect ? styles.stageMiss : ""}`} aria-label="Pixel casino blackjack table">
            <Image src="/pixel-casino-room.png" alt="" fill priority unoptimized sizes="(max-width: 780px) 100vw, 76vw" className={styles.roomArt} aria-hidden="true" />
            <div className={styles.roomShade} aria-hidden="true" />
            <div className={styles.overheadLight} aria-hidden="true" />
            <div className={styles.sceneTop}><span>STRATEGY TABLE</span><span>HAND {handNumber.toString().padStart(2, "0")}</span></div>
            <div className={`${styles.coach} ${feedback?.isCorrect ? styles.coachCelebrate : ""}`} aria-hidden="true"><span className={styles.coachBubble}>{feedback ? feedback.isCorrect ? "NICE READ!" : "LEARN IT!" : "YOUR MOVE!"}</span><Image src="/web-builder-coach.png" alt="" width={1199} height={1312} /></div>
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
                    <div className={styles.handName}>DEALER <b>{scenario ? rankValue(scenario.dealerUpcard.rank) : "·"}</b></div>
                    <div className={styles.cardFan} key={`dealer-${handSequence}`}>
                      {scenario && <GameCard card={scenario.dealerUpcard} dealIndex={1} />}
                      <GameCard faceDown dealIndex={3} />
                    </div>
                  </div>
                  <div className={styles.playerHand}>
                    <div className={styles.handName}>YOUR HAND <b>{total ?? "·"}</b></div>
                    <div className={`${styles.cardFan} ${splitSelected ? styles.splitFan : ""}`} key={`player-${handSequence}`}>
                      {scenario?.playerCards.map((card, index) => <div key={`${index}-${card.rank}-${card.suit}`} className={styles.cardSlot}><GameCard card={card} dealIndex={index === 0 ? 0 : 2} /></div>)}
                      {!scenario && <><div className={styles.cardSlot}><GameCard faceDown dealIndex={0} /></div><div className={styles.cardSlot}><GameCard faceDown dealIndex={2} /></div></>}
                    </div>
                  </div>
                </div>
                <div className={styles.frontRail} aria-hidden="true"><div className={styles.railBadge}><strong>21 LAB</strong><span>BLACKJACK PAYS 3 TO 2</span></div></div>
              </div>
            </div>
            <AnimatePresence>
              {feedback && <motion.div key={`stamp-${stats.handsPlayed}`} className={`${styles.resultStamp} ${feedback.isCorrect ? styles.resultCorrect : styles.resultIncorrect}`} initial={reduceMotion ? false : { opacity: 0, scale: 2.1, rotate: -8 }} animate={{ opacity: 1, scale: 1, rotate: -5 }} exit={reduceMotion ? undefined : { opacity: 0, scale: 0.85 }} transition={{ type: "spring", stiffness: 290, damping: 17 }} aria-hidden="true">{feedback.isCorrect ? "PERFECT!" : "KEEP LEARNING"}</motion.div>}
            </AnimatePresence>
            {feedback?.isCorrect && <div className={styles.rewardParticles} key={`burst-${stats.handsPlayed}`} aria-hidden="true">{Array.from({ length: 8 }, (_, index) => <Sparkle key={index} weight="fill" />)}</div>}
          </section>

          <section className={styles.console} aria-label="Choose your move">
            <div className={styles.consoleTop}><div><small>CHOOSE YOUR MOVE</small><strong>{scenario ? `${CATEGORY_LABEL[scenario.category]} · ${scenario.label}` : "Dealing a hand..."}</strong></div>{!feedback && <button type="button" className={styles.clueButton} disabled={!scenario || Boolean(pendingAction)} aria-expanded={showClue} onClick={() => setShowClue((value) => !value)}><BookOpen weight="fill" aria-hidden="true" /> {showClue ? "Hide clue" : "Need a clue?"}</button>}</div>
            {showClue && scenario && !feedback && <p className={styles.clue}><Sparkle weight="fill" aria-hidden="true" />{CLUES[scenario.category]}</p>}
            <AnimatePresence mode="wait">
              {feedback ? <motion.div key={`feedback-${stats.handsPlayed}`} className={`${styles.feedback} ${feedback.isCorrect ? styles.feedbackGood : styles.feedbackBad}`} initial={reduceMotion ? false : { opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0 }} aria-live="polite">
                <div className={styles.feedbackBadge}>{feedback.isCorrect ? <Trophy weight="fill" aria-hidden="true" /> : <BookOpen weight="fill" aria-hidden="true" />}</div>
                <div className={styles.feedbackText}><strong>{feedback.isCorrect ? "Perfect move!" : "Not quite. Now you know."}</strong><p>{feedback.message}</p>{!feedback.isCorrect && <small>Best move: {bestAction}</small>}<span>+{feedback.isCorrect ? 25 : 5} SESSION XP</span></div>
                <button type="button" className={styles.nextButton} onClick={nextHand}>DEAL NEXT HAND <ArrowRight weight="bold" aria-hidden="true" /></button>
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
          {(["hard", "soft", "pair"] as ScenarioCategory[]).map((category) => {
            const skill = stats.categoryStats[category];
            return <div className={styles.skillRow} key={category}><span>{CATEGORY_LABEL[category]}</span><div className={styles.skillTrack}><i style={{ width: `${skill.accuracy ?? 0}%` }} /></div><b>{skill.accuracy === null ? "--" : `${skill.accuracy}%`}</b></div>;
          })}
          <div className={styles.panelPrompt}><Lightning weight="fill" aria-hidden="true" /><p><strong>Small decisions. Big improvement.</strong><span>Pick a move, learn why, then try another hand. No bets, no chips, just skill.</span></p></div>
          <small className={styles.sessionOnly}>Progress resets when this session ends.</small>
          <small className={styles.webflowCredit}>Built on Webflow Cloud. Independent 21 Lab project.</small>
        </aside>
      </div>
    </main>
  );
}
