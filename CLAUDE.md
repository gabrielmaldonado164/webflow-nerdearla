# 21 Lab — Project Instructions

Educational blackjack trainer for the Nerdearla 2026 Webflow App Challenge.
**Hard deadline: Fri 2026-09-25, 18:00 ART.**

## Start of every session
1. Read `docs/ROADMAP.md`. It holds the verified constraints, decisions, architecture, and task checklist.
2. Continue from the first unchecked task in the current phase.
3. Before ending: check off completed tasks and append a line to the Progress Log.

## Non-negotiables
- Strategy is decided by the deterministic engine in `src/blackjack`, never by the LLM.
- The Command Code API key is server-side only.
- The app must work without the AI.
- Do not set `basePath` or `assetPrefix` in the Next.js config (Webflow Cloud injects them).
- Domain code (`src/blackjack`, `src/training`) is pure TypeScript and developed test-first.
- Keep the app deployable after every phase. Feature freeze Friday 12:00 ART.
