"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { ArrowRight, Sparkles, ShieldCheck, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export function HomeHero() {
  const t = useTranslations("HomePage.hero");
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const yMock = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const opacityMock = useTransform(scrollYProgress, [0, 0.8], [1, 0.4]);
  const yBlob = useTransform(scrollYProgress, [0, 1], [0, -80]);

  const navItems = [
    t("mockupNav1"),
    t("mockupNav2"),
    t("mockupNav3"),
    t("mockupNav4"),
    t("mockupNav5"),
    t("mockupNav6"),
    t("mockupNav7"),
  ];

  const stats = [
    { l: t("mockupStat1Label"), v: t("mockupStat1Value"), c: "text-primary" },
    { l: t("mockupStat2Label"), v: t("mockupStat2Value"), c: "text-chart-3" },
    { l: t("mockupStat3Label"), v: t("mockupStat3Value"), c: "" },
    { l: t("mockupStat4Label"), v: t("mockupStat4Value"), c: "" },
  ];

  const rows = [
    { sku: "AMB-001", n: t("mockupRow1Name"), loc: "A-12-3", q: 142 },
    { sku: "AMB-024", n: t("mockupRow2Name"), loc: "B-04-1", q: 38 },
    { sku: "AMB-117", n: t("mockupRow3Name"), loc: "C-02-2", q: 256 },
    { sku: "AMB-203", n: t("mockupRow4Name"), loc: "D-08-4", q: 12 },
  ];

  return (
    <section ref={ref} className="relative overflow-hidden pt-20 pb-24 md:pt-28 md:pb-32">
      <div className="absolute inset-0 -z-10 bg-gradient-mesh" />
      <div className="absolute inset-0 -z-10 grid-pattern opacity-60" />
      <motion.div
        style={{ y: yBlob }}
        className="absolute -top-32 -right-32 -z-10 h-[500px] w-[500px] rounded-full bg-primary/20 blur-3xl animate-blob"
      />
      <motion.div
        style={{ y: yBlob }}
        className="absolute -bottom-40 -left-32 -z-10 h-[500px] w-[500px] rounded-full bg-chart-4/20 blur-3xl animate-blob [animation-delay:4s]"
      />

      <div className="container mx-auto px-4 sm:px-6 relative">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex justify-center mb-6"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 backdrop-blur px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" />
            {t("badge")}
          </span>
        </motion.div>

        <div className="text-center max-w-4xl mx-auto">
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.05 }}
            className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight leading-[1.05]"
          >
            {t("headline1")}
            <br />
            <span className="text-gradient-amber">{t("headline2")}</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto"
          >
            {t("description")}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25 }}
            className="mt-10 flex flex-col sm:flex-row gap-3 justify-center"
          >
            <Button
              size="lg"
              className="bg-gradient-amber text-primary-foreground shadow-glow hover:opacity-95 group h-12 px-7"
              asChild
            >
              <Link href="/sign-up">
                {t("cta1")}
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 px-7 backdrop-blur bg-background/40"
              asChild
            >
              <Link href="/sign-in">{t("cta2")}</Link>
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground"
          >
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" /> {t("perk1")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-primary" /> {t("perk2")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> {t("perk3")}
            </span>
          </motion.div>
        </div>

        {/* App mockup */}
        <motion.div
          style={{ y: yMock, opacity: opacityMock }}
          initial={{ opacity: 0, y: 60, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="mt-16 mx-auto max-w-5xl"
        >
          <div className="rounded-2xl border border-border/60 bg-card shadow-glow overflow-hidden">
            <div className="flex items-center gap-2 px-4 h-10 border-b border-border/60 bg-muted/50">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-destructive/60" />
                <div className="h-3 w-3 rounded-full bg-primary/60" />
                <div className="h-3 w-3 rounded-full bg-chart-2/60" />
              </div>
              <div className="flex-1 mx-4 h-6 rounded-md bg-background/60 border border-border/60 flex items-center px-3 text-[10px] text-muted-foreground">
                {t("mockupUrl")}
              </div>
            </div>
            <div className="grid grid-cols-12 min-h-[420px]">
              <div className="col-span-3 border-r border-border/60 bg-sidebar p-4 space-y-3">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-5 w-5 rounded bg-gradient-amber" />
                  <span className="text-xs font-bold">{t("mockupLabel")}</span>
                </div>
                {navItems.map((label, i) => (
                  <div
                    key={label}
                    className={`h-8 rounded-md flex items-center px-3 text-xs ${i === 1 ? "bg-primary/15 text-primary font-medium" : "text-muted-foreground"}`}
                  >
                    {label}
                  </div>
                ))}
              </div>
              <div className="col-span-9 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold">{t("mockupNav2")}</h3>
                    <p className="text-[10px] text-muted-foreground">{t("mockupSubtitle")}</p>
                  </div>
                  <div className="flex gap-2">
                    <div className="h-8 w-32 rounded-md border border-border/60 bg-background" />
                    <div className="h-8 w-24 rounded-md bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-medium">
                      {t("mockupAddBtn")}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {stats.map((s) => (
                    <motion.div
                      key={s.l}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.8 + Math.random() * 0.4 }}
                      className="rounded-lg border border-border/60 p-3 bg-background/40"
                    >
                      <p className="text-[10px] text-muted-foreground">{s.l}</p>
                      <p className={`text-lg font-bold ${s.c}`}>{s.v}</p>
                    </motion.div>
                  ))}
                </div>
                <div className="rounded-lg border border-border/60 overflow-hidden">
                  <div className="grid grid-cols-5 gap-2 px-4 py-2 bg-muted/40 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    <span>{t("mockupTableSKU")}</span>
                    <span className="col-span-2">{t("mockupTableName")}</span>
                    <span>{t("mockupTableLoc")}</span>
                    <span className="text-right">{t("mockupTableQty")}</span>
                  </div>
                  {rows.map((r, i) => (
                    <motion.div
                      key={r.sku}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 1 + i * 0.08 }}
                      className="grid grid-cols-5 gap-2 px-4 py-2.5 text-xs border-t border-border/40"
                    >
                      <span className="font-mono text-muted-foreground">{r.sku}</span>
                      <span className="col-span-2">{r.n}</span>
                      <span className="font-mono text-primary">{r.loc}</span>
                      <span className="text-right font-medium">{r.q}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
