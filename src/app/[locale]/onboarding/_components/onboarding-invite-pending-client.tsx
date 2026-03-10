"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Mail, Building2, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { signOutAction } from "@/app/[locale]/actions";

interface PendingInvite {
  id: string;
  token: string;
  orgName: string | null;
}

interface Props {
  userEmail: string;
  firstName?: string;
  invites: PendingInvite[];
}

export function OnboardingInvitePendingClient({ userEmail, firstName, invites }: Props) {
  const t = useTranslations("onboardingInvitePending");

  const primaryInvite = invites[0];

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
              <Mail className="h-6 w-6 text-blue-600" />
            </div>
            <CardTitle>
              {firstName ? t("titleWithName", { name: firstName }) : t("title")}
            </CardTitle>
            <CardDescription>{t("description")}</CardDescription>
            <p className="text-xs text-muted-foreground">
              {t("signedInAs")} <span className="font-medium">{userEmail}</span>
            </p>
          </CardHeader>

          <CardContent className="space-y-3">
            {/* Pending invitations list */}
            <div className="space-y-2">
              {invites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <Building2 className="h-4 w-4 shrink-0 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-blue-900">
                        {invite.orgName ?? t("unknownOrg")}
                      </p>
                      <p className="text-xs text-blue-600">{t("inviteHint")}</p>
                    </div>
                  </div>
                  <Button size="sm" asChild>
                    <Link href={`/invite/${invite.token}` as any}>
                      {t("reviewButton")} <ChevronRight className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              ))}
            </div>

            {/* Extra invites count */}
            {invites.length > 1 && (
              <p className="text-center text-xs text-muted-foreground">
                {t("moreInvites", { count: invites.length - 1 })}
              </p>
            )}

            {/* Review primary invite CTA */}
            {invites.length === 1 && (
              <Button className="w-full" asChild>
                <Link href={`/invite/${primaryInvite.token}` as any}>
                  <Mail className="mr-2 h-4 w-4" />
                  {t("reviewButton")}
                </Link>
              </Button>
            )}

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">{t("orSeparator")}</span>
              </div>
            </div>

            {/* Secondary: sign out */}
            <form action={signOutAction}>
              <Button variant="outline" className="w-full" type="submit">
                {t("signOutButton")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
