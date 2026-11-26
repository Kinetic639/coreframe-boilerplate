"use client";

import { useLocale, useTranslations } from "next-intl";
import { appHomeUrl, appUrl, buildAppChooserUrl, type AmbraWorkApp } from "@repo/app-urls";
import { AppSwitcher } from "@repo/ui/app-switcher";

/** The grid button in the ERP header: the user's other Ambra apps and the public site. */
export function HeaderAppSwitcher({ apps }: { apps: AmbraWorkApp[] }) {
  const t = useTranslations("ambraApps");
  const locale = useLocale() === "en" ? "en" : "pl";

  return (
    <AppSwitcher
      currentApp="erp"
      items={apps.map((id) => ({
        id,
        name: t(`names.${id}`),
        description: t(`descriptions.${id}`),
        href: appHomeUrl(id, locale),
      }))}
      labels={{
        trigger: t("switcher.trigger"),
        title: t("switcher.title"),
        current: t("switcher.current"),
        website: t("switcher.website"),
        chooser: t("switcher.chooser"),
      }}
      chooserHref={buildAppChooserUrl(locale, { force: true })}
      websiteHref={appUrl("site", locale === "en" ? "/en" : "/")}
    />
  );
}
