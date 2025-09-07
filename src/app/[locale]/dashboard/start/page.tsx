import React from "react";
import { loadUserContextServer } from "@/lib/api/load-user-context-server";
import { loadAppContextServer } from "@/lib/api/load-app-context-server";
import { getAllWidgets } from "@/modules";
import { WidgetRenderer } from "@/modules/WidgetRenderer";
import { getTranslations } from "next-intl/server";
import { Metadata } from "next";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata.dashboard.start" });
  const common = await getTranslations({ locale, namespace: "metadata.common" });

  return {
    title: `${t("title")}${common("separator")}${common("appName")}`,
    description: t("description"),
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function StartPage() {
  const userContext = await loadUserContextServer();
  const appContext = await loadAppContextServer();

  if (!userContext || !appContext) {
    const locale = await getLocale();
    return redirect({ href: "/sign-in", locale });
  }

  const { activeOrgId } = appContext;

  // Pobierz widgety
  const widgets = activeOrgId ? await getAllWidgets() : [];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Start</h1>

      {/* 🟩 Widgety */}
      {widgets.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {widgets.map((widget) => (
            <div key={widget.id} className={widget.config?.className || ""}>
              <WidgetRenderer widget={widget} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
