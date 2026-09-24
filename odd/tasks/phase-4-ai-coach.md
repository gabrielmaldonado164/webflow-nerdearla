# Phase 4 — Engine-grounded AI coach

The coach explains decisions and answers questions, but the blackjack engine remains the sole authority for strategy and expected value. The game always displays its deterministic template explanation first; AI is optional.

Branch: `feat/4-ai-coach`, stacked on `feat/3-t4-skill-map-ui`. Work units: `2a0438e` (backend/API) and `71bff33` (game UI and documentation). Not pushed or deployed.

## Implemented

- `POST /api/coach/evidence` re-validates the hand and returns the engine's best action and Monte Carlo EV for every legal move. It works without an AI key.
- `POST /api/coach/stream` streams plain text through Command Code's OpenAI-compatible endpoint using the AI SDK. Its only tools are `get_optimal_action`, `simulate_ev`, and `get_player_stats`, backed by the existing engine and persisted decisions.
- A D1 `coach_usage` row reserves each call with one conditional SQLite UPSERT. The limit is 20 calls per anonymous player per UTC day.
- The Pixel Casino feedback offers **Why? See the odds** after a mistake, including a final mistake at game over. A chart shows EV per action. The player card offers **Ask the dealer**. Provider errors fall back to the existing template or a non-blocking chat message.

## Runtime configuration

Set these **server-only** Webflow Cloud environment variables before the AI coach can respond:

| Variable | Purpose |
|---|---|
| `COMMAND_CODE_API_KEY` | Secret Command Code Provider API key. Never use `NEXT_PUBLIC_`. |
| `COMMAND_CODE_MODEL` | A model ID that supports `/chat/completions` and function tools. Verify against the provider's model list. |

Without either variable, `/api/coach/stream` returns 503; the game and EV evidence remain usable. `COMMAND_CODE_MODEL` is set in Webflow Cloud to `deepseek/deepseek-v4-flash` (verified against the provider's current public model catalog). Webflow Cloud now lists `COMMAND_CODE_API_KEY` with `isSecret: true`; its value is masked and has **not** been verified by a real provider call. The production deploy was not run pending explicit owner approval.

## Verification and remaining work

- Local D1 migration `0002_outstanding_diamondback.sql` applied; conditional quota UPSERT smoke checked first call, increment, and limit rejection.
- `npm test`: 505/505 passed. `npx tsc --noEmit`, `npm run lint`, `npm run build`, and `npm run cf:build`: passed.
- Local Cloudflare preview: valid 16 vs 10 evidence returned 200 with engine action `hit` and EV for all three available actions; stream returned 503 without the provider configuration. The preview was stopped afterward.
- Browser UI smoke could not run: no browser connection was available in this session.
- After explicit owner approval for the production deploy, verify a real streamed Why/chat request and the 429 quota response, then smoke-test desktop/mobile. Do not mark Phase 4 operational until then.

## Rollback boundary

Remove `src/coach`, `src/app/api/coach`, the coach UI/request files and their Pixel Casino wiring; the original template feedback and practice game remain intact. Revert the `coach_usage` schema and migration only if the database is disposable or after a deliberate data migration.
