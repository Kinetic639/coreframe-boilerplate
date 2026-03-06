"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, Shield, Calendar, Mail, ArrowRight, SkipForward } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { formatDistanceToNow } from "date-fns";
import type { PendingInviteItem } from "@/app/actions/organization/invite-preview";

interface InviteResolveClientProps {
  invitations: PendingInviteItem[];
  userEmail: string;
  skipHref: string;
}

function InviteCard({ inv }: { inv: PendingInviteItem }) {
  const t = useTranslations("inviteResolvePage");

  return (
    <Card className="border-blue-200">
      <CardContent className="pt-4">
        <div className="space-y-2">
          {inv.org_name && (
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{inv.org_name}</span>
            </div>
          )}
          {inv.role_name && (
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <Badge variant="outline">{inv.role_name}</Badge>
            </div>
          )}
          {inv.branch_name && (
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{inv.branch_name}</span>
            </div>
          )}
          {inv.expires_at && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {t("expiresLabel")}{" "}
              {formatDistanceToNow(new Date(inv.expires_at), { addSuffix: true })}
            </div>
          )}
        </div>
        <Button className="mt-4 w-full" asChild>
          <Link
            href={{
              pathname: "/invite/[token]",
              params: { token: inv.token },
            }}
          >
            <ArrowRight className="mr-2 h-4 w-4" />
            {t("joinButton")}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function InviteResolveClient({
  invitations,
  userEmail,
  skipHref,
}: InviteResolveClientProps) {
  const t = useTranslations("inviteResolvePage");
  const isSingle = invitations.length === 1;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg"
      >
        <Card>
          <CardHeader className="text-center">
            <Mail className="mx-auto h-12 w-12 text-blue-500" />
            <CardTitle>{t("title")}</CardTitle>
            <CardDescription>
              {isSingle ? t("singleInviteDescription") : t("multipleInviteDescription")}
            </CardDescription>
            <p className="text-xs text-muted-foreground">{userEmail}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {invitations.map((inv) => (
              <InviteCard key={inv.id} inv={inv} />
            ))}

            <div className="border-t pt-4">
              <Button variant="ghost" className="w-full text-muted-foreground" asChild>
                <Link href={skipHref as Parameters<typeof Link>[0]["href"]}>
                  <SkipForward className="mr-2 h-4 w-4" />
                  {t("skipButton")}
                </Link>
              </Button>
              <p className="mt-2 text-center text-xs text-muted-foreground">{t("skipHint")}</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
