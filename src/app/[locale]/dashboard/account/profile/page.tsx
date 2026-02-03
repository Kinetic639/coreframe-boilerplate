import { getTranslations } from "next-intl/server";
import { ProfileClient } from "./_components/profile-client";

export default async function ProfilePage() {
  const t = await getTranslations("ProfilePage");

  return (
    <ProfileClient
      translations={{
        description: t("description"),
      }}
    />
  );
}
