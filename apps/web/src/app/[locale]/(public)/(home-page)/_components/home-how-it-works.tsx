"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

export function HomeHowItWorks() {
  const t = useTranslations("HomePage.howItWorks");

  const steps = [
    { nKey: "step1n", titleKey: "step1Title", descKey: "step1Desc" },
    { nKey: "step2n", titleKey: "step2Title", descKey: "step2Desc" },
    { nKey: "step3n", titleKey: "step3Title", descKey: "step3Desc" },
  ] as const;

  return (
    <section className="py-24 md:py-32 bg-muted/30 border-y border-border/60 relative overflow-hidden">
      <div className="absolute inset-0 dot-pattern opacity-40" />
      <div className="container mx-auto px-4 sm:px-6 relative">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <span className="inline-block text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-4">
            {t("eyebrow")}
          </span>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">{t("title")}</h2>
          <p className="mt-4 text-lg text-muted-foreground">{t("description")}</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 relative">
          <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          {steps.map(({ nKey, titleKey, descKey }, i) => (
            <motion.div
              key={nKey}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: i * 0.15, duration: 0.6 }}
              className="relative text-center"
            >
              <div className="mx-auto h-24 w-24 rounded-2xl bg-card border border-border/60 shadow-soft flex items-center justify-center mb-6 relative">
                <span className="text-2xl font-bold text-gradient-amber">{t(nKey)}</span>
                <div className="absolute -inset-1 rounded-2xl bg-gradient-amber opacity-0 hover:opacity-20 blur-xl transition-opacity" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{t(titleKey)}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed max-w-sm mx-auto">
                {t(descKey)}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
