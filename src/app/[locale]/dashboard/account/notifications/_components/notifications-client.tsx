"use client";

import { usePreferencesQuery } from "@/hooks/queries/user-preferences";
import { LoadingSkeleton } from "@/components/v2/feedback/loading-skeleton";
import { NotificationsSection } from "../../preferences/_components/notifications-section";

interface NotificationsClientProps {
  translations: {
    description: string;
  };
}

export function NotificationsClient({ translations }: NotificationsClientProps) {
  const { data: preferences, isLoading } = usePreferencesQuery();

  if (isLoading) {
    return <LoadingSkeleton variant="form" count={1} />;
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{translations.description}</p>
      <div className="grid gap-6 max-w-2xl">
        <NotificationsSection preferences={preferences ?? null} />
      </div>
    </div>
  );
}
