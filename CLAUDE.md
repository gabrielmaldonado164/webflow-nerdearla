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

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
