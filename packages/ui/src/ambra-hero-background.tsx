import type { CSSProperties } from "react";
import { cn } from "./utils";

type Streak = {
  axis: "x" | "y";
  className?: string;
  style?: CSSProperties;
  duration: string;
  delay: string;
};

export interface AmbraHeroBackgroundProps {
  className?: string;
  gridClassName?: string;
  watermarkClassName?: string;
  watermarkSizeClassName?: string;
  showCenterGlow?: boolean;
  showWatermark?: boolean;
}

const streaks: Streak[] = [
  { axis: "x", className: "left-24 top-36 w-72", duration: "4.4s", delay: "-0.8s" },
  { axis: "x", className: "left-60 top-84 w-60", duration: "4.9s", delay: "-2.6s" },
  { axis: "x", className: "right-40 top-[33rem] w-72", duration: "4.7s", delay: "-1.9s" },
  { axis: "x", className: "left-96 top-[45rem] w-60", duration: "5.1s", delay: "-3.4s" },
  {
    axis: "x",
    style: { left: "192px", top: "192px", width: "288px" },
    duration: "4.3s",
    delay: "-2.2s",
  },
  {
    axis: "x",
    style: { left: "1104px", top: "384px", width: "240px" },
    duration: "5.5s",
    delay: "-4.7s",
  },
  {
    axis: "x",
    style: { left: "672px", top: "624px", width: "336px" },
    duration: "4.7s",
    delay: "-0.4s",
  },
  {
    axis: "x",
    style: { left: "1248px", top: "768px", width: "288px" },
    duration: "5.8s",
    delay: "-3.1s",
  },
  {
    axis: "x",
    style: { left: "480px", top: "288px", width: "192px" },
    duration: "4.5s",
    delay: "-1.1s",
  },
  {
    axis: "x",
    style: { left: "960px", top: "672px", width: "240px" },
    duration: "5.2s",
    delay: "-2.9s",
  },
  { axis: "y", className: "left-36 top-24 h-60", duration: "4.4s", delay: "-1.3s" },
  { axis: "y", className: "left-[33rem] top-12 h-84", duration: "5.1s", delay: "-3.8s" },
  { axis: "y", className: "right-72 top-60 h-72", duration: "4.6s", delay: "-2.4s" },
  { axis: "y", className: "right-[21rem] top-[30rem] h-48", duration: "4.9s", delay: "-4.5s" },
  {
    axis: "y",
    style: { left: "288px", top: "288px", height: "288px" },
    duration: "4.2s",
    delay: "-0.9s",
  },
  {
    axis: "y",
    style: { left: "720px", top: "144px", height: "240px" },
    duration: "5.6s",
    delay: "-2.8s",
  },
  {
    axis: "y",
    style: { left: "1344px", top: "288px", height: "240px" },
    duration: "4.9s",
    delay: "-1.6s",
  },
  {
    axis: "y",
    style: { left: "1008px", top: "576px", height: "288px" },
    duration: "5.1s",
    delay: "-3.6s",
  },
  {
    axis: "y",
    style: { left: "432px", top: "432px", height: "240px" },
    duration: "4.8s",
    delay: "-2.1s",
  },
  {
    axis: "y",
    style: { left: "1200px", top: "96px", height: "336px" },
    duration: "5.4s",
    delay: "-4.2s",
  },
];

const watermarkMaskStyle = {
  maskImage: "url('/branding/ambra-crystal-floating.svg')",
  maskRepeat: "no-repeat",
  maskPosition: "center",
  maskSize: "contain",
  WebkitMaskImage: "url('/branding/ambra-crystal-floating.svg')",
  WebkitMaskRepeat: "no-repeat",
  WebkitMaskPosition: "center",
  WebkitMaskSize: "contain",
} as CSSProperties;

export function AmbraHeroBackground({
  className,
  gridClassName,
  watermarkClassName,
  watermarkSizeClassName,
  showCenterGlow = true,
  showWatermark = true,
}: AmbraHeroBackgroundProps) {
  const resolvedWatermarkSize = cn(
    "h-80 w-80 md:h-[30rem] md:w-[30rem] xl:h-[38rem] xl:w-[38rem]",
    watermarkSizeClassName
  );

  return (
    <div
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      aria-hidden="true"
    >
      <style>
        {`
          .ambra-hero-grid-pattern {
            background-image:
              linear-gradient(to right, hsl(40 96% 48% / 0.34) 1.5px, transparent 1.5px),
              linear-gradient(to bottom, hsl(40 96% 48% / 0.34) 1.5px, transparent 1.5px);
            background-size: 48px 48px;
            mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, #000 30%, transparent 75%);
          }
          .ambra-hero-grid-streak {
            position: absolute;
            overflow: hidden;
            opacity: 1;
            filter: drop-shadow(0 0 12px hsl(40 96% 48% / 0.82));
          }
          .ambra-hero-grid-streak::before {
            content: "";
            position: absolute;
            inset: 0;
            opacity: 0;
            will-change: transform, opacity;
          }
          .ambra-hero-grid-streak-x {
            height: 2px;
          }
          .ambra-hero-grid-streak-x::before {
            width: 8rem;
            background: linear-gradient(
              90deg,
              transparent 0%,
              hsl(40 96% 48% / 0.05) 10%,
              hsl(40 96% 48% / 0.22) 24%,
              hsl(43 96% 62% / 1) 50%,
              hsl(32 95% 42% / 0.55) 76%,
              hsl(32 95% 42% / 0.08) 90%,
              transparent 100%
            );
            transform: translateX(-135%) scaleX(0.82);
            animation: ambra-hero-grid-current-x var(--streak-duration, 4.8s) linear infinite;
            animation-delay: var(--streak-delay, 0s);
          }
          .ambra-hero-grid-streak-y {
            width: 2px;
          }
          .ambra-hero-grid-streak-y::before {
            height: 8rem;
            background: linear-gradient(
              180deg,
              transparent 0%,
              hsl(40 96% 48% / 0.05) 10%,
              hsl(40 96% 48% / 0.2) 24%,
              hsl(43 96% 62% / 1) 50%,
              hsl(32 95% 42% / 0.5) 76%,
              hsl(32 95% 42% / 0.08) 90%,
              transparent 100%
            );
            transform: translateY(-135%) scaleY(0.82);
            animation: ambra-hero-grid-current-y var(--streak-duration, 4.8s) linear infinite;
            animation-delay: var(--streak-delay, 0s);
          }
          @keyframes ambra-hero-grid-current-x {
            0% {
              opacity: 0;
              transform: translateX(-135%) scaleX(0.82);
            }
            10% {
              opacity: 0.18;
              transform: translateX(-92%) scaleX(0.9);
            }
            20% {
              opacity: 0.9;
              transform: translateX(-45%) scaleX(1);
            }
            34% {
              opacity: 1;
            }
            48% {
              opacity: 0.22;
              transform: translateX(52%) scaleX(0.94);
            }
            58% {
              opacity: 0;
            }
            100% {
              opacity: 0;
              transform: translateX(135%) scaleX(0.82);
            }
          }
          @keyframes ambra-hero-grid-current-y {
            0% {
              opacity: 0;
              transform: translateY(-135%) scaleY(0.82);
            }
            10% {
              opacity: 0.18;
              transform: translateY(-92%) scaleY(0.9);
            }
            20% {
              opacity: 0.9;
              transform: translateY(-45%) scaleY(1);
            }
            34% {
              opacity: 1;
            }
            48% {
              opacity: 0.22;
              transform: translateY(52%) scaleY(0.94);
            }
            58% {
              opacity: 0;
            }
            100% {
              opacity: 0;
              transform: translateY(135%) scaleY(0.82);
            }
          }
        `}
      </style>

      <div className="absolute inset-0 bg-background" />
      <div
        className={cn(
          "ambra-hero-grid-pattern absolute inset-0 z-0 opacity-85 [mask-image:radial-gradient(ellipse_34rem_24rem_at_50%_24%,transparent_0%,transparent_58%,rgba(0,0,0,0.2)_72%,rgba(0,0,0,0.72)_86%,black_100%)]",
          gridClassName
        )}
      />

      <div className="absolute inset-0 z-[1] overflow-hidden">
        {streaks.map((streak, index) => (
          <div
            key={`${streak.axis}-${index}`}
            className={cn(
              "ambra-hero-grid-streak",
              streak.axis === "x" ? "ambra-hero-grid-streak-x" : "ambra-hero-grid-streak-y",
              streak.className
            )}
            style={
              {
                ...streak.style,
                "--streak-duration": streak.duration,
                "--streak-delay": streak.delay,
              } as CSSProperties
            }
          />
        ))}
      </div>

      {showCenterGlow ? (
        <div className="absolute inset-x-0 top-40 z-[2] flex justify-center md:top-44">
          <div className="h-72 w-72 rounded-full bg-background blur-2xl md:h-96 md:w-96 xl:h-[30rem] xl:w-[30rem]" />
        </div>
      ) : null}

      {showWatermark ? (
        <div
          className={cn(
            "absolute inset-x-0 top-0 z-[3] flex justify-center will-change-transform [backface-visibility:hidden] md:-top-4",
            watermarkClassName
          )}
        >
          <div className={cn("relative", resolvedWatermarkSize)}>
            <div className="absolute inset-0 bg-background/96" style={watermarkMaskStyle} />
            <img
              src="/branding/ambra-crystal-floating.svg"
              alt=""
              className={cn("relative opacity-[0.16]", resolvedWatermarkSize)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
