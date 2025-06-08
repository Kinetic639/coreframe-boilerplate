"use client";

import { InfoIcon } from "lucide-react";
import { useTranslations } from "next-intl";
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
    </div>
  );
}
