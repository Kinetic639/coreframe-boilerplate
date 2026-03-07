"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Compass, Mail, LogOut } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { signOutAction } from "@/app/[locale]/actions";

interface OnboardingEntryClientProps {
  userEmail: string;
  firstName?: string;
  pendingInviteToken: string | null;
}

export function OnboardingEntryClient({
  userEmail,
  firstName,
  pendingInviteToken,
}: OnboardingEntryClientProps) {
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
            <CardTitle className="text-2xl">
              {firstName ? t("titleWithName", { name: firstName }) : t("title")}
            </CardTitle>
            <CardDescription>{t("description")}</CardDescription>
            <p className="text-xs text-muted-foreground">
              {t("signedInAs")} <span className="font-medium">{userEmail}</span>
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingInviteToken ? (
              <>
                <div className="rounded-md bg-blue-50 px-4 py-3 text-sm text-blue-700">
                  <Mail className="mb-1 inline-block h-4 w-4 mr-1" />
                  {t("pendingInviteHint")}
                </div>
                <Button className="w-full" asChild>
                  {}
                  <Link href={`/invite/${pendingInviteToken}` as any}>
                    <Mail className="mr-2 h-4 w-4" />
                    {t("reviewInviteButton")}
                  </Link>
                </Button>
              </>
            ) : (
              <p className="text-center text-xs text-muted-foreground">{t("createOrgHint")}</p>
            )}

            <form action={signOutAction}>
              <Button variant="outline" className="w-full" type="submit">
                <LogOut className="mr-2 h-4 w-4" />
                {t("signOutButton")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
