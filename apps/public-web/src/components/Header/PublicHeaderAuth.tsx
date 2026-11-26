"use client";

import { useState } from "react";
import { appUrl, buildSignInUrl } from "@repo/app-urls";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { LayoutDashboard } from "lucide-react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "react-toastify";
import type { UserContextV2 } from "@/lib/stores/v2/user-store";

type PublicHeaderAuthProps = {
  userContext: UserContextV2 | null;
};

/**
 * One sign-in for every Ambra app: the button opens the shared sign-in page in
 * the ERP. Signed-in users (the session is shared across subdomains) go straight
 * to the app instead.
 */
export function PublicHeaderAuth({ userContext }: PublicHeaderAuthProps) {
  const router = useRouter();
  const supabase = createClient();
  const locale = useLocale() === "en" ? "en" : "pl";
  const t = useTranslations("auth.logout");
  const tSuccess = useTranslations("auth.success");
  const tNav = useTranslations("Navigation.buttons");
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await supabase.auth.signOut();
      toast.success(tSuccess("logoutSuccess"));
      router.refresh();
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Failed to log out. Please try again.");
      setIsLoggingOut(false);
    }
  };

  if (userContext?.user) {
    return (
      <>
        <Button asChild className="gap-2">
          <a href={appUrl("erp", "/dashboard/start")} className="flex items-center">
            <LayoutDashboard className="h-4 w-4" />
            {tNav("dashboard")}
          </a>
        </Button>
        <Button onClick={handleLogout} variant="ghost" disabled={isLoggingOut}>
          {isLoggingOut ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" />
              {t("loggingOut")}
            </>
          ) : (
            t("button")
          )}
        </Button>
      </>
    );
  }

  return (
    <Button asChild variant="outline" className="min-w-[132px]">
      <a href={buildSignInUrl(null, locale)}>{tNav("signIn")}</a>
    </Button>
  );
}
