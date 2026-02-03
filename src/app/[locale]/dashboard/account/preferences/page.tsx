import { getTranslations } from "next-intl/server";
import { PreferencesClient } from "./_components/preferences-client";

export default async function PreferencesPage() {
  const t = await getTranslations("PreferencesPage");

  return (
    <PreferencesClient
      translations={{
        description: t("description"),
      }}
    />
  );
}
