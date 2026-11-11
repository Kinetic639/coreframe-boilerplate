import {
  COLOR_THEMES,
  COLOR_THEME_CHANGE_EVENT,
  COLOR_THEME_STORAGE_KEY,
} from "@/lib/constants/color-themes";

/**
 * Colour theme switching for the palette: a preview that only touches the
 * DOM (nothing saved, reverted on Esc) and the same persisting apply as the
 * appearance settings (data-theme, localStorage, UI store, change event).
 */

const DEFAULT_THEME = "default";

function isKnownTheme(name: string | null | undefined): name is string {
  return !!name && COLOR_THEMES.some((theme) => theme.name === name);
}

/** The colour theme currently applied to the document */
export function getActiveColorTheme(): string {
  const fromDom = document.documentElement.getAttribute("data-theme");
  if (isKnownTheme(fromDom)) return fromDom;
  try {
    const stored = window.localStorage.getItem(COLOR_THEME_STORAGE_KEY);
    if (isKnownTheme(stored)) return stored;
  } catch {
    // Storage unavailable: fall back to the default theme
  }
  return DEFAULT_THEME;
}

/** Shows a theme without saving it */
export function previewColorTheme(name: string): void {
  if (isKnownTheme(name)) document.documentElement.setAttribute("data-theme", name);
}

/** Applies and saves a theme, like the appearance settings do */
export function applyColorTheme(name: string, saveToStore: (name: string) => void): void {
  if (!isKnownTheme(name)) return;
  document.documentElement.setAttribute("data-theme", name);
  saveToStore(name);
  try {
    window.localStorage.setItem(COLOR_THEME_STORAGE_KEY, name);
  } catch {
    // Storage unavailable: the store and the DOM still carry the theme
  }
  window.dispatchEvent(new CustomEvent(COLOR_THEME_CHANGE_EVENT, { detail: name }));
}
