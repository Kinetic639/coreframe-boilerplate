import { ThemeProvider } from "next-themes";
import "./globals.css";
import { hasLocale, Locale, NextIntlClientProvider } from "next-intl";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { ReactNode, Suspense } from "react";
import { routing } from "@/i18n/routing";
import { getTranslations, setRequestLocale, getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { ToastContainerThemed } from "@/components/toast-container-themed";
import { ToastListener } from "@/components/toast-listener";
import type { Metadata, Viewport } from "next";
import { ThemeColorSync } from "@/components/pwa/theme-color-sync";
import { DisplayTimeZoneSync } from "@/lib/date-time/display-time-zone-sync";

type Props = {
  children: ReactNode;
  params: Promise<{ locale: Locale }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(props: Omit<Props, "children">): Promise<Metadata> {
  const { locale } = await props.params;

  const t = await getTranslations({ locale, namespace: "LocaleLayout" });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return {
    title: t("title"),
    metadataBase: new URL(appUrl),
    icons: { apple: "/pwa/apple-touch-icon.png" },
    // iPhone: opened from the home screen it runs as an app (needed for push)
    appleWebApp: { capable: true, title: "Ambra", statusBarStyle: "default" },
  };
}

// Before the client syncs it to the chosen colour theme: the header colour of
// the default theme, light or dark like the system (installed app title bar)
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9fafb" },
    { media: "(prefers-color-scheme: dark)", color: "#1f1f1f" },
  ],
};

export default async function RootLayout({ children, params }: Props) {
  // Ensure that the incoming `locale` is valid
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Enable static rendering
  setRequestLocale(locale);

  // Load messages on the server within request scope
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="bg-background font-sans text-foreground">
        <NuqsAdapter>
          <NextIntlClientProvider messages={messages}>
            <DisplayTimeZoneSync />
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <ThemeColorSync />
              <ToastContainerThemed />
              <Suspense fallback={null}>
                <ToastListener />
              </Suspense>
              {children}
            </ThemeProvider>
          </NextIntlClientProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
