"use client";

import { useEffect } from "react";

/** The colour behind the app header; the installed app's title bar should match it */
const SOURCE_VARIABLE = "--muted";

/**
 * Turns any CSS colour (hsl, oklch, named…) into `#rrggbb`: browsers accept
 * hex everywhere in `theme-color`, newer colour syntaxes not always.
 */
function toHex(color: string): string | null {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.fillStyle = "#000";
    context.fillStyle = color;
    context.fillRect(0, 0, 1, 1);
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
    return `#${[r, g, b].map((part) => (part ?? 0).toString(16).padStart(2, "0")).join("")}`;
  } catch {
    return null;
  }
}

export function resolveThemeColor(root: HTMLElement = document.documentElement): string | null {
  const value = getComputedStyle(root).getPropertyValue(SOURCE_VARIABLE).trim();
  return value ? toHex(value) : null;
}

function applyThemeColor() {
  const color = resolveThemeColor();
  if (!color) return;
  // Every tag gets the same colour, including the prefers-color-scheme ones
  // rendered by the server, so whichever one the browser picks is right.
  const tags = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
  if (tags.length === 0) {
    const tag = document.createElement("meta");
    tag.name = "theme-color";
    tag.content = color;
    document.head.appendChild(tag);
    return;
  }
  tags.forEach((tag) => {
    if (tag.content !== color) tag.content = color;
  });
}

/**
 * Keeps `<meta name="theme-color">` in step with the current look: light or
 * dark (class on <html>) and the colour theme (`data-theme`). An installed
 * app (Windows, macOS, Android) paints its title bar / status bar with it.
 */
export function ThemeColorSync() {
  useEffect(() => {
    applyThemeColor();
    const observer = new MutationObserver(() => applyThemeColor());
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "style"],
    });
    // Navigation can render the metadata tags again
    const head = new MutationObserver(() => applyThemeColor());
    head.observe(document.head, { childList: true });
    return () => {
      observer.disconnect();
      head.disconnect();
    };
  }, []);

  return null;
}
