"use client";

import { ChatCircleDots, Sparkle, X } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { coachQuotaCopy, shouldApplyUsageFetch, type CoachQuotaState } from "./coachQuotaCopy";
import type { CoachEvidence, CoachHand } from "./coachRequest";
import { fetchCoachEvidence, fetchCoachUsage, streamCoachReply } from "./coachRequest";
import styles from "./CoachPanel.module.css";

interface CoachPanelProps {
  open: boolean;
  mode: "why" | "chat";
  hand: CoachHand | null;
  template: string;
  onClose: () => void;
}

const ACTION_LABEL: Record<string, string> = {
  hit: "Hit", stand: "Stand", double: "Double", split: "Split",
};

export function CoachPanel({ open, mode, hand, template, onClose }: CoachPanelProps) {
  const [evidence, setEvidence] = useState<CoachEvidence | null>(null);
  const [reply, setReply] = useState("");
  const [question, setQuestion] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [source, setSource] = useState<"ai" | "template" | null>(null);
  const [quota, setQuota] = useState<CoachQuotaState>({ limit: null, remaining: null, outcomeKind: null, refunded: false });
  const controllerRef = useRef<AbortController | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const ask = useCallback(async (request: { mode: "why" | "chat"; hand?: CoachHand; message?: string }, fallback: string) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setReply("");
    setSource(null);
    setWaiting(true);
    const outcome = await streamCoachReply(request, controller.signal, setReply);
    if (controller.signal.aborted) return;
    setQuota((previous) => ({
      limit: previous.limit,
      remaining: outcome.remaining ?? previous.remaining,
      outcomeKind: outcome.kind,
      refunded: outcome.kind === "unavailable" && outcome.refunded,
    }));
    if (outcome.kind === "ok") {
      setSource("ai");
    } else {
      setReply(fallback);
      setSource("template");
    }
    setWaiting(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus();
    return () => {
      controllerRef.current?.abort();
      previousFocusRef.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const usageController = new AbortController();
    void fetchCoachUsage(usageController.signal).then((usage) => {
      if (usageController.signal.aborted || !usage) return;
      setQuota((previous) => shouldApplyUsageFetch(previous)
        ? { limit: usage.limit, remaining: usage.remaining, outcomeKind: previous.outcomeKind, refunded: previous.refunded }
        : previous);
    });
    return () => usageController.abort();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    if (mode !== "why" || !hand) return;
    const evidenceController = new AbortController();
    void fetchCoachEvidence(hand, evidenceController.signal).then((value) => {
      if (!evidenceController.signal.aborted) setEvidence(value);
    });
    void Promise.resolve().then(() => {
      if (!evidenceController.signal.aborted) return ask({ mode: "why", hand }, template);
    });
    return () => evidenceController.abort();
  }, [open, mode, hand, template, ask]);

  if (!open) return null;

  const quotaCopy = coachQuotaCopy(quota);
  const bestEv = evidence ? Math.max(...evidence.ev.map((row) => row.ev)) : 0;
  const worstEv = evidence ? Math.min(...evidence.ev.map((row) => row.ev)) : 0;
  return (
    <div className={styles.overlay}>
      <div className={styles.panel} role="dialog" aria-modal="true" aria-labelledby="coach-heading" tabIndex={-1} ref={panelRef}>
        <header className={styles.header}>
          <div><small>21 LAB · STRATEGY DESK</small><h2 id="coach-heading"><ChatCircleDots weight="fill" aria-hidden="true" /> {mode === "why" ? "WHY THAT MOVE?" : "ASK THE DEALER"}</h2></div>
          <button type="button" onClick={onClose} aria-label="Close coach"><X weight="bold" /></button>
        </header>
        {quotaCopy.counter && (
          <div className={styles.quota}>
            <span>{quotaCopy.counter}</span>
            {quotaCopy.limitMessage && <small className={styles.quotaLimit}>{quotaCopy.limitMessage}</small>}
            {quotaCopy.refundMessage && <small className={styles.quotaRefund}>{quotaCopy.refundMessage}</small>}
          </div>
        )}
        {mode === "why" && hand && (
          <section className={styles.evidence} aria-label="Simulated expected value by action">
            <div className={styles.evidenceHeading}><strong>THE ENGINE SAYS</strong><span>{evidence ? `${ACTION_LABEL[evidence.optimalAction]} is the best move` : "Calculating the odds..."}</span></div>
            {evidence?.ev.map((row) => {
              const width = bestEv === worstEv ? 100 : 15 + (85 * (row.ev - worstEv)) / (bestEv - worstEv);
              return <div className={styles.evRow} key={row.action}>
                <span>{ACTION_LABEL[row.action]}</span>
                <div className={styles.evTrack}><i style={{ width: `${width}%` }} /></div>
                <b>{row.ev >= 0 ? "+" : ""}{row.ev.toFixed(2)}</b>
              </div>;
            })}
            {evidence && <small className={styles.evNote}>Estimated return per unit · {evidence.ev[0]?.iterations.toLocaleString()} simulations per action. Higher is better; negative means an expected loss.</small>}
            {!evidence && <small className={styles.evNote}>Simulation is unavailable right now. The strategy explanation still works.</small>}
          </section>
        )}
        <section className={styles.answer} aria-live="polite" aria-label="Coach explanation">
          <div className={styles.answerLabel}><Sparkle weight="fill" aria-hidden="true" /> DEALER&apos;S NOTE {source === "template" && <span>· OFFLINE EXPLANATION</span>}</div>
          <p>{reply || (mode === "why" ? template : waiting ? "Thinking through your question..." : "Ask about the current hand or your progress.")}</p>
        </section>
        {mode === "chat" && <form className={styles.form} onSubmit={(event) => {
          event.preventDefault();
          const message = question.trim();
          if (!message || waiting) return;
          setQuestion("");
          void ask({ mode: "chat", hand: hand ?? undefined, message }, "The coach is unavailable right now. You can keep playing and use the built-in strategy hints.");
        }}>
          <label htmlFor="coach-question">YOUR QUESTION</label>
          <div><input id="coach-question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={300} placeholder="Why should I stand on 16?" /><button type="submit" disabled={waiting || !question.trim()}>ASK</button></div>
        </form>}
        <footer>Strategy and EV come from the game engine. The coach never decides the correct move.</footer>
      </div>
    </div>
  );
}
