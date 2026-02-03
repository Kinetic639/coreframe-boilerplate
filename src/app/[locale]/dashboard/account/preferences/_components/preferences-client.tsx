"use client";

import { usePreferencesQuery } from "@/hooks/queries/user-preferences";
import { LoadingSkeleton } from "@/components/v2/feedback/loading-skeleton";
import { AppearanceSection } from "./appearance-section";
import { RegionalSection } from "./regional-section";
import { NotificationsSection } from "./notifications-section";

interface PreferencesClientProps {
  translations: {
    description: string;
  };
}

export function PreferencesClient({ translations }: PreferencesClientProps) {
  const { data: preferences, isLoading } = usePreferencesQuery();

  if (isLoading) {
    return <LoadingSkeleton variant="form" count={3} />;
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{translations.description}</p>
      <div className="grid gap-6 max-w-2xl">
        <AppearanceSection />
        <RegionalSection preferences={preferences ?? null} />
        <NotificationsSection preferences={preferences ?? null} />
      </div>
    </div>
  );
}
