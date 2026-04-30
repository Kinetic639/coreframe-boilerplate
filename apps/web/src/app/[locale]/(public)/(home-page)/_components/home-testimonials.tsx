"use client";

import { motion } from "framer-motion";
import { Quote } from "lucide-react";
import { useTranslations } from "next-intl";

export function HomeTestimonials() {
  const t = useTranslations("HomePage.testimonials");

  const testimonials = [
    { nameKey: "t1Name", roleKey: "t1Role", companyKey: "t1Company", quoteKey: "t1Quote" },
    { nameKey: "t2Name", roleKey: "t2Role", companyKey: "t2Company", quoteKey: "t2Quote" },
    { nameKey: "t3Name", roleKey: "t3Role", companyKey: "t3Company", quoteKey: "t3Quote" },
  ] as const;

  return (
    <section className="py-24 md:py-32">
      <div className="container mx-auto px-4 sm:px-6">
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
        </motion.div>
        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map(({ nameKey, roleKey, companyKey, quoteKey }, i) => (
            <motion.figure
              key={nameKey}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: i * 0.1, duration: 0.6 }}
              whileHover={{ y: -4 }}
              className="rounded-2xl border border-border/60 bg-card p-8 shadow-soft hover:shadow-glow transition-all relative"
            >
              <Quote className="h-8 w-8 text-primary/30 mb-4" />
              <blockquote className="text-foreground/90 leading-relaxed">{t(quoteKey)}</blockquote>
              <figcaption className="mt-6 pt-6 border-t border-border/60 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-amber flex items-center justify-center text-primary-foreground font-semibold text-sm">
                  {t(nameKey)
                    .split(" ")
                    .map((n: string) => n[0])
                    .join("")}
                </div>
                <div>
                  <p className="font-semibold text-sm">{t(nameKey)}</p>
                  <p className="text-xs text-muted-foreground">
                    {t(roleKey)} · {t(companyKey)}
                  </p>
                </div>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}
