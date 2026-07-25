"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export function HomeCTA() {
  const t = useTranslations("HomePage.cta");

  return (
    <section className="py-24 md:py-32 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-mesh -z-10" />
      <div className="container mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="relative rounded-3xl overflow-hidden border border-border/60 bg-card p-10 md:p-16 text-center shadow-glow"
        >
          <div className="absolute -top-32 -left-32 h-72 w-72 rounded-full bg-primary/30 blur-3xl animate-blob" />
          <div
            className="absolute -bottom-32 -right-32 h-72 w-72 rounded-full bg-chart-4/30 blur-3xl animate-blob"
            style={{ animationDelay: "5s" }}
          />
          <div className="relative">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight max-w-2xl mx-auto">
              {t("title")}
            </h2>
            <p className="mt-5 text-lg text-muted-foreground max-w-xl mx-auto">
              {t("description")}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                size="lg"
                className="bg-gradient-amber text-primary-foreground shadow-glow h-12 px-7 group"
                asChild
              >
                <Link href="/sign-up">
                  {t("cta1")}
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 px-7 backdrop-blur bg-background/40"
                asChild
              >
                <Link href="/pricing">{t("cta2")}</Link>
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
