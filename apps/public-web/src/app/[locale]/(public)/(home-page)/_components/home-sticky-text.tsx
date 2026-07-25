"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function HomeStickyText() {
  const t = useTranslations("HomePage.stickyText");
  const ref = useRef<HTMLDivElement>(null);
  const text = t("text");

  useEffect(() => {
    if (!ref.current) return;
    const ctx = gsap.context(() => {
      const words = gsap.utils.toArray<HTMLElement>(".reveal-word");
      gsap.fromTo(
        words,
        { opacity: 0.15 },
        {
          opacity: 1,
          stagger: 0.04,
          ease: "none",
          scrollTrigger: {
            trigger: ref.current,
            start: "top 70%",
            end: "bottom 40%",
            scrub: 0.5,
          },
        }
      );
    }, ref);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={ref} className="py-32 md:py-48 bg-muted/30 border-y border-border/60">
      <div className="container mx-auto px-4 sm:px-6 max-w-5xl">
        <p className="text-3xl md:text-6xl font-bold tracking-tight leading-[1.15]">
          {text.split(" ").map((w, i) => (
            <span key={i} className="reveal-word inline-block mr-3">
              {w}
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}
