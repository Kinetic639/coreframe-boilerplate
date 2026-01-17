"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";
import { LayoutDashboard, Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useUserStore } from "@/lib/stores/user-store";
import type { UserContext } from "@/lib/api/load-user-context-server";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";

type PublicHeaderAuthProps = {
  userContext: UserContext | null;
};

export function PublicHeaderAuth({ userContext }: PublicHeaderAuthProps) {
  const router = useRouter();
  const { clear } = useUserStore();
  const supabase = createClient();
  const t = useTranslations("auth.logout");
  const tSuccess = useTranslations("auth.success");
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await supabase.auth.signOut();
      clear();
      toast.success(tSuccess("logoutSuccess"));
      router.refresh();
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Failed to log out. Please try again.");
      setIsLoggingOut(false);
    }
  };

  // User is logged in (SSR context available)
  if (userContext?.user) {
    return (
      <>
        <Button asChild className="gap-2">
          <Link href="/dashboard-old/start" className="flex items-center">
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Link>
        </Button>
        <Button onClick={handleLogout} variant="ghost" disabled={isLoggingOut}>
          {isLoggingOut ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("loggingOut")}
            </>
          ) : (
            t("button")
          )}
        </Button>
      </>
    );
  }

  // User is not logged in
  return (
    <>
      <Button variant="outline" asChild>
        <Link href="/sign-in">Zaloguj się</Link>
      </Button>
      <Button asChild>
        <Link href="/sign-up">Rozpocznij za darmo</Link>
      </Button>
    </>
  );
}
