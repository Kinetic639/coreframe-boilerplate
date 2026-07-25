"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export function HomePricingTeaser() {
  const t = useTranslations("HomePage.pricing");

  const plans: Array<{
    nameKey: "plan1Name" | "plan2Name" | "plan3Name";
    priceKey: "plan1Price" | "plan2Price" | "plan3Price";
    descKey: "plan1Desc" | "plan2Desc" | "plan3Desc";
    popular: boolean;
    badgeKey?: "plan2Badge";
  }> = [
    { nameKey: "plan1Name", priceKey: "plan1Price", descKey: "plan1Desc", popular: false },
    {
      nameKey: "plan2Name",
      priceKey: "plan2Price",
      descKey: "plan2Desc",
      popular: true,
      badgeKey: "plan2Badge",
    },
    { nameKey: "plan3Name", priceKey: "plan3Price", descKey: "plan3Desc", popular: false },
  ];

  const perks = ["perk1", "perk2", "perk3"] as const;

  return (
    <section className="py-24 md:py-32 bg-muted/30 border-y border-border/60">
      <div className="container mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-2xl mx-auto mb-12"
        >
          <span className="inline-block text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-4">
            {t("eyebrow")}
          </span>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">{t("title")}</h2>
        </motion.div>
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map(({ nameKey, priceKey, descKey, popular, badgeKey }, i) => (
            <motion.div
              key={nameKey}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className={`rounded-2xl border bg-card p-8 shadow-soft relative ${popular ? "border-primary shadow-glow scale-105" : "border-border/60"}`}
            >
              {popular && badgeKey && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-amber text-primary-foreground text-xs font-semibold">
                  {t(badgeKey)}
                </span>
              )}
              <h3 className="text-lg font-semibold">{t(nameKey)}</h3>
              <p className="text-sm text-muted-foreground mt-1">{t(descKey)}</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-5xl font-bold">{t(priceKey)}</span>
                <span className="text-muted-foreground">{t("currency")}</span>
              </div>
              <ul className="mt-6 space-y-2 text-sm">
                {perks.map((perk) => (
                  <li key={perk} className="flex gap-2">
                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    {t(perk)}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
        <div className="text-center mt-10">
          <Button variant="outline" size="lg" asChild>
            <Link href="/pricing">{t("ctaLabel")}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
