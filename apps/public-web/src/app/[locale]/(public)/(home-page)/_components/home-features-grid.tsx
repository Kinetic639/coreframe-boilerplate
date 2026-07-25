"use client";

import { motion } from "framer-motion";
import { Package, MapPin, RefreshCw, ClipboardCheck, QrCode, Truck } from "lucide-react";
import { useTranslations } from "next-intl";

export function HomeFeaturesGrid() {
  const t = useTranslations("HomePage.features");

  const features = [
    { icon: Package, titleKey: "feat1Title", descKey: "feat1Desc" },
    { icon: MapPin, titleKey: "feat2Title", descKey: "feat2Desc" },
    { icon: RefreshCw, titleKey: "feat3Title", descKey: "feat3Desc" },
    { icon: ClipboardCheck, titleKey: "feat4Title", descKey: "feat4Desc" },
    { icon: QrCode, titleKey: "feat5Title", descKey: "feat5Desc" },
    { icon: Truck, titleKey: "feat6Title", descKey: "feat6Desc" },
  ] as const;

  return (
    <section className="py-24 md:py-32 relative">
      <div className="container mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <span className="inline-block text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-4">
            {t("eyebrow")}
          </span>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">{t("title")}</h2>
          <p className="mt-4 text-lg text-muted-foreground">{t("description")}</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map(({ icon: Icon, titleKey, descKey }, i) => (
            <motion.div
              key={titleKey}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: (i % 3) * 0.08, duration: 0.5 }}
              whileHover={{ y: -4 }}
              className="group relative rounded-2xl border border-border/60 bg-card p-6 shadow-soft hover:shadow-glow transition-all overflow-hidden"
            >
              <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-primary/0 group-hover:bg-primary/10 blur-2xl transition-all duration-500" />
              <div className="relative">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-amber text-primary-foreground shadow-soft mb-5">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{t(titleKey)}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{t(descKey)}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
