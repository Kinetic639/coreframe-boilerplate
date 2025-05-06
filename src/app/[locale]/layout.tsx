import HeaderAuth from "@components/header-auth";
import { ThemeSwitcher } from "@components/theme-switcher";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import Link from "next/link";
import "./globals.css";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import { hasLocale, Locale, NextIntlClientProvider } from "next-intl";
import { ReactNode } from "react";
import { routing } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

type Props = {
  children: ReactNode;
  params: Promise<{ locale: Locale }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(props: Omit<Props, "children">) {
  const { locale } = await props.params;

  const t = await getTranslations({ locale, namespace: "LocaleLayout" });

  return {
    title: t("title"),
  };
}

const geistSans = Geist({
  display: "swap",
  subsets: ["latin"],
});

export default async function RootLayout({ children, params }: Props) {
  // Ensure that the incoming `locale` is valid
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Enable static rendering
  setRequestLocale(locale);

  return (
    <html lang={locale} className={geistSans.className} suppressHydrationWarning>
      <body className="bg-background text-foreground">
        <NextIntlClientProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <main className="flex min-h-screen flex-col items-center">
              <div className="flex w-full flex-1 flex-col items-center gap-20">
                <nav className="flex h-16 w-full justify-center border-b border-b-foreground/10">
                  <div className="flex w-full max-w-5xl items-center justify-between p-3 px-5 text-sm">
                    <div className="flex items-center gap-5 font-semibold">
                      <Link href={"/"}>CoreFrame Boilerplate</Link>
                    </div>
                    <HeaderAuth />
                  </div>
                </nav>
                <div className="flex max-w-5xl flex-col gap-20 p-5">{children}</div>

                <footer className="mx-auto flex w-full items-center justify-center gap-8 border-t py-16 text-center text-xs">
                  <p>
                    © {new Date().getFullYear()}{" "}
                    <a
                      href="https://github.com/Kinetic639"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      @Kinetic639
                    </a>
                  </p>
                  <ThemeSwitcher />
                  <LocaleSwitcher />
                </footer>
              </div>
            </main>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
