import { getTranslations } from "next-intl/server";
import { AccountLayoutClient } from "./_components/account-layout-client";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("AccountPage");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
      </div>
      <AccountLayoutClient>{children}</AccountLayoutClient>
    </div>
  );
}
