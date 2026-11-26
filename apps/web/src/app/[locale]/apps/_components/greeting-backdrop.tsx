import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

type Streak = [
  axis: "x" | "y",
  left: number,
  top: number,
  length: number,
  duration: number,
  delay: number,
];

// Positions sit on the 48px grid lines so each streak runs along a line.
const PANEL_STREAKS: Streak[] = [
  ["x", 192, 96, 288, 4.4, -0.8],
  ["x", 48, 192, 240, 4.9, -2.6],
  ["x", 288, 288, 288, 4.7, -1.9],
  ["x", 96, 384, 192, 5.3, -3.4],
  ["x", 336, 48, 240, 5.6, -4.4],
  ["y", 96, 0, 240, 4.6, -1.3],
  ["y", 240, 96, 288, 5.1, -3.8],
  ["y", 432, 240, 240, 4.8, -2.4],
  ["y", 528, 48, 192, 5.4, -0.4],
  ["y", 336, 336, 192, 4.5, -4.6],
];

const BAND_STREAKS: Streak[] = [
  ["x", 144, 48, 192, 4.4, -0.8],
  ["x", 48, 144, 192, 4.9, -2.6],
  ["x", 192, 240, 192, 5.2, -3.9],
  ["y", 240, 0, 192, 4.6, -1.3],
  ["y", 336, 96, 144, 5.1, -3.8],
  ["y", 96, 48, 144, 4.8, -0.4],
];

const LOGO_PATHS = {
  left: "M28 5 L5 53 L16 53 L28 29 Z",
  right: "M28 5 L51 53 L40 53 L28 29 Z",
  core: "M28 7.5 L22 20 L28 29 L34 20 Z",
  chevron: "14,34 28,51 42,34",
};

/**
 * The big Ambra mark at 16% over the grid, as in the site hero: a solid copy in
 * the panel colour underneath keeps the grid from showing through the mark.
 */
function WatermarkLogo({ className }: { className: string }) {
  return (
    <>
      <svg
        aria-hidden="true"
        viewBox="0 0 56 56"
        fill="none"
        className={cn(className, "text-stone-50 opacity-[0.96] dark:text-stone-900")}
      >
        <path d={LOGO_PATHS.left} fill="currentColor" />
        <path d={LOGO_PATHS.right} fill="currentColor" />
        <polyline
          points={LOGO_PATHS.chevron}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <svg
        aria-hidden="true"
        viewBox="0 0 56 56"
        fill="none"
        className={cn(className, "opacity-[0.16]")}
      >
        <path d={LOGO_PATHS.left} fill="#B45309" />
        <path d={LOGO_PATHS.right} fill="#F59E0B" />
        <path d={LOGO_PATHS.core} fill="#FBBF24" opacity="0.95" />
        <polyline
          points={LOGO_PATHS.chevron}
          stroke="#FCD34D"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity="0.85"
        />
      </svg>
    </>
  );
}

/** Animated amber grid with the Ambra mark, behind the chooser's greeting. */
export function GreetingBackdrop({ variant }: { variant: "panel" | "band" }) {
  const streaks = variant === "panel" ? PANEL_STREAKS : BAND_STREAKS;
  const mask =
    variant === "panel"
      ? "radial-gradient(ellipse 85% 75% at 78% 22%, #000 25%, transparent 78%)"
      : "radial-gradient(ellipse 90% 85% at 80% 25%, #000 25%, transparent 80%)";

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <div className="absolute inset-0" style={{ maskImage: mask, WebkitMaskImage: mask }}>
        <div className="ambra-chooser-grid absolute inset-0" />
        {streaks.map(([axis, left, top, length, duration, delay]) => (
          <div
            key={`${axis}-${left}-${top}`}
            className={cn(
              "ambra-chooser-streak",
              axis === "x" ? "ambra-chooser-streak-x" : "ambra-chooser-streak-y"
            )}
            style={
              {
                left,
                top,
                [axis === "x" ? "width" : "height"]: length,
                "--streak-duration": `${duration}s`,
                "--streak-delay": `${delay}s`,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <WatermarkLogo
        className={cn(
          "absolute",
          variant === "panel"
            ? "-right-0.5 -top-0.5 h-[340px] w-[340px]"
            : "right-0 top-1 h-40 w-40"
        )}
      />
    </div>
  );
}
