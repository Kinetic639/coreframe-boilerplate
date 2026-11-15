import { useEffect } from "react";

/**
 * ↓ / ↑ open the next / previous record of the list, Esc closes the open
 * one. Keys typed into a field, a menu or a dialog are left alone.
 */
export function useListKeys(
  keys: string[],
  selected: string | null,
  open: (key: string | null) => void
) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          "input, textarea, select, [contenteditable='true'], [role='menu'], [role='dialog'], [role='listbox']"
        )
      ) {
        return;
      }
      if (event.key === "Escape" && selected) {
        event.preventDefault();
        open(null);
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      if (!keys.length) return;
      const at = keys.indexOf(selected ?? "");
      if (at < 0 && event.key === "ArrowUp") return;
      const next =
        at < 0
          ? 0
          : Math.min(keys.length - 1, Math.max(0, at + (event.key === "ArrowDown" ? 1 : -1)));
      if (next === at) return;
      event.preventDefault();
      open(keys[next]);
      requestAnimationFrame(() =>
        document
          .querySelector(`[data-row-id="${CSS.escape(keys[next])}"]`)
          ?.scrollIntoView({ block: "nearest" })
      );
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [keys, selected, open]);
}
