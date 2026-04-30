"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { BrandLoader } from "@/components/branding/brand-loader";

gsap.registerPlugin(ScrollTrigger);

export function HomeIntro() {
  const t = useTranslations("HomePage.parallax");
  const sectionRef = useRef<HTMLDivElement>(null);
  const clipRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const phase1Ref = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const ambraRef = useRef<HTMLSpanElement>(null);
  const systemRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 64px",
          end: "+=250%",
          scrub: 1.2,
          pin: true,
          pinSpacing: true,
        },
      });

      // 0–45%  image reveals
      tl.fromTo(
        clipRef.current,
        { clipPath: "inset(50% 0 50% 0)" },
        { clipPath: "inset(0% 0 0% 0)", ease: "none", duration: 0.45 },
        0
      );
      tl.fromTo(scaleRef.current, { scale: 1.18 }, { scale: 1, ease: "none", duration: 0.45 }, 0);

      // 0–45%  overlay fades to 0.62 — heavy enough to keep everything readable
      tl.fromTo(
        overlayRef.current,
        { opacity: 0.85 },
        { opacity: 0.62, ease: "none", duration: 0.45 },
        0
      );

      // 20–42%  phase 1 slides up to make room, stays visible
      tl.to(phase1Ref.current, { y: -90, ease: "power2.inOut", duration: 0.3 }, 0.2);

      // 38–55%  logo slides up
      tl.fromTo(
        logoRef.current,
        { opacity: 0, y: 70 },
        { opacity: 1, y: 0, ease: "power3.out", duration: 0.25 },
        0.38
      );

      // 50–62%  "Ambra" fades in with upward nudge
      tl.fromTo(
        ambraRef.current,
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, ease: "power2.out", duration: 0.2 },
        0.5
      );

      // 58–68%  "System" fades in slightly after
      tl.fromTo(
        systemRef.current,
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, ease: "power2.out", duration: 0.18 },
        0.58
      );
    });

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef}>
      <div className="relative h-[calc(100vh-4rem)] overflow-hidden">
        {/* clip + scale */}
        <div ref={clipRef} className="absolute inset-0" style={{ clipPath: "inset(50% 0 50% 0)" }}>
          <div
            ref={scaleRef}
            className="absolute inset-0"
            style={{ transform: "scale(1.18)", transformOrigin: "center" }}
          >
            <Image src="/world-map.png" alt="Warehouse" fill className="object-cover" priority />
          </div>
        </div>

        {/* overlay — settles at 0.62 for readable contrast */}
        <div
          ref={overlayRef}
          className="absolute inset-0 bg-background"
          style={{ opacity: 0.85 }}
        />

        {/* top fade */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-background to-transparent z-10" />

        {/* PHASE 1 — slides up, stays visible */}
        <div
          ref={phase1Ref}
          className="absolute inset-x-0 z-20 flex flex-col items-center text-center px-6"
          style={{ top: "22%" }}
        >
          <h2 className="text-5xl md:text-7xl font-bold tracking-tighter max-w-3xl drop-shadow-xl">
            {t("headline1")} <span className="text-gradient-amber">{t("headline2")}</span>
          </h2>
          <p className="mt-4 max-w-md text-lg text-muted-foreground drop-shadow">
            {t("description")}
          </p>
        </div>

        {/* PHASE 2 — bottom 62%, each element staggers in */}
        <div className="absolute inset-x-0 bottom-0 z-20 h-[62%] flex flex-col items-center justify-center gap-5">
          {/* logo */}
          <div ref={logoRef} style={{ opacity: 0 }}>
            <BrandLoader
              variant="beacon_swap"
              showWordmark={false}
              label=""
              logoClassName="h-56 w-56"
              className=""
            />
          </div>

          {/* wordmark — Ambra and System animate separately */}
          <div className="flex flex-col items-center leading-none gap-1">
            <span
              ref={ambraRef}
              className="text-[2.75rem] md:text-[3.5rem] font-semibold tracking-[0.03em] text-foreground"
              style={{ opacity: 0 }}
            >
              <span className="text-amber-500">A</span>mbra
            </span>
            <span
              ref={systemRef}
              className="text-[0.6rem] md:text-[0.72rem] font-semibold uppercase tracking-[0.42em] text-muted-foreground/80 -mt-1"
              style={{ opacity: 0 }}
            >
              System
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
