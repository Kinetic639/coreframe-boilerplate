"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Building2,
  Shield,
  Mail,
  Calendar,
  Clock,
  ExternalLink,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  acceptInvitationAction,
  declineInvitationAction,
} from "@/app/actions/organization/invitations";
import { getMyPendingInvitationsAction } from "@/app/actions/organization/invite-preview";
import { formatDistanceToNow } from "date-fns";
import { pl, enUS } from "date-fns/locale";
import type { InvitePreview, InviteReasonCode } from "@/app/actions/organization/invite-preview";

interface InvitePageClientProps {
  token: string;
  preview: InvitePreview;
  userEmail: string | null;
  locale: string;
}

export function InvitePageClient({ token, preview, userEmail, locale }: InvitePageClientProps) {
  const t = useTranslations("invitationPage");
  const router = useRouter();
  const [actionLoading, setActionLoading] = React.useState(false);
  const [declineLoading, setDeclineLoading] = React.useState(false);
  const [actionResult, setActionResult] = React.useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const dateFnsLocale = locale === "pl" ? pl : enUS;

  const handleAccept = async () => {
    setActionLoading(true);
    try {
      const result = await acceptInvitationAction(token);
      if (result.success) {
        setActionResult({ type: "success", message: t("successMessage") });
        setTimeout(() => router.push("/dashboard/start"), 2000);
      } else {
        setActionResult({
          type: "error",
          message: ("error" in result ? result.error : undefined) || t("errorMessage"),
        });
      }
    } catch {
      setActionResult({ type: "error", message: t("unexpectedError") });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDecline = async () => {
    setDeclineLoading(true);
    try {
      const result = await declineInvitationAction(token);
      if (result.success) {
        // Check if more pending invites remain — route to resolve or onboarding
        const pending = await getMyPendingInvitationsAction();
        if (pending.success && pending.invitations.length > 0) {
          router.push("/invite/resolve");
        } else {
          router.push("/onboarding");
        }
      } else {
        setActionResult({
          type: "error",
          message: result.error || t("declineError"),
        });
      }
    } catch {
      setActionResult({ type: "error", message: t("unexpectedError") });
    } finally {
      setDeclineLoading(false);
    }
  };

  // ─── Helper renderers ────────────────────────────────────────────────────────

  const renderNotFound = () => (
    <Card>
      <CardHeader className="text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-orange-500" />
        <CardTitle>{t("notFoundTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="text-center">
        <p className="text-muted-foreground">{t("notFoundDescription")}</p>
        <Button className="mt-4" variant="outline" asChild>
          <Link href="/sign-in">{t("hasAccount")}</Link>
        </Button>
      </CardContent>
    </Card>
  );

  const renderTerminal = (reasonCode: InviteReasonCode) => {
    const configs: Record<string, { icon: typeof XCircle; titleKey: string; descKey: string }> = {
      INVITE_EXPIRED: { icon: Clock, titleKey: "expiredTitle", descKey: "expiredWarning" },
      INVITE_CANCELLED: {
        icon: XCircle,
        titleKey: "cancelledTitle",
        descKey: "cancelledDescription",
      },
      INVITE_DECLINED: { icon: XCircle, titleKey: "declinedTitle", descKey: "declinedDescription" },
      INVITE_ACCEPTED: {
        icon: CheckCircle,
        titleKey: "acceptedTitle",
        descKey: "acceptedDescription",
      },
      INVITE_INVALID: {
        icon: AlertCircle,
        titleKey: "notFoundTitle",
        descKey: "notFoundDescription",
      },
    };
    const cfg = configs[reasonCode] ?? configs.INVITE_INVALID;
    const Icon = cfg.icon;
    return (
      <Card>
        <CardHeader className="text-center">
          <Icon className="mx-auto h-12 w-12 text-muted-foreground" />
          <CardTitle>{t(cfg.titleKey as Parameters<typeof t>[0])}</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-muted-foreground">{t(cfg.descKey as Parameters<typeof t>[0])}</p>
          <Button className="mt-4" variant="outline" asChild>
            <Link href="/dashboard/start">
              <ExternalLink className="mr-2 h-4 w-4" />
              {t("goToDashboard")}
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  };

  const renderPreviewCard = () => (
    <div className="rounded-lg border bg-muted/50 p-4">
      <div className="space-y-3">
        {preview.org_name && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{t("orgLabel")}</span>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{preview.org_name}</span>
            </div>
          </div>
        )}
        {preview.role_name && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{t("roleLabel")}</span>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <Badge variant="outline">{preview.role_name}</Badge>
            </div>
          </div>
        )}
        {preview.branch_name && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{t("branchLabel")}</span>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{preview.branch_name}</span>
            </div>
          </div>
        )}
        {preview.invited_email && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{t("emailLabel")}</span>
            <span className="font-mono text-sm">{preview.invited_email}</span>
          </div>
        )}
        {preview.expires_at && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{t("expiresLabel")}</span>
            <div className="text-right">
              <div className="text-sm">{new Date(preview.expires_at).toLocaleDateString()}</div>
              <div className="text-xs text-muted-foreground">
                <Calendar className="mr-1 inline h-3 w-3" />
                {formatDistanceToNow(new Date(preview.expires_at), {
                  addSuffix: true,
                  locale: dateFnsLocale,
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // ─── Render by reason code ───────────────────────────────────────────────────

  const bg =
    "flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4";

  if (preview.reason_code === "INVITE_NOT_FOUND") {
    return (
      <div className={bg}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          {renderNotFound()}
        </motion.div>
      </div>
    );
  }

  if (preview.reason_code !== "INVITE_PENDING") {
    return (
      <div className={bg}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          {renderTerminal(preview.reason_code)}
        </motion.div>
      </div>
    );
  }

  // INVITE_PENDING — not authenticated
  if (!userEmail) {
    return (
      <div className={bg}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <Card>
            <CardHeader className="text-center">
              <Mail className="mx-auto h-12 w-12 text-blue-500" />
              <CardTitle>{t("loginRequired")}</CardTitle>
              <CardDescription>
                {preview.inviter_name
                  ? t("loginRequiredDescriptionFrom", {
                      inviterName: preview.inviter_name,
                      orgName: preview.org_name ?? "",
                    })
                  : t("loginRequiredDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {renderPreviewCard()}
              <div className="space-y-2">
                <Button className="w-full" asChild>
                  <Link href={{ pathname: "/sign-in", query: { returnUrl: `/invite/${token}` } }}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    {t("hasAccount")}
                  </Link>
                </Button>
                <Button variant="outline" className="w-full" asChild>
                  <Link href={{ pathname: "/sign-up", query: { invitation: token } }}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    {t("noAccount")}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // INVITE_PENDING — authenticated, email mismatch
  const emailMatch =
    preview.invited_email && preview.invited_email.toLowerCase() === userEmail.toLowerCase();

  // ─── Full invite view (authenticated) ────────────────────────────────────────
  return (
    <div className={bg}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg"
      >
        <Card className="border-blue-200">
          <CardHeader className="text-center">
            <Mail className="mx-auto h-12 w-12 text-blue-500" />
            <CardTitle className="text-2xl">{t("pageTitle")}</CardTitle>
            <CardDescription>{t("pageDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {actionResult && (
              <Alert variant={actionResult.type === "error" ? "destructive" : "default"}>
                {actionResult.type === "error" ? (
                  <AlertCircle className="h-4 w-4" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                <AlertDescription>{actionResult.message}</AlertDescription>
              </Alert>
            )}

            {renderPreviewCard()}

            {!emailMatch && preview.invited_email && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {t("emailMismatch", {
                    invitationEmail: preview.invited_email,
                    userEmail,
                  })}
                </AlertDescription>
              </Alert>
            )}

            {emailMatch ? (
              <div className="space-y-2">
                <Button
                  className="w-full"
                  onClick={handleAccept}
                  disabled={actionLoading || declineLoading || !!actionResult}
                >
                  {actionLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="mr-2 h-4 w-4" />
                  )}
                  {t("acceptButton")}
                </Button>
                <Button
                  variant="ghost"
                  className="w-full text-muted-foreground"
                  onClick={handleDecline}
                  disabled={actionLoading || declineLoading || !!actionResult}
                >
                  {declineLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="mr-2 h-4 w-4" />
                  )}
                  {t("declineButton")}
                </Button>
              </div>
            ) : (
              <Button variant="outline" className="w-full" asChild>
                <Link href="/dashboard/start">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {t("goToDashboard")}
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
