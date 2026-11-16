// A board's background is its colour, drawn as a muted diagonal gradient
// behind the lists (the lists stay opaque cards over it, as in Trello). Only
// colours (no photos): they stay readable in light and dark mode and need no
// storage. The inbox panel can take one of the same colours.

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
  return `linear-gradient(135deg, color-mix(in srgb, ${color} 80%, #000) 0%, color-mix(in srgb, ${color} 45%, #000) 100%)`;
}

/** A small swatch for tiles and pickers. */
export function boardSwatch(color: string | null | undefined) {
  return boardBackground(color) ?? "hsl(var(--muted))";
}

/** One of the palette's colours, or null (a stored value that is not one). */
export function paletteColor(value: unknown): string | null {
  return typeof value === "string" && BOARD_COLORS.includes(value) ? value : null;
}
