"use client";

import { Button } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";
import { LayoutDashboard } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useUserStore } from "@/lib/stores/user-store";
import type { UserContext } from "@/lib/api/load-user-context-server";

type PublicHeaderAuthProps = {
  userContext: UserContext | null;
};

export function PublicHeaderAuth({ userContext }: PublicHeaderAuthProps) {
  const router = useRouter();
  const { clear } = useUserStore();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    clear();
    router.refresh();
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
        <Button onClick={handleLogout} variant="ghost">
          Wyloguj się
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
