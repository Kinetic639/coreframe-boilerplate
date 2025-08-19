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
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { fetchInvitationByToken, type InvitationWithDetails } from "@/lib/api/invitations";
import { acceptInvitationAction, rejectInvitationAction } from "@/app/actions/invitations";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";

export default function InvitationPage() {
  const params = useParams();
  const router = useRouter();
  const [user, setUser] = React.useState<any>(null);
  const [userLoading, setUserLoading] = React.useState(true);

  const [invitation, setInvitation] = React.useState<InvitationWithDetails | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [actionLoading, setActionLoading] = React.useState<"accept" | "reject" | null>(null);
  const [actionResult, setActionResult] = React.useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const token = params.token as string;

  const loadInvitation = React.useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);
      setError(null);

      const invitationData = await fetchInvitationByToken(token);

      if (!invitationData) {
        setError("Zaproszenie nie zostało znalezione lub jest nieprawidłowe");
        return;
      }

      setInvitation(invitationData);
    } catch (err) {
      console.error("Error loading invitation:", err);
      setError(err instanceof Error ? err.message : "Nie udało się załadować zaproszenia");
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    loadInvitation();
  }, [loadInvitation]);

  React.useEffect(() => {
    const getUser = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
      setUserLoading(false);
    };
    getUser();
  }, []);

  const handleAcceptInvitation = async () => {
    if (!invitation || !user) return;

    setActionLoading("accept");
    try {
      const result = await acceptInvitationAction(token);

      if (result.success) {
        setActionResult({
          type: "success",
          message: "Zaproszenie zostało zaakceptowane! Zostaniesz przekierowany do dashboardu.",
        });

        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
          router.push("/dashboard");
        }, 2000);
      } else {
        setActionResult({
          type: "error",
          message: result.error || "Nie udało się zaakceptować zaproszenia",
        });
      }
    } catch (error) {
      console.error("Error accepting invitation:", error);
      setActionResult({
        type: "error",
        message: "Wystąpił nieoczekiwany błąd",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectInvitation = async () => {
    if (!invitation) return;

    setActionLoading("reject");
    try {
      const result = await rejectInvitationAction(token);

      if (result.success) {
        setActionResult({
          type: "success",
          message: "Zaproszenie zostało odrzucone.",
        });
      } else {
        setActionResult({
          type: "error",
          message: result.error || "Nie udało się odrzucić zaproszenia",
        });
      }
    } catch (error) {
      console.error("Error rejecting invitation:", error);
      setActionResult({
        type: "error",
        message: "Wystąpił nieoczekiwany błąd",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: { variant: "secondary" as const, icon: Clock, label: "Oczekuje" },
      accepted: { variant: "default" as const, icon: CheckCircle, label: "Zaakceptowane" },
      rejected: { variant: "destructive" as const, icon: XCircle, label: "Odrzucone" },
      expired: { variant: "outline" as const, icon: AlertCircle, label: "Wygasłe" },
      cancelled: { variant: "outline" as const, icon: XCircle, label: "Anulowane" },
    };

    const config = variants[status as keyof typeof variants] || variants.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant}>
        <Icon className="mr-1 h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  if (userLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          <span className="text-lg">Ładowanie zaproszenia...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-red-50 to-pink-100 px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <Card className="border-red-200">
            <CardHeader className="text-center">
              <XCircle className="mx-auto h-12 w-12 text-red-500" />
              <CardTitle className="text-red-900">Błąd zaproszenia</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
              <Button className="mt-4" variant="outline" onClick={() => router.push("/login")}>
                Przejdź do logowania
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (!invitation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <Card>
            <CardHeader className="text-center">
              <AlertCircle className="mx-auto h-12 w-12 text-orange-500" />
              <CardTitle>Zaproszenie nie znalezione</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-muted-foreground">
                Nie udało się znaleźć zaproszenia o podanym tokenie.
              </p>
              <Button className="mt-4" variant="outline" onClick={() => router.push("/login")}>
                Przejdź do logowania
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Check if user needs to be logged in
  if (!user && invitation.status === "pending") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <Card>
            <CardHeader className="text-center">
              <Mail className="mx-auto h-12 w-12 text-blue-500" />
              <CardTitle>Logowanie wymagane</CardTitle>
              <CardDescription>Aby zaakceptować zaproszenie, musisz być zalogowany</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/50 p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Building2 className="h-4 w-4" />
                  {invitation.organization?.name || "Organizacja"}
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  Zaproszenie dla: {invitation.email}
                </div>
              </div>
              <div className="space-y-2">
                <Button className="w-full" onClick={() => router.push("/login")}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Mam już konto - Zaloguj się
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push(`/sign-up?invitation=${token}`)}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Nie mam konta - Zarejestruj się
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Check if invitation is expired
  const expired = isExpired(invitation.expires_at);
  const canAccept = invitation.status === "pending" && !expired && user;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg"
      >
        <Card className="border-blue-200">
          <CardHeader className="text-center">
            <Mail className="mx-auto h-12 w-12 text-blue-500" />
            <CardTitle className="text-2xl">Zaproszenie do organizacji</CardTitle>
            <CardDescription>Zostałeś zaproszony do dołączenia do organizacji</CardDescription>
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

            {/* Invitation Details */}
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/50 p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Organizacja:</span>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {invitation.organization?.name || "Organizacja"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Rola:</span>
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <Badge variant="outline">
                        {invitation.role?.display_name || invitation.role?.name || "Brak roli"}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Oddział:</span>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{invitation.branch?.name || "Brak oddziału"}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Email:</span>
                    <span className="font-mono text-sm">{invitation.email}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Status:</span>
                    {getStatusBadge(invitation.status)}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Wygasa:</span>
                    <div className="text-right">
                      <div className={`text-sm ${expired ? "font-medium text-red-500" : ""}`}>
                        {new Date(invitation.expires_at).toLocaleDateString("pl-PL")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <Calendar className="mr-1 inline h-3 w-3" />
                        {formatDistanceToNow(new Date(invitation.expires_at), {
                          addSuffix: true,
                          locale: pl,
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Warning Messages */}
              {expired && invitation.status === "pending" && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    To zaproszenie wygasło. Skontaktuj się z administratorem organizacji aby
                    otrzymać nowe zaproszenie.
                  </AlertDescription>
                </Alert>
              )}

              {invitation.status !== "pending" && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    To zaproszenie zostało już{" "}
                    {invitation.status === "accepted"
                      ? "zaakceptowane"
                      : invitation.status === "rejected"
                        ? "odrzucone"
                        : invitation.status === "cancelled"
                          ? "anulowane"
                          : "przetworzone"}
                    .
                  </AlertDescription>
                </Alert>
              )}

              {user && invitation.email.toLowerCase() !== user.email.toLowerCase() && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    To zaproszenie zostało wysłane na adres {invitation.email}, ale jesteś
                    zalogowany jako {user.email}. Zaloguj się na właściwe konto aby zaakceptować
                    zaproszenie.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Action Buttons */}
            {canAccept && user && invitation.email.toLowerCase() === user.email.toLowerCase() && (
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleRejectInvitation}
                  disabled={!!actionLoading}
                >
                  {actionLoading === "reject" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="mr-2 h-4 w-4" />
                  )}
                  Odrzuć
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleAcceptInvitation}
                  disabled={!!actionLoading}
                >
                  {actionLoading === "accept" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="mr-2 h-4 w-4" />
                  )}
                  Zaakceptuj
                </Button>
              </div>
            )}

            {!canAccept && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => router.push("/dashboard")}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Przejdź do dashboardu
              </Button>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
