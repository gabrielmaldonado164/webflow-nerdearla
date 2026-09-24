"use client";

import { X } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

import type { Action, Card } from "@/blackjack";
import { DEFAULT_RULES, explainDecision, optimalAction } from "@/blackjack";
import { DAILY_HAND_COUNT, DAILY_MISS_LIMIT, evaluateDailyActions, type DailyResult } from "@/training/dailyChallenge";
import { fetchDailyChallenge, submitDailyChallenge, type DailyChallengeResponse } from "./dailyChallengeRequest";
import styles from "./DailyChallengePanel.module.css";

interface DailyChallengePanelProps {
  open: boolean;
  onClose: () => void;
}

const ACTION_LABEL: Record<Action, string> = {
  hit: "Hit", stand: "Stand", double: "Double", split: "Split",
};
const ACTION_ORDER: Action[] = ["hit", "stand", "double", "split"];
const SUIT_SYMBOL: Record<Card["suit"], string> = {
  spades: "♠", hearts: "♥", diamonds: "♦", clubs: "♣",
};

function ChallengeCard({ card }: { card: Card }) {
  const red = card.suit === "hearts" || card.suit === "diamonds";
  return <span className={`${styles.card} ${red ? styles.cardRed : ""}`} role="img" aria-label={`${card.rank} of ${card.suit}`}>
    {card.rank}{SUIT_SYMBOL[card.suit]}
  </span>;
}

function ResultSummary({ result }: { result: DailyResult }) {
  return <div className={styles.result} role="status">
    <h3>CHALLENGE COMPLETE</h3>
    <strong>{result.score}/{DAILY_HAND_COUNT}</strong>
    <p>{result.accuracy}% accuracy across {result.attempts} hands</p>
    <p>Come back after 00:00 UTC for a new set.</p>
  </div>;
}

export function DailyChallengePanel({ open, onClose }: DailyChallengePanelProps) {
  const [challenge, setChallenge] = useState<DailyChallengeResponse | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [actions, setActions] = useState<Action[]>([]);
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);
  const [savedResult, setSavedResult] = useState<DailyResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus();
    return () => previousFocusRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "Tab") {
        const focusable = panelRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || challenge) return;
    const controller = new AbortController();
    void fetchDailyChallenge(controller.signal).then((value) => {
      if (controller.signal.aborted) return;
      if (value) {
        setChallenge(value);
        setLoadError(false);
      } else {
        setLoadError(true);
      }
    });
    return () => controller.abort();
  }, [open, challenge, retryToken]);

  if (!open) return null;

  const result = savedResult ?? challenge?.result ?? null;
  const progress = challenge ? evaluateDailyActions(challenge.scenarios, actions) : null;
  const handIndex = selectedAction ? actions.length - 1 : actions.length;
  const scenario = challenge?.scenarios[handIndex] ?? null;
  const bestAction = scenario ? optimalAction(scenario.playerCards, scenario.dealerUpcard, DEFAULT_RULES) : null;
  const feedback = scenario && selectedAction && bestAction ? explainDecision({
    playerCards: scenario.playerCards,
    dealerUpcard: scenario.dealerUpcard,
    userAction: selectedAction,
    optimalAction: bestAction,
  }) : null;

  const finishOrContinue = () => {
    if (!challenge || !progress || !selectedAction || submitting) return;
    if (!progress.complete) {
      setSelectedAction(null);
      return;
    }
    setSubmitting(true);
    setSubmitError(false);
    const durationMs = Math.max(0, Date.now() - (startedAtRef.current ?? Date.now()));
    void submitDailyChallenge(challenge.date, actions, durationMs, new AbortController().signal).then((value) => {
      setSubmitting(false);
      if (value) setSavedResult(value);
      else setSubmitError(true);
    });
  };

  return <div className={styles.overlay}>
    <div className={styles.panel} role="dialog" aria-modal="true" aria-labelledby="daily-heading" tabIndex={-1} ref={panelRef}>
      <header className={styles.header}>
        <div><small>21 LAB · ONE SET FOR EVERYONE</small><h2 id="daily-heading">DAILY CHALLENGE</h2></div>
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close Daily Challenge"><X weight="bold" /></button>
      </header>

      <p className={styles.intro}>Ten fixed strategy hands. Your run ends after three mistakes. The set resets at 00:00 UTC; your score is checked by the engine before it is saved.</p>

      {!challenge && !loadError && <p className={styles.intro} role="status">Dealing today&apos;s challenge...</p>}
      {!challenge && loadError && <><p className={styles.error} role="alert">Today&apos;s challenge is unavailable. Practice mode still works.</p><button type="button" className={styles.primaryButton} onClick={() => { setLoadError(false); setRetryToken((token) => token + 1); }}>TRY AGAIN</button></>}

      {challenge && <>
        <div className={styles.meta}><span>{challenge.date} UTC</span><span>{result ? "FINISHED" : `HAND ${Math.min(handIndex + 1, DAILY_HAND_COUNT)}/${DAILY_HAND_COUNT}`}</span><span>{progress?.misses ?? 0}/{DAILY_MISS_LIMIT} MISSES</span></div>
        <div className={styles.progressTrack} role="progressbar" aria-label="Daily challenge progress" aria-valuenow={result?.attempts ?? actions.length} aria-valuemin={0} aria-valuemax={DAILY_HAND_COUNT}><i style={{ width: `${((result?.attempts ?? actions.length) / DAILY_HAND_COUNT) * 100}%` }} /></div>
        {result ? <ResultSummary result={result} /> : scenario && <>
          <div className={styles.scenario}>
            <p className={styles.scenarioTitle}>{scenario.label.toUpperCase()}</p>
            <span className={styles.handLabel}>DEALER SHOWS</span>
            <div className={styles.cards}><ChallengeCard card={scenario.dealerUpcard} /></div>
            <span className={styles.handLabel}>YOUR HAND</span>
            <div className={styles.cards}>{scenario.playerCards.map((card, index) => <ChallengeCard key={`${index}-${card.rank}-${card.suit}`} card={card} />)}</div>
          </div>
          {feedback ? <>
            <div className={`${styles.feedback} ${feedback.isCorrect ? "" : styles.feedbackMiss}`} role="status">
              <strong>{feedback.title}</strong><p>{feedback.message}</p>
              {!feedback.isCorrect && <p>Best move: {bestAction ? ACTION_LABEL[bestAction] : "--"}</p>}
            </div>
            {submitError && <p className={styles.error} role="alert">Your result could not be saved. Try again; this attempt is still here.</p>}
            <button type="button" className={styles.primaryButton} onClick={finishOrContinue} disabled={submitting}>{submitting ? "SAVING..." : progress?.complete ? "SAVE RESULT" : "NEXT HAND"}</button>
          </> : <div className={styles.actions}>
            {ACTION_ORDER.map((action) => <button key={action} type="button" className={styles.actionButton} disabled={!scenario.availableActions.includes(action)} onClick={() => {
              if (actions.length === 0) startedAtRef.current = Date.now();
              setActions((current) => [...current, action]);
              setSelectedAction(action);
            }}>{ACTION_LABEL[action]}</button>)}
          </div>}
        </>}
      </>}
      <small className={styles.footer}>Closing this panel keeps your progress until you reload the page. Only the first completed result is recorded for each UTC day.</small>
    </div>
  </div>;
}
