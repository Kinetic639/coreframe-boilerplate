import { getTranslations } from "next-intl/server";
import { NotificationsClient } from "./_components/notifications-client";

export default async function NotificationsPage() {
  const t = await getTranslations("NotificationsPage");

  return (
    <NotificationsClient
      translations={{
        description: t("description"),
      }}
    />
  );
}
