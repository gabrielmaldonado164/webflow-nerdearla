const DEAL_FROM_SHOE = { x: 125, y: -75, rotate: 23, scale: 0.8, opacity: 1 };
const AT_REST = { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 };

/**
 * Motion props for dealing a card. The initial pose never depends on the
 * motion preference: the server renders it before `useReducedMotion` can
 * read the media query, so it must match the client's first render. Reduced
 * motion only zeroes the transition (never serialized into HTML), and CSS
 * pins the card at rest before hydration.
 *
 * `alreadyDealt` starts the card at rest instead: for cards that remount
 * after they are on the table (the hole card's flip faces), which only
 * render client-side after a decision, never in server HTML.
 */
export function cardDealMotion(
  reduceMotion: boolean | null,
  dealIndex: number,
  { alreadyDealt = false }: { alreadyDealt?: boolean } = {},
) {
  return {
    initial: alreadyDealt ? (false as const) : DEAL_FROM_SHOE,
    animate: AT_REST,
    transition: reduceMotion
      ? { duration: 0 }
      : { delay: dealIndex * 0.13, type: "spring" as const, stiffness: 255, damping: 20 },
  };
}
