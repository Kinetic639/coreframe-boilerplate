"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Compass } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

interface OnboardingEntryClientProps {
  userEmail: string;
}

export function OnboardingEntryClient({ userEmail }: OnboardingEntryClientProps) {
  const t = useTranslations("onboardingEntry");

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg"
      >
        <Card>
          <CardHeader className="text-center">
            <Compass className="mx-auto h-12 w-12 text-blue-500" />
            <CardTitle className="text-2xl">{t("title")}</CardTitle>
            <CardDescription>{t("description")}</CardDescription>
            <p className="text-xs text-muted-foreground">{userEmail}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full" asChild>
              <Link href="/dashboard/start">
                <Compass className="mr-2 h-4 w-4" />
                {t("browseDashboardButton")}
              </Link>
            </Button>
            <p className="text-center text-xs text-muted-foreground">{t("createOrgHint")}</p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
