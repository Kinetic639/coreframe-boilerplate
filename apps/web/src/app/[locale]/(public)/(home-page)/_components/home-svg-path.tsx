"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

export function HomeSvgPath() {
  const t = useTranslations("HomePage.svgPath");

  const paths = [
    "M 50 150 Q 200 50 400 150",
    "M 400 150 Q 600 50 750 150",
    "M 50 150 Q 200 250 400 150",
    "M 400 150 Q 600 250 750 150",
  ];

  const nodes = [
    { cx: 50, cy: 150, l: t("node1") },
    { cx: 400, cy: 150, l: t("node2") },
    { cx: 750, cy: 150, l: t("node3") },
  ];

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
        <motion.svg
          viewBox="0 0 800 300"
          className="w-full max-w-4xl mx-auto h-auto"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          {paths.map((d, i) => (
            <motion.path
              key={i}
              d={d}
              stroke="hsl(40 96% 48%)"
              strokeWidth="2"
              fill="none"
              variants={{
                hidden: { pathLength: 0, opacity: 0 },
                visible: { pathLength: 1, opacity: 1 },
              }}
              transition={{ duration: 1.4, delay: i * 0.15, ease: "easeInOut" }}
            />
          ))}
          {nodes.map((node, i) => (
            <motion.g
              key={i}
              initial={{ scale: 0, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.6 + i * 0.2, type: "spring", stiffness: 200 }}
            >
              <circle cx={node.cx} cy={node.cy} r="22" fill="hsl(40 96% 48%)" />
              <circle
                cx={node.cx}
                cy={node.cy}
                r="22"
                fill="none"
                stroke="hsl(40 96% 48%)"
                strokeWidth="2"
                opacity="0.3"
              >
                <animate attributeName="r" values="22;40;22" dur="2.4s" repeatCount="indefinite" />
                <animate
                  attributeName="opacity"
                  values="0.3;0;0.3"
                  dur="2.4s"
                  repeatCount="indefinite"
                />
              </circle>
              <text
                x={node.cx}
                y={node.cy + 50}
                textAnchor="middle"
                className="fill-foreground text-sm font-semibold"
                fontSize="14"
              >
                {node.l}
              </text>
            </motion.g>
          ))}
        </motion.svg>
      </div>
    </section>
  );
}
