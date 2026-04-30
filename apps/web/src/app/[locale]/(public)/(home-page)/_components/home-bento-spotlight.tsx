"use client";

import { motion, useMotionValue, useTransform } from "framer-motion";
import { useRef } from "react";
import { useTranslations } from "next-intl";
import { Globe } from "lucide-react";
import Image from "next/image";

function SpotlightCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const bg = useTransform<number, string>(
    [mx, my],
    ([x, y]) =>
      `radial-gradient(400px circle at ${x}px ${y}px, hsl(40 96% 48% / 0.18), transparent 40%)`
  );

  return (
    <div
      ref={ref}
      onMouseMove={(e) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        mx.set(e.clientX - r.left);
        my.set(e.clientY - r.top);
      }}
      className={`group relative overflow-hidden rounded-2xl border border-border/60 bg-card shadow-soft hover:shadow-glow transition-all ${className}`}
    >
      <motion.div
        className="pointer-events-none absolute -inset-px opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: bg }}
      />
      {children}
    </div>
  );
}

export function HomeBentoSpotlight() {
  const t = useTranslations("HomePage.bento");

  return (
    <section className="py-24 md:py-32 bg-muted/30 border-y border-border/60">
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
        <div className="grid md:grid-cols-3 gap-5 max-w-6xl mx-auto auto-rows-[180px]">
          <SpotlightCard className="md:col-span-2 md:row-span-2 p-8 flex flex-col justify-end">
            <Image
              src="/showcase-isometric.jpg"
              alt="Supply network"
              fill
              className="object-cover opacity-60 group-hover:opacity-80 transition-opacity"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
            <div className="relative">
              <h3 className="text-3xl font-bold tracking-tight">{t("cell1Title")}</h3>
              <p className="text-muted-foreground mt-2 max-w-md">{t("cell1Desc")}</p>
            </div>
          </SpotlightCard>
          <SpotlightCard className="p-6">
            <div className="text-4xl font-bold text-gradient-amber">{t("cell2Value")}</div>
            <p className="text-sm text-muted-foreground mt-2">{t("cell2Label")}</p>
          </SpotlightCard>
          <SpotlightCard className="p-6">
            <Globe className="h-6 w-6 text-primary mb-3" />
            <h4 className="font-semibold">{t("cell3Title")}</h4>
            <p className="text-xs text-muted-foreground mt-1">{t("cell3Desc")}</p>
          </SpotlightCard>
          <SpotlightCard className="md:col-span-2 p-6 flex items-center gap-6">
            <div className="flex-1">
              <h4 className="font-semibold">{t("cell4Title")}</h4>
              <p className="text-xs text-muted-foreground mt-1">{t("cell4Desc")}</p>
            </div>
            <div className="flex gap-1.5">
              {[...Array(8)].map((_, i) => (
                <motion.div
                  key={i}
                  animate={{ scaleY: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.1 }}
                  className="w-1.5 h-10 rounded-full bg-gradient-amber origin-bottom"
                />
              ))}
            </div>
          </SpotlightCard>
        </div>
      </div>
    </section>
  );
}
