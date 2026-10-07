/** "dziś, 9:12" / "wczoraj, 15:20" / "5 paź" / "5 paź 2025" -- the list and thread date style. */
export function formatWhen(
  iso: string,
  locale: string,
  labels: { today: string; yesterday: string },
  now = new Date()
): string {
  const d = new Date(iso);
  const time = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(d);
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((day(now) - day(d)) / 86_400_000);
  if (diffDays === 0) return `${labels.today}, ${time}`;
  if (diffDays === 1) return `${labels.yesterday}, ${time}`;
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  }).format(d);
}

export function formatBytes(bytes: number, locale: string): string {
  const units = ["B", "KB", "MB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: i ? 1 : 0 }).format(v)} ${units[i]}`;
}

/** Darker shade of a type color for text on white (keeps hue, meets contrast). */
export function inkFor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#44403C";
  const n = parseInt(m[1]!, 16);
  const mix = (c: number) => Math.round(c * 0.72);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
