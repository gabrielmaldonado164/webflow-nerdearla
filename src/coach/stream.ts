import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { stepCountIs, streamText, tool } from "ai";
import { z } from "zod";

import { listPlayerDecisions } from "@/db/decisionsRepository";
import { getDb } from "@/db/client";
import { computePlayerStats } from "@/player/playerStats";

import type { CoachRequest } from "./request";

const SYSTEM_PROMPT = `You are the 21 Lab blackjack coach. Explain decisions clearly and briefly.
Use only supplied deterministic engine evidence and tool results for claims about the optimal action, expected value, rules, or the player's history. Never invent numbers, rules, or stats. EV is Monte Carlo profit per unit of the original bet and is approximate, not a guarantee. If evidence is missing, say so and ask for a hand. Do not give betting advice.`;

export interface CoachProviderConfig {
  apiKey: string;
  model: string;
}

/** Returns raw UTF-8 text chunks; the route exposes this as text/plain. */
export async function startCoachStream(
  request: CoachRequest,
  playerId: string,
  config: CoachProviderConfig,
): Promise<AsyncIterable<string>> {
  const provider = createOpenAICompatible({
    name: "command-code",
    baseURL: "https://api.commandcode.ai/provider/v1",
    apiKey: config.apiKey,
  });
  const evidence = request.evidence;
  const prompt = request.mode === "why"
    ? `Explain why my move was ${request.evidence.evidence.optimalAction === request.evidence.input.userAction ? "correct" : "incorrect"}. The player chose ${request.evidence.input.userAction}. Engine evidence: ${JSON.stringify(request.evidence.evidence)}. Keep it to three sentences and identify the better action if relevant.`
    : `${request.message}\n${evidence ? `Current hand engine evidence: ${JSON.stringify(evidence.evidence)}` : "No hand was provided."}`;
  const result = streamText({
    model: provider.chatModel(config.model),
    system: SYSTEM_PROMPT,
    prompt,
    tools: {
      get_optimal_action: tool({
        description: "Get the deterministic optimal action for the current hand, if one was provided.",
        inputSchema: z.object({}),
        execute: async () => evidence ? { optimalAction: evidence.evidence.optimalAction } : { error: "No hand provided" },
      }),
      simulate_ev: tool({
        description: "Get Monte Carlo EV per available action for the current hand, if one was provided.",
        inputSchema: z.object({}),
        execute: async () => evidence ? { ev: evidence.evidence.ev } : { error: "No hand provided" },
      }),
      get_player_stats: tool({
        description: "Get the current anonymous player's persisted practice statistics.",
        inputSchema: z.object({}),
        execute: async () => ({ stats: computePlayerStats(await listPlayerDecisions(getDb(), playerId)) }),
      }),
    },
    stopWhen: stepCountIs(4),
    maxOutputTokens: 300,
    abortSignal: AbortSignal.timeout(20_000),
    onError: ({ error }) => console.error("Coach provider failed:", error),
  });
  return result.textStream;
}
