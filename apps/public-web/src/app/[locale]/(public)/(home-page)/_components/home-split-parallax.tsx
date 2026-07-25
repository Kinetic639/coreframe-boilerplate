"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";

export function HomeSplitParallax() {
  const t = useTranslations("HomePage.splitParallax");
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const yA = useTransform(scrollYProgress, [0, 1], ["-20%", "20%"]);
  const yB = useTransform(scrollYProgress, [0, 1], ["20%", "-20%"]);
  const rotateA = useTransform(scrollYProgress, [0, 1], [-3, 3]);
  const rotateB = useTransform(scrollYProgress, [0, 1], [3, -3]);

  return (
    <section ref={ref} className="py-24 md:py-32 overflow-hidden">
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
        <div className="grid grid-cols-2 gap-4 md:gap-8 max-w-5xl mx-auto">
          <motion.div
            style={{ y: yA, rotate: rotateA }}
            className="aspect-[3/4] rounded-2xl overflow-hidden shadow-glow relative"
          >
            <Image
              src="/showcase-qr.jpg"
              alt="QR code scanning"
              fill
              className="object-cover"
              loading="lazy"
            />
          </motion.div>
          <motion.div
            style={{ y: yB, rotate: rotateB }}
            className="aspect-[3/4] rounded-2xl overflow-hidden shadow-glow mt-12 md:mt-24 relative"
          >
            <Image
              src="/showcase-tablet.jpg"
              alt="Tablet interface"
              fill
              className="object-cover"
              loading="lazy"
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
