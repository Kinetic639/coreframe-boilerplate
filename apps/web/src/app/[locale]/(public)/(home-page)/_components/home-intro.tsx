"use client";

import { type CSSProperties, useLayoutEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { BrandLogoMark } from "@/components/branding";
import { BrandLoader } from "@/components/branding/brand-loader";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

gsap.registerPlugin(ScrollTrigger);

export function HomeIntro() {
  const t = useTranslations("HomePage.hero");
  const headline1 = t("headline1");
  const headline2 = t("headline2");

  const sectionRef = useRef<HTMLElement>(null);
  const revealRef = useRef<HTMLDivElement>(null);
  const revealImageRef = useRef<HTMLDivElement>(null);
  const watermarkRef = useRef<HTMLDivElement>(null);
  const introTextRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const finalStageRef = useRef<HTMLDivElement>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const rightPromptRef = useRef<HTMLParagraphElement>(null);
  const rightButtonRef = useRef<HTMLDivElement>(null);
  const ambraRef = useRef<HTMLSpanElement>(null);
  const systemRef = useRef<HTMLSpanElement>(null);
  const perkRefs = useRef<Array<HTMLSpanElement | null>>([]);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.set(
        [
          watermarkRef.current,
          introTextRef.current,
          badgeRef.current,
          finalStageRef.current,
          leftPanelRef.current,
          rightPanelRef.current,
          rightPromptRef.current,
          rightButtonRef.current,
          ambraRef.current,
          systemRef.current,
        ],
        { force3D: true }
      );
      gsap.set(perkRefs.current.filter(Boolean), { force3D: true });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top+=64",
          end: "+=360%",
          scrub: 0.8,
          pin: true,
          pinSpacing: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
        defaults: { ease: "none" },
      });

      tl.fromTo(
        revealRef.current,
        { clipPath: "inset(50% 0 50% 0)" },
        { clipPath: "inset(0% 0 0% 0)", duration: 0.45 },
        0
      );
      tl.fromTo(revealImageRef.current, { scale: 1.18 }, { scale: 1, duration: 0.45 }, 0);

      tl.fromTo(
        watermarkRef.current,
        { opacity: 1, scale: 1 },
        { opacity: 0, scale: 1.08, duration: 0.36 },
        0.02
      );

      tl.fromTo(
        badgeRef.current,
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.14 },
        0.06
      );

      tl.to(introTextRef.current, { yPercent: -78, duration: 0.34 }, 0.18);
      tl.fromTo(
        finalStageRef.current,
        { opacity: 0, y: 70 },
        { opacity: 1, y: 0, duration: 0.25 },
        0.38
      );
      tl.fromTo(ambraRef.current, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.2 }, 0.5);
      tl.fromTo(
        systemRef.current,
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.18 },
        0.58
      );

      tl.fromTo(
        leftPanelRef.current,
        { opacity: 0, x: -56, y: 12, scale: 0.96 },
        { opacity: 1, x: 0, y: 0, scale: 1, duration: 0.2 },
        0.68
      );
      tl.fromTo(
        perkRefs.current,
        { opacity: 0, x: -18 },
        { opacity: 1, x: 0, duration: 0.16, stagger: 0.04 },
        0.72
      );
      tl.fromTo(
        rightPanelRef.current,
        { opacity: 0, x: 56, y: 12, scale: 0.96 },
        { opacity: 1, x: 0, y: 0, scale: 1, duration: 0.2 },
        0.76
      );
      tl.fromTo(
        rightPromptRef.current,
        { opacity: 0, x: 20, y: 10 },
        { opacity: 1, x: 0, y: 0, duration: 0.14 },
        0.8
      );
      tl.fromTo(
        rightButtonRef.current,
        { opacity: 0, x: 20, y: 12 },
        { opacity: 1, x: 0, y: 0, duration: 0.16 },
        0.84
      );

      tl.to({}, { duration: 0.24 });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="relative">
      <div className="relative h-screen overflow-hidden">
        <div className="absolute inset-0 bg-background" />

        <div className="absolute inset-0 z-0 grid-pattern opacity-85 [mask-image:radial-gradient(ellipse_34rem_24rem_at_50%_24%,transparent_0%,transparent_58%,rgba(0,0,0,0.2)_72%,rgba(0,0,0,0.72)_86%,black_100%)]" />

        <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden">
          <div
            className="home-grid-streak home-grid-streak-x left-24 top-36 w-72"
            style={{
              ["--streak-duration" as string]: "4.4s",
              ["--streak-delay" as string]: "-0.8s",
            }}
          />
          <div
            className="home-grid-streak home-grid-streak-x left-60 top-84 w-60"
            style={{
              ["--streak-duration" as string]: "4.9s",
              ["--streak-delay" as string]: "-2.6s",
            }}
          />
          <div
            className="home-grid-streak home-grid-streak-x right-40 top-[33rem] w-72"
            style={{
              ["--streak-duration" as string]: "4.7s",
              ["--streak-delay" as string]: "-1.9s",
            }}
          />
          <div
            className="home-grid-streak home-grid-streak-x left-96 top-[45rem] w-60"
            style={{
              ["--streak-duration" as string]: "5.1s",
              ["--streak-delay" as string]: "-3.4s",
            }}
          />
          <div
            className="home-grid-streak home-grid-streak-x"
            style={
              {
                left: "192px",
                top: "192px",
                width: "288px",
                ["--streak-duration" as string]: "4.3s",
                ["--streak-delay" as string]: "-2.2s",
              } as CSSProperties
            }
          />
          <div
            className="home-grid-streak home-grid-streak-x"
            style={
              {
                left: "1104px",
                top: "384px",
                width: "240px",
                ["--streak-duration" as string]: "5.5s",
                ["--streak-delay" as string]: "-4.7s",
              } as CSSProperties
            }
          />
          <div
            className="home-grid-streak home-grid-streak-x"
            style={
              {
                left: "672px",
                top: "624px",
                width: "336px",
                ["--streak-duration" as string]: "4.7s",
                ["--streak-delay" as string]: "-0.4s",
              } as CSSProperties
            }
          />
          <div
            className="home-grid-streak home-grid-streak-x"
            style={
              {
                left: "1248px",
                top: "768px",
                width: "288px",
                ["--streak-duration" as string]: "5.8s",
                ["--streak-delay" as string]: "-3.1s",
              } as CSSProperties
            }
          />
          <div
            className="home-grid-streak home-grid-streak-x"
            style={
              {
                left: "480px",
                top: "288px",
                width: "192px",
                ["--streak-duration" as string]: "4.5s",
                ["--streak-delay" as string]: "-1.1s",
              } as CSSProperties
            }
          />
          <div
            className="home-grid-streak home-grid-streak-x"
            style={
              {
                left: "960px",
                top: "672px",
                width: "240px",
                ["--streak-duration" as string]: "5.2s",
                ["--streak-delay" as string]: "-2.9s",
              } as CSSProperties
            }
          />
          <div
            className="home-grid-streak home-grid-streak-y left-36 top-24 h-60"
            style={{
              ["--streak-duration" as string]: "4.4s",
              ["--streak-delay" as string]: "-1.3s",
            }}
          />
          <div
            className="home-grid-streak home-grid-streak-y left-[33rem] top-12 h-84"
            style={{
              ["--streak-duration" as string]: "5.1s",
              ["--streak-delay" as string]: "-3.8s",
            }}
          />
          <div
            className="home-grid-streak home-grid-streak-y right-72 top-60 h-72"
            style={{
              ["--streak-duration" as string]: "4.6s",
              ["--streak-delay" as string]: "-2.4s",
            }}
          />
          <div
            className="home-grid-streak home-grid-streak-y right-[21rem] top-[30rem] h-48"
            style={{
              ["--streak-duration" as string]: "4.9s",
              ["--streak-delay" as string]: "-4.5s",
            }}
          />
          <div
            className="home-grid-streak home-grid-streak-y"
            style={
              {
                left: "288px",
                top: "288px",
                height: "288px",
                ["--streak-duration" as string]: "4.2s",
                ["--streak-delay" as string]: "-0.9s",
              } as CSSProperties
            }
          />
          <div
            className="home-grid-streak home-grid-streak-y"
            style={
              {
                left: "720px",
                top: "144px",
                height: "240px",
                ["--streak-duration" as string]: "5.6s",
                ["--streak-delay" as string]: "-2.8s",
              } as CSSProperties
            }
          />
          <div
            className="home-grid-streak home-grid-streak-y"
            style={
              {
                left: "1344px",
                top: "288px",
                height: "240px",
                ["--streak-duration" as string]: "4.9s",
                ["--streak-delay" as string]: "-1.6s",
              } as CSSProperties
            }
          />
          <div
            className="home-grid-streak home-grid-streak-y"
            style={
              {
                left: "1008px",
                top: "576px",
                height: "288px",
                ["--streak-duration" as string]: "5.1s",
                ["--streak-delay" as string]: "-3.6s",
              } as CSSProperties
            }
          />
          <div
            className="home-grid-streak home-grid-streak-y"
            style={
              {
                left: "432px",
                top: "432px",
                height: "240px",
                ["--streak-duration" as string]: "4.8s",
                ["--streak-delay" as string]: "-2.1s",
              } as CSSProperties
            }
          />
          <div
            className="home-grid-streak home-grid-streak-y"
            style={
              {
                left: "1200px",
                top: "96px",
                height: "336px",
                ["--streak-duration" as string]: "5.4s",
                ["--streak-delay" as string]: "-4.2s",
              } as CSSProperties
            }
          />
        </div>

        <div className="absolute inset-x-0 top-40 z-[2] flex justify-center md:top-44">
          <div className="h-72 w-72 rounded-full bg-background blur-2xl md:h-96 md:w-96 xl:h-[30rem] xl:w-[30rem]" />
        </div>

        <div
          ref={watermarkRef}
          className="pointer-events-none absolute inset-x-0 top-0 z-[3] flex justify-center will-change-transform [backface-visibility:hidden] md:-top-4"
        >
          <div className="relative h-80 w-80 md:h-[30rem] md:w-[30rem] xl:h-[38rem] xl:w-[38rem]">
            <div
              className="absolute inset-0 bg-background/96"
              style={
                {
                  maskImage: "url('/branding/ambra-crystal-floating.svg')",
                  maskRepeat: "no-repeat",
                  maskPosition: "center",
                  maskSize: "contain",
                  WebkitMaskImage: "url('/branding/ambra-crystal-floating.svg')",
                  WebkitMaskRepeat: "no-repeat",
                  WebkitMaskPosition: "center",
                  WebkitMaskSize: "contain",
                } as CSSProperties
              }
            />
            <BrandLogoMark
              size="xl"
              className="relative h-80 w-80 opacity-[0.16] md:h-[30rem] md:w-[30rem] xl:h-[38rem] xl:w-[38rem]"
              priority
            />
          </div>
        </div>

        <div
          ref={revealRef}
          className="absolute inset-0 z-10 will-change-transform [backface-visibility:hidden]"
          style={{ clipPath: "inset(50% 0 50% 0)" }}
        >
          <div
            ref={revealImageRef}
            className="absolute inset-0 will-change-transform [backface-visibility:hidden] dark:brightness-[0.58] dark:contrast-[0.925] dark:saturate-[0.825]"
            style={{ transform: "scale(1.18)", transformOrigin: "center" }}
          >
            <img
              src="/world-map-light.webp"
              alt="Warehouse"
              className="h-full w-full object-cover dark:hidden"
            />
            <img
              src="/world-map.png"
              alt="Warehouse"
              className="hidden h-full w-full object-cover dark:block"
            />
          </div>
        </div>

        <div
          ref={introTextRef}
          className="absolute inset-x-0 top-[31%] z-20 flex flex-col items-center px-6 text-center will-change-transform [backface-visibility:hidden]"
        >
          <div ref={badgeRef} className="mb-5 opacity-0">
            <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground shadow-soft backdrop-blur">
              <Sparkles className="h-3 w-3 text-primary" />
              {t("badge")}
            </span>
          </div>

          <h2 className="max-w-5xl text-4xl font-bold tracking-tight drop-shadow-xl sm:text-5xl md:text-7xl">
            {headline1 === "Twój biznes pod kontrolą" ? (
              <>
                Twój <span className="text-gradient-amber">b</span>iznes pod{" "}
                <span className="text-gradient-amber">k</span>ontrolą
              </>
            ) : (
              headline1
            )}
            {headline2 ? (
              <>
                <br />
                <span className="text-gradient-amber">{headline2}</span>
              </>
            ) : null}
          </h2>
          <p className="mt-6 max-w-2xl text-lg text-foreground/70 drop-shadow md:text-xl dark:text-muted-foreground">
            {t("description")}
          </p>
        </div>

        <div
          ref={finalStageRef}
          className="absolute inset-x-0 bottom-[11%] z-20 flex items-center justify-center px-6"
          style={{ opacity: 0 }}
        >
          <div className="grid w-full max-w-7xl grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-x-24">
            <div
              ref={leftPanelRef}
              className="flex self-start flex-col items-center gap-5 px-2 py-2 text-center lg:items-end lg:pr-10 lg:text-right"
              style={{ opacity: 0 }}
            >
              <div className="flex flex-col items-center gap-2.5 text-sm font-medium text-foreground/70 drop-shadow lg:items-end dark:text-muted-foreground">
                <span
                  ref={(el) => {
                    perkRefs.current[0] = el;
                  }}
                  className="inline-flex cursor-default items-center gap-2 rounded-full px-3 py-1 transition-all duration-300 hover:-translate-y-2 hover:translate-x-1 hover:scale-[1.06] hover:text-foreground hover:drop-shadow-[0_12px_20px_rgba(0,0,0,0.18)]"
                >
                  <ShieldCheck className="h-4 w-4 text-primary" /> {t("perk1")}
                </span>
                <span
                  ref={(el) => {
                    perkRefs.current[1] = el;
                  }}
                  className="inline-flex cursor-default items-center gap-2 rounded-full px-3 py-1 transition-all duration-300 hover:-translate-y-2 hover:translate-x-1 hover:scale-[1.06] hover:text-foreground hover:drop-shadow-[0_12px_20px_rgba(0,0,0,0.18)]"
                >
                  <Zap className="h-4 w-4 text-primary" /> {t("perk2")}
                </span>
                <span
                  ref={(el) => {
                    perkRefs.current[2] = el;
                  }}
                  className="inline-flex cursor-default items-center gap-2 rounded-full px-3 py-1 transition-all duration-300 hover:-translate-y-2 hover:translate-x-1 hover:scale-[1.06] hover:text-foreground hover:drop-shadow-[0_12px_20px_rgba(0,0,0,0.18)]"
                >
                  <Sparkles className="h-4 w-4 text-primary" /> {t("perk3")}
                </span>
              </div>

              <Button
                size="lg"
                className="group h-12 bg-gradient-amber px-7 text-primary-foreground shadow-glow transition-all duration-300 hover:-translate-y-2 hover:translate-x-1 hover:scale-[1.05] hover:shadow-[0_18px_36px_rgba(217,119,6,0.32)] hover:opacity-95"
                asChild
              >
                <Link href="/sign-up">
                  {t("cta1")}
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </div>

            <div className="flex self-start flex-col items-center gap-2 lg:px-4">
              <BrandLoader
                variant="beacon_swap"
                showWordmark={false}
                label=""
                logoClassName="h-56 w-56"
                className=""
              />

              <div className="flex flex-col items-center gap-1 leading-none">
                <span
                  ref={ambraRef}
                  className="text-[2.75rem] font-semibold tracking-[0.03em] text-foreground md:text-[3.5rem]"
                  style={{ opacity: 0 }}
                >
                  <span className="text-amber-500">A</span>mbra
                </span>
                <span
                  ref={systemRef}
                  className="-mt-1 text-[0.6rem] font-semibold uppercase tracking-[0.42em] text-muted-foreground/80 md:text-[0.72rem]"
                  style={{ opacity: 0 }}
                >
                  System
                </span>
              </div>
            </div>

            <div
              ref={rightPanelRef}
              className="flex self-start flex-col items-center gap-4 px-2 py-2 text-center lg:items-start lg:pl-10 lg:text-left"
              style={{ opacity: 0 }}
            >
              <p
                ref={rightPromptRef}
                className="cursor-default rounded-full px-3 py-1 text-sm font-medium text-foreground/70 drop-shadow transition-all duration-300 hover:-translate-y-2 hover:-translate-x-1 hover:scale-[1.05] hover:text-foreground hover:drop-shadow-[0_12px_20px_rgba(0,0,0,0.18)] dark:text-muted-foreground"
              >
                {t("accountPrompt")}
              </p>
              <div ref={rightButtonRef}>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 bg-white/85 px-7 shadow-soft backdrop-blur transition-all duration-300 hover:-translate-y-2 hover:-translate-x-1 hover:scale-[1.05] hover:shadow-[0_18px_34px_rgba(0,0,0,0.18)] dark:bg-background/70"
                  asChild
                >
                  <Link href="/sign-in">{t("cta2")}</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
