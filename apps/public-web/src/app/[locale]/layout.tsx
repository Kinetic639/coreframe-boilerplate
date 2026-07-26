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
import type { Metadata } from "next";

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
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.ambra-system.com";
  const canonicalLocalePrefix = locale === routing.defaultLocale ? "" : `/${locale}`;

  return {
    title: t("title"),
    metadataBase: new URL(siteUrl),
    alternates: {
      canonical: canonicalLocalePrefix || "/",
      languages: {
        pl: "/",
        en: "/en",
        "x-default": "/",
      },
    },
    openGraph: {
      type: "website",
      locale,
      siteName: "Ambra System",
      url: canonicalLocalePrefix || "/",
      title: t("title"),
    },
    twitter: {
      card: "summary_large_image",
      title: t("title"),
    },
  };
}

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
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
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
