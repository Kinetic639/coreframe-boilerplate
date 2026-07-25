"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";

export function HomeCardStack() {
  const t = useTranslations("HomePage.cardStack");
  const [i, setI] = useState(0);

  const stack = [
    { titleKey: "card1Title", descKey: "card1Desc", color: "from-primary to-chart-2" },
    { titleKey: "card2Title", descKey: "card2Desc", color: "from-chart-2 to-chart-3" },
    { titleKey: "card3Title", descKey: "card3Desc", color: "from-chart-3 to-chart-4" },
    { titleKey: "card4Title", descKey: "card4Desc", color: "from-chart-4 to-chart-5" },
  ] as const;

  useEffect(() => {
    const interval = setInterval(() => setI((v) => (v + 1) % stack.length), 2800);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="py-24 md:py-32 overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-2xl mx-auto mb-14"
        >
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">{t("eyebrow")}</h2>
          <p className="mt-4 text-lg text-muted-foreground">{t("description")}</p>
        </motion.div>
        <div className="relative h-72 max-w-md mx-auto">
          <AnimatePresence>
            {stack.map((s, idx) => {
              const offset = (idx - i + stack.length) % stack.length;
              if (offset > 2) return null;
              return (
                <motion.div
                  key={s.titleKey}
                  initial={{ opacity: 0, y: -40, scale: 0.9 }}
                  animate={{
                    opacity: 1 - offset * 0.3,
                    y: offset * 14,
                    scale: 1 - offset * 0.05,
                    zIndex: stack.length - offset,
                  }}
                  exit={{ opacity: 0, x: 200, transition: { duration: 0.4 } }}
                  transition={{ type: "spring", stiffness: 260, damping: 28 }}
                  className={`absolute inset-x-0 rounded-2xl bg-gradient-to-br ${s.color} text-white p-6 shadow-glow border border-white/20`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur grid place-items-center">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold">{t(s.titleKey)}</p>
                      <p className="text-sm opacity-90">{t(s.descKey)}</p>
                    </div>
                  </div>
                  <div className="mt-4 h-1 bg-white/20 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 2.6 }}
                      className="h-full bg-white"
                    />
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
