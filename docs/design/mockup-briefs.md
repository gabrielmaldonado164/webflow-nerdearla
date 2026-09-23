# Design Mockup Briefs (pending work)

Static HTML mockups live in `design-mockups/` and are served locally with:

```
cd design-mockups && python3 -m http.server 4000
open http://localhost:4000/index.html
```

Directions already built (mobile 390x844 + desktop 1440x900, each `-decide` and `-result`, with animations and a Replay button):

- **A Casino Modern**: Veintiuno-like premium green felt, glassy pills, accuracy ring, bottom tab bar.
- **B Vegas Table**: half-moon table, leather rail, gold felt print, betting spot, plaque drop animation.
- **C Retro Arcade**: 8-bit HUD, CRT scanlines, "PERFECT! +1 COMBO".
- **D Vintage Vegas 1960s**: cream/teal/cherry palette, neon wordmark, starburst.

Screenshots: `design-mockups/shots/` (`v2-*` are the latest).

## Owner feedback so far

- The app must feel like sitting at a real casino blackjack table (no money, no chips with amounts, no betting UI).
- No yellow/gold boxes around the player's cards or on card backs or value pills.
- All action buttons neutral in the decide state (no hint highlighting).
- Wants more exciting, motivating animations that make people want to play and learn.
- Wants desktop versions as well as mobile.
- The chosen direction is a **combination of A + B** (direction E below). A **new pixel-art direction** (F) is also requested for comparison.

## Rules for any agent building mockups

1. First invoke the `design-taste-frontend` skill and follow it (design read, dials, pre-flight check).
2. Work only inside `design-mockups/`. Self-contained HTML (inline CSS/JS, Google Fonts allowed).
3. Zero em-dashes or en-dashes in visible text. WCAG AA contrast. `prefers-reduced-motion` instant fallback for every animation.
4. Write each file to disk as soon as it is composed (previous agents stalled before saving anything).
5. Use the same fixed hand everywhere: dealer 10♦ + hole card 6♣ (dealer 16), player 8♠ 8♥ "Pair of 8s", streak 7 to 8, accuracy 84% to 85%, EV "Expected value per bet": Split -0.48, Hit -0.54, Stand -0.57 (illustrative; the real app uses the Monte Carlo simulator).
6. Add a small fixed "Replay" button bottom-left that restarts the animation sequence.
7. After building, add the new direction to the top of `design-mockups/index.html` (Mobile and Desktop rows, per-iframe Replay links), keeping A to D below under "Previous directions".

## Direction E "Signature" (A + B), files `e-signature-{decide,result}.html`, `e-signature-desktop-{decide,result}.html`

- From B: real half-moon table from the player's seat, padded dark leather rail, gold felt print "BLACKJACK PAYS 3 TO 2" and "DEALER MUST STAND ON ALL 17s" clearly visible between dealer and player, cream betting-spot outline, dealer shoe.
- From A: glassy pills, accuracy ring, icon + label action buttons, bottom tab bar (mobile), top nav + right session panel (desktop), EV comparison card.
- Gold only for the felt print, the accuracy ring and the primary "Next hand" button. Card back: classic deep red with white border. Value pills: dark glass with cream text.
- The desktop table must keep the real table shape (half-moon + rail).

## Direction F "Pixel Art", files `f-pixel-art-{decide,result}.html`, `f-pixel-art-desktop-{decide,result}.html`

- Balatro-style illustrated pixel-art casino scene (not an arcade HUD like C): pixel dealer sprite behind the table (crisp SVG rects), dithered felt, warm pixel lamp light cone, pixel shoe and rail, chunky pixel cards.
- Pixel font for headings/HUD/buttons (Pixelify Sans, Silkscreen or Press Start 2P); readable font for explanations (VT323 large or JetBrains Mono).
- Pixel betting-spot circle instead of a box; neutral chunky pixel buttons.
- Motion with `steps()` easing where fitting; idle card wobble; dealer sprite deal and reaction frames.

## Motivating animation sequence (both E and F, flavored per style)

Decide state: cards dealt from the shoe on an arc with a soft landing bounce (player, dealer up, player, dealer hole); idle card sway; streak flame flicker; "hot streak" warm rim light (streak 7); daily goal ring 18/25.

Result state (user correctly SPLIT 8s vs 10), about 3 to 4 seconds total:

1. The two 8s slide apart into two hands; each gets a new card (8♠ + 3♦ = 11, 8♥ + 10♣ = 18).
2. Dealer hole card flips to reveal 6♣ (dealer 16).
3. "Perfect move" impact: tiny screen shake, light burst, particles (gold sparkles in E, pixel stars in F).
4. Streak odometer 7 to 8, the flame grows, "HOT STREAK x8" badge.
5. XP bar fills with "+25 XP" and "x2 streak bonus", then LEVEL UP: rank "Rookie" to "Card Counter" (ladder: Rookie, Regular, Card Counter, High Roller, Card Shark).
6. Skill map update: "Pairs" 62% to 68% with a glow.
7. EV rows animate in sorted best-first, bars grow, values count up.
8. Explanation: "Always split 8s. Two hands starting from 8 beat one hard 16 against a 10."
9. Daily goal 18 to 19/25; "Next hand" gets a gentle attention pulse at the end.
