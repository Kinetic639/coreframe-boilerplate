"use client";

import {
  motion,
  useScroll,
  useTransform,
  useMotionValue,
  useMotionValueEvent,
  type MotionValue,
} from "framer-motion";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";

function MotionNumber({ value }: { value: MotionValue<number> }) {
  const [n, setN] = useState(0);
  useMotionValueEvent(value, "change", (v) => setN(Math.round(v)));
  return <>{n}</>;
}

export function HomeScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const width = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);
  const num = useTransform(scrollYProgress, [0, 1], [0, 98]);
  const t = useTranslations("HomePage.stats");

  return (
    <section ref={ref} className="py-24 md:py-32">
      <div className="container mx-auto px-4 sm:px-6 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-2xl mx-auto mb-14"
        >
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">{t("stat4Label")}</h2>
        </motion.div>
        <div className="rounded-3xl border border-border/60 bg-card p-10 shadow-soft">
          <div className="text-center">
            <div className="text-7xl md:text-9xl font-bold text-gradient-amber tabular-nums">
              <MotionNumber value={num} />
              <span className="text-foreground">%</span>
            </div>
            <p className="text-muted-foreground mt-2">{t("stat4Label")}</p>
          </div>
          <div className="mt-10 h-2 bg-muted rounded-full overflow-hidden">
            <motion.div style={{ width }} className="h-full bg-gradient-amber" />
          </div>
        </div>
      </div>
    </section>
  );
}
