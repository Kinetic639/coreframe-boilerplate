"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Sparkles, Activity, BarChart3, Globe } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function HomeHorizontalScroll() {
  const t = useTranslations("HomePage.horizontalScroll");
  const wrapper = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);

  const panels = [
    {
      titleKey: "panel1Title",
      descKey: "panel1Desc",
      stepKey: "panel1Step",
      color: "from-primary to-chart-2",
      icon: Sparkles,
    },
    {
      titleKey: "panel2Title",
      descKey: "panel2Desc",
      stepKey: "panel2Step",
      color: "from-chart-2 to-chart-3",
      icon: Activity,
    },
    {
      titleKey: "panel3Title",
      descKey: "panel3Desc",
      stepKey: "panel3Step",
      color: "from-chart-3 to-chart-4",
      icon: BarChart3,
    },
    {
      titleKey: "panel4Title",
      descKey: "panel4Desc",
      stepKey: "panel4Step",
      color: "from-chart-4 to-chart-5",
      icon: Globe,
    },
  ] as const;

  useEffect(() => {
    if (!wrapper.current || !track.current) return;
    const ctx = gsap.context(() => {
      const sections = gsap.utils.toArray<HTMLElement>(".h-panel");
      gsap.to(sections, {
        xPercent: -100 * (sections.length - 1),
        ease: "none",
        scrollTrigger: {
          trigger: wrapper.current,
          pin: true,
          scrub: 1,
          end: () => "+=" + (track.current?.offsetWidth ?? 0),
          invalidateOnRefresh: true,
        },
      });
    }, wrapper);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={wrapper} className="relative overflow-hidden bg-background">
      <div className="container mx-auto px-4 sm:px-6 pt-24 pb-4">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">{t("eyebrow")}</h2>
        </div>
      </div>
      <div ref={track} className="flex h-[80vh] w-[400vw]">
        {panels.map(({ titleKey, descKey, stepKey, color, icon: Icon }) => (
          <div
            key={titleKey}
            className={`h-panel relative w-screen h-full flex items-center justify-center bg-gradient-to-br ${color}`}
          >
            <div className="absolute inset-0 grid-pattern opacity-20" />
            <div className="relative text-center text-white px-6">
              <div className="inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-white/15 backdrop-blur border border-white/30 mb-6">
                <Icon className="h-10 w-10" />
              </div>
              <p className="text-sm uppercase tracking-[0.3em] opacity-80">{t(stepKey)}</p>
              <h3 className="mt-2 text-6xl md:text-8xl font-bold tracking-tighter">
                {t(titleKey)}
              </h3>
              <p className="mt-4 max-w-md mx-auto text-lg opacity-90">{t(descKey)}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
