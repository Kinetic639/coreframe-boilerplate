// What a saved view of a list keeps: its address without the page and the
// open record, in a stable order.

/** Keys a view never keeps, whatever the list (the page, the open record). */
const ALWAYS_IGNORED = ["strona", "selected", "tab"];

/**
 * The address as a view keeps it: without the ignored keys, in a stable
 * order, so two addresses of the same view compare equal.
 */
export function viewQueryOf(search: string | URLSearchParams, ignore: readonly string[] = []) {
  const params = new URLSearchParams(search);
  const skip = new Set([...ALWAYS_IGNORED, ...ignore]);
  const kept = [...params.entries()]
    .filter(([key, value]) => !skip.has(key) && value !== "")
    .sort(([a, x], [b, y]) => a.localeCompare(b) || x.localeCompare(y));
  if (!kept.length) return "";
  return `?${new URLSearchParams(kept).toString()}`;
}
