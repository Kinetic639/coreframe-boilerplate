"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { HomeCounter } from "./home-counter";

const LOGOS = ["LogiPol", "FoodMax", "MebelHaus", "TechParts", "AgroPL", "RetailGo"];

export function HomeStatsBar() {
  const t = useTranslations("HomePage.stats");

  const stats = [
    { label: t("stat1Label"), value: 500, suffix: "+" },
    { label: t("stat2Label"), value: 2_000_000, suffix: "+" },
    { label: t("stat3Label"), value: 150_000, suffix: "+" },
    { label: t("stat4Label"), value: 98, suffix: "%" },
  ];

  return (
    <section className="border-y border-border/60 bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: i * 0.08, duration: 0.5 }}
              className="text-center"
            >
              <HomeCounter
                to={s.value}
                suffix={s.suffix}
                className="text-3xl md:text-4xl font-bold text-gradient-amber"
              />
              <p className="mt-2 text-xs md:text-sm text-muted-foreground">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HomeLogoMarquee() {
  const t = useTranslations("HomePage.stats");

  return (
    <section className="py-12 border-b border-border/60">
      <p className="text-center text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground mb-8">
        {t("eyebrow")}
      </p>
      <div className="overflow-hidden mask-edges">
        <div className="flex gap-16 marquee whitespace-nowrap">
          {[...LOGOS, ...LOGOS, ...LOGOS].map((l, i) => (
            <span key={i} className="text-2xl font-bold text-muted-foreground/60 tracking-tight">
              {l}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
