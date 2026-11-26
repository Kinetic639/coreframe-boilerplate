import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { QueryProvider } from "@/components/query-provider";
import { routing } from "@/i18n/routing";
import { DEFAULT_UI_THEME, SYSTEM_MODE_SCRIPT } from "@/lib/ui-theme";
import { loadPortalContext } from "@/server/portal-context";
import "./globals.css";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "app" });
  return { title: t("name"), description: t("tagline") };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#171717" },
  ],
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  // The theme saved in Ambra goes on <html> in the server render, so the first paint
  // already has it; only "system" needs the device setting (the inline script).
  const result = await loadPortalContext();
  const ui =
    result.status === "ok"
      ? result.context.ui
      : result.status === "no-access"
        ? result.ui
        : DEFAULT_UI_THEME;

  return (
    <html
      lang={locale}
      data-theme={ui.colorTheme === "default" ? undefined : ui.colorTheme}
      data-mode={ui.mode}
      className={ui.mode === "dark" ? "dark" : undefined}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: SYSTEM_MODE_SCRIPT }} />
      </head>
      <body className="bg-background text-foreground min-h-dvh antialiased">
        <NextIntlClientProvider>
          <QueryProvider>
            <NuqsAdapter>{children}</NuqsAdapter>
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}
