import type { RequestState } from "@/server/requests/types";

/** Dot + label colors per state, light theme (approved card variant I). */
export const STATE_STYLE: Record<
  RequestState,
  { dot: string; glow: string; text: string; pill: string }
> = {
  yourTurn: { dot: "#EA580C", glow: "rgba(234,88,12,.16)", text: "#C2410C", pill: "#FDEDE5" },
  vendor: { dot: "#64748B", glow: "rgba(100,116,139,.16)", text: "#475569", pill: "#EEF2F6" },
  approval: { dot: "#7C3AED", glow: "rgba(124,58,237,.14)", text: "#6D28D9", pill: "#F3EDFD" },
  progress: { dot: "#D97706", glow: "rgba(217,119,6,.16)", text: "#A15C07", pill: "#FEF3C7" },
  new: { dot: "#2563EB", glow: "rgba(37,99,235,.14)", text: "#1D4ED8", pill: "#E8EFFD" },
  answered: { dot: "#16A34A", glow: "rgba(22,163,74,.16)", text: "#15803D", pill: "#DCFCE7" },
  closed: { dot: "#A8A29E", glow: "rgba(168,162,158,.18)", text: "#57534E", pill: "#F5F5F4" },
  cancelled: { dot: "#A8A29E", glow: "rgba(168,162,158,.18)", text: "#57534E", pill: "#F5F5F4" },
};

export function StateDot({ state, size = 7 }: { state: RequestState; size?: number }) {
  const s = STATE_STYLE[state];
  return (
    <span
      aria-hidden
      className="shrink-0 rounded-full"
      style={{ width: size, height: size, background: s.dot, boxShadow: `0 0 0 3px ${s.glow}` }}
    />
  );
}
