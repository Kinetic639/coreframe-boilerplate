"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";

export function HomeParallaxImage() {
  const t = useTranslations("HomePage.parallax");
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-15%", "15%"]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [1.2, 1.05, 1.2]);
  const overlay = useTransform(scrollYProgress, [0, 0.5, 1], [0.7, 0.3, 0.7]);
  const titleY = useTransform(scrollYProgress, [0, 1], ["40%", "-40%"]);

  return (
    <section ref={ref} className="relative h-[80vh] overflow-hidden">
      <motion.div style={{ y, scale }} className="absolute inset-0">
        <Image
          src="/showcase-warehouse-1.jpg"
          alt="Warehouse"
          fill
          className="object-cover"
          loading="lazy"
        />
      </motion.div>
      <motion.div style={{ opacity: overlay }} className="absolute inset-0 bg-background" />
      <div className="absolute inset-0 grid-pattern opacity-30" />
      <div className="relative h-full flex items-center justify-center">
        <motion.div style={{ y: titleY }} className="text-center px-6">
          <h2 className="text-5xl md:text-8xl font-bold tracking-tighter text-white mix-blend-difference">
            {t("headline1")}
            <br />
            {t("headline2")}
          </h2>
          <p className="mt-4 text-white/80 max-w-md mx-auto mix-blend-difference">
            {t("description")}
          </p>
        </motion.div>
      </div>
    </section>
  );
}
