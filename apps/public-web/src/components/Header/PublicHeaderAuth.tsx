"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { LayoutDashboard } from "lucide-react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import type { UserContextV2 } from "@/lib/stores/v2/user-store";
import { AnimatePresence, motion } from "framer-motion";

type PublicHeaderAuthProps = {
  userContext: UserContextV2 | null;
};

function LoginDropdownButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onFocus={() => setIsOpen(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsOpen(false);
        }
      }}
    >
      <Button
        type="button"
        variant="outline"
        className="min-w-[132px]"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        Logowanie
      </Button>

      <AnimatePresence>
        {isOpen ? (
          <motion.div
            role="menu"
            className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-xl"
            initial={{ opacity: 0, y: -8, scale: 0.96, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -6, scale: 0.98, filter: "blur(4px)" }}
            transition={{ type: "spring", stiffness: 440, damping: 32, mass: 0.75 }}
          >
            <motion.a
              role="menuitem"
              href="https://app.ambra-system.com/sign-in"
              className="block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.03, duration: 0.16 }}
            >
              Ambra ERP
            </motion.a>
            <motion.a
              role="menuitem"
              href="https://vmi.ambra-system.com/sign-in"
              className="block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.07, duration: 0.16 }}
            >
              VMI portal
            </motion.a>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function PublicHeaderAuth({ userContext }: PublicHeaderAuthProps) {
  const router = useRouter();
  const supabase = createClient();
  const t = useTranslations("auth.logout");
  const tSuccess = useTranslations("auth.success");
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

  // User is logged in (SSR context available)
  if (userContext?.user) {
    return (
      <>
        <Button asChild className="gap-2">
          <a href="https://app.ambra-system.com/dashboard/start" className="flex items-center">
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
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

  // User is not logged in
  return <LoginDropdownButton />;
}
