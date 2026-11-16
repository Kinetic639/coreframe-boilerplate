// A board's background is its colour, drawn as a soft diagonal gradient. Only
// colours (no photos): they stay readable in light and dark mode and need no
// storage.

export const BOARD_COLORS = [
  "#0079bf",
  "#0f766e",
  "#519839",
  "#b04632",
  "#d29034",
  "#89609e",
  "#cd5a91",
  "#4bbf6b",
  "#00aecc",
  "#475569",
];

/** The board's background, or undefined for the plain page. */
export function boardBackground(color: string | null | undefined) {
  if (!color) return undefined;
  return `linear-gradient(135deg, ${color} 0%, color-mix(in srgb, ${color} 55%, #000) 100%)`;
}

/** A small swatch for tiles and pickers. */
export function boardSwatch(color: string | null | undefined) {
  return boardBackground(color) ?? "hsl(var(--muted))";
}
