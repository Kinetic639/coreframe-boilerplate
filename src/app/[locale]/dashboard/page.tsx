"use client";

import { Button } from "@/components/ui/button";
import { InfoIcon, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useUserStore } from "@/lib/stores/user-store";

export default function ProtectedPage() {
  const t = useTranslations("ProtectedPage");

  const user = useUserStore((s) => s.user);
  const preferences = useUserStore((s) => s.preferences);
  const roles = useUserStore((s) => s.roles);

  return (
    <div className="flex w-full flex-1 flex-col gap-6">
      <div className="w-full">
        <div className="flex items-center gap-3 rounded-md bg-accent p-3 px-5 text-sm text-foreground">
          <InfoIcon size={16} strokeWidth={2} />
          {t("protectedMessage")}
        </div>
        <pre className="text-xs">{JSON.stringify({ user, preferences, roles }, null, 2)}</pre>
      </div>

      {true && (
        <div className="my-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <ShieldCheck size={16} />
            Admin Access
          </div>
          <Button asChild>
            <Link href="/dashboard/admin-dashboard">Access Admin Dashboard</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
