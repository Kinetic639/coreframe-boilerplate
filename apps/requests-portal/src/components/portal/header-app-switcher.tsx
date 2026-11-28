"use client";

import { useEffect, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  appHomeUrl,
  appUrl,
  DEFAULT_APP_COOKIE,
  effectiveDefaultApp,
  LAST_APP_COOKIE,
  OPEN_LAST_APP_COOKIE,
  type AmbraWorkApp,
} from "@repo/app-urls";
import { AppSwitcher } from "@repo/ui/app-switcher";
import { setDefaultAppAction } from "@/app/actions/default-app";

function readCookie(name: string): string | null {
  const prefix = `${name}=`;
  const entry = document.cookie.split("; ").find((part) => part.startsWith(prefix));
  return entry ? decodeURIComponent(entry.slice(prefix.length)) : null;
}

/** The grid button in the portal header: the user's other Ambra apps and the public site. */
export function HeaderAppSwitcher({ apps }: { apps: AmbraWorkApp[] }) {
  const t = useTranslations("ambraApps");
  const locale = useLocale() === "en" ? "en" : "pl";
  const [defaultApp, setDefaultApp] = useState<AmbraWorkApp | null>(null);
  const [, startTransition] = useTransition();

  // The shared preference cookies are readable here; read them after hydration.
  useEffect(() => {
    setDefaultApp(
      effectiveDefaultApp({
        defaultApp: readCookie(DEFAULT_APP_COOKIE),
        lastApp: readCookie(LAST_APP_COOKIE),
        openLast: readCookie(OPEN_LAST_APP_COOKIE) === "1",
      })
    );
  }, []);

  const changeDefault = (app: AmbraWorkApp | null) => {
    const previous = defaultApp;
    setDefaultApp(app);
    startTransition(async () => {
      const result = await setDefaultAppAction(app).catch(() => ({ success: false }));
      if (!result.success) setDefaultApp(previous);
    });
  };

  return (
    <AppSwitcher
      currentApp="requests"
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
        makeDefault: (app) => t("switcher.makeDefault", { app }),
        removeDefault: (app) => t("switcher.removeDefault", { app }),
        isDefault: t("switcher.isDefault"),
        opening: (app) => t("switcher.opening", { app }),
        openingHint: t("switcher.openingHint"),
      }}
      websiteHref={appUrl("site", locale === "en" ? "/en" : "/")}
      defaultApp={defaultApp}
      onDefaultAppChange={changeDefault}
    />
  );
}
