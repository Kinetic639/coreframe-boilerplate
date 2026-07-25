"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

export function HomeStaggerCards() {
  const t = useTranslations("HomePage.staggerCards");

  const cards = [
    { titleKey: "card1Title", descKey: "card1Desc", color: "bg-chart-1/10 text-chart-1" },
    { titleKey: "card2Title", descKey: "card2Desc", color: "bg-chart-2/10 text-chart-2" },
    { titleKey: "card3Title", descKey: "card3Desc", color: "bg-chart-3/10 text-chart-3" },
    { titleKey: "card4Title", descKey: "card4Desc", color: "bg-chart-4/10 text-chart-4" },
    { titleKey: "card5Title", descKey: "card5Desc", color: "bg-chart-5/10 text-chart-5" },
    { titleKey: "card6Title", descKey: "card6Desc", color: "bg-primary/10 text-primary" },
  ] as const;

  return (
    <section className="py-24 md:py-32 relative">
      <div className="container mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-2xl mx-auto mb-14"
        >
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">{t("eyebrow")}</h2>
        </motion.div>
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          variants={{ show: { transition: { staggerChildren: 0.08 } } }}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {cards.map(({ titleKey, descKey, color }) => (
            <motion.div
              key={titleKey}
              variants={{
                hidden: { opacity: 0, y: 40, rotateX: -25 },
                show: {
                  opacity: 1,
                  y: 0,
                  rotateX: 0,
                  transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
                },
              }}
              style={{ transformPerspective: 800 }}
              whileHover={{ y: -6, rotateX: 4, rotateY: 4 }}
              className="rounded-2xl border border-border/60 bg-card p-6 shadow-soft"
            >
              <div
                className={`inline-flex h-10 w-10 rounded-lg items-center justify-center font-mono font-bold text-sm ${color}`}
              >
                {t(titleKey).split(" ")[0]}
              </div>
              <h3 className="mt-4 font-semibold">{t(titleKey)}</h3>
              <p className="text-sm text-muted-foreground mt-1">{t(descKey)}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
