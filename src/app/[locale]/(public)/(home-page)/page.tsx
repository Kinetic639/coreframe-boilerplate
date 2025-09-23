import {
  ArrowRight,
  Check,
  Zap,
  Search,
  Shield,
  BarChart,
  Smartphone,
  QrCode,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Metadata } from "next";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata.public.home" });
  const common = await getTranslations({ locale, namespace: "metadata.common" });

  return {
    title: `${t("title")}${common("separator")}${common("appName")}`,
    description: t("description"),
    keywords: [
      "SaaS platform",
      "warehouse management",
      "inventory tracking",
      "business management",
      "enterprise software",
      "Next.js",
      "Supabase",
      "zarządzanie magazynem",
      "platforma SaaS",
    ],
    openGraph: {
      title: `${t("title")}${common("separator")}${common("appName")}`,
      description: t("description"),
      type: "website",
      siteName: common("appName"),
    },
    twitter: {
      card: "summary_large_image",
      title: `${t("title")}${common("separator")}${common("appName")}`,
      description: t("description"),
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function Home() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="px-4 py-16 md:py-24">
        <div className="container mx-auto w-full max-w-7xl">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
            <div>
              <h1 className="mb-6 text-4xl font-bold leading-tight md:text-5xl lg:text-6xl">
                Twój start z <span className="text-primary">SaaS łatwiejszy niż kiedykolwiek</span>
              </h1>
              <p className="mb-8 text-lg text-muted-foreground md:text-xl">
                SaaSForge to kompletny boilerplate do budowy aplikacji SaaS w oparciu o Next.js i
                Supabase. Autoryzacja, dashboard, moduły, integracje – wszystko gotowe do działania
                od pierwszego dnia.
              </p>
              <div className="flex flex-col gap-4 sm:flex-row">
                <Button size="lg" className="px-8 py-6 text-lg">
                  Rozpocznij teraz
                  <ArrowRight className="ml-2" />
                </Button>
                <Button variant="outline" size="lg" className="px-8 py-6 text-lg" asChild>
                  <Link href="/">
                    Zobacz demo
                    <ArrowRight className="ml-2" />
                  </Link>
                </Button>
              </div>

              <div className="mt-8 flex flex-wrap gap-6">
                <div className="flex items-center">
                  <Check className="mr-2 h-5 w-5 text-primary" />
                  <span>Open Source</span>
                </div>
                <div className="flex items-center">
                  <Check className="mr-2 h-5 w-5 text-primary" />
                  <span>Zbudowany na Next.js 15 + Supabase</span>
                </div>
                <div className="flex items-center">
                  <Check className="mr-2 h-5 w-5 text-primary" />
                  <span>Gotowe do wdrożenia</span>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="absolute -inset-1 rounded-lg bg-gradient-to-r from-primary/50 to-primary/30 opacity-75 blur-lg"></div>
              <div className="relative overflow-hidden rounded-lg border border-border bg-background shadow-xl">
                <Image
                  src="/screenshot-boilerplate.png"
                  alt="SaaSForge Dashboard"
                  width={800}
                  height={500}
                  placeholder="blur"
                  blurDataURL="/placeholder.png"
                  className="h-auto w-full"
                />
              </div>
              <div className="absolute -bottom-6 -right-6 h-24 w-24 rounded-full bg-primary/20 blur-xl"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-muted/30 px-4 py-16">
        <div className="container mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">Dlaczego SaaSForge?</h2>
            <p className="mx-auto max-w-2xl text-xl text-muted-foreground">
              Stwórz aplikację SaaS szybciej niż kiedykolwiek z gotowym szablonem bogatym w funkcje
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border border-border bg-background p-6 transition-all hover:border-primary/50">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Smartphone className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">Responsywny UI</h3>
              <p className="text-muted-foreground">
                Piękny design oparty na Tailwind CSS, gotowy do użycia na desktopie i mobilkach.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-background p-6 transition-all hover:border-primary/50">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <QrCode className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">Gotowe moduły</h3>
              <p className="text-muted-foreground">
                Autentykacja, system ról, dashboard, zarządzanie modułami i wiele więcej.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-background p-6 transition-all hover:border-primary/50">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">Integracje i API</h3>
              <p className="text-muted-foreground">
                Łatwo integruj z Resend, Stripe, Supabase, i innymi. REST i RPC gotowe do użycia.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-background p-6 transition-all hover:border-primary/50">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Search className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">Wydajność i SEO</h3>
              <p className="text-muted-foreground">
                SSR, App Router, dynamiczne meta tagi – zadbaj o indeksację i szybkość działania.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-background p-6 transition-all hover:border-primary/50">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">Bezpieczeństwo</h3>
              <p className="text-muted-foreground">
                Supabase z politykami RLS, tokeny JWT, RBAC i zabezpieczenia gotowe do działania.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-background p-6 transition-all hover:border-primary/50">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <BarChart className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">Rozszerzalność</h3>
              <p className="text-muted-foreground">
                Architektura gotowa do skalowania, dodawania funkcji i budowania mikroserwisów.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Demo App Teaser */}
      <section className="px-4 py-16 md:py-24">
        <div className="container mx-auto max-w-7xl">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
            <div>
              <h2 className="mb-6 text-3xl font-bold md:text-4xl">Wypróbuj naszą aplikację</h2>
              <p className="mb-8 text-lg text-muted-foreground">
                Poznaj MagazynPro w akcji. Nasza intuicyjna aplikacja pozwala na łatwe zarządzanie
                zasobami, śledzenie stanów magazynowych i optymalizację procesów logistycznych.
              </p>
              <ul className="mb-8 space-y-4">
                <li className="flex items-start">
                  <div className="mt-1 flex-shrink-0">
                    <Check className="h-5 w-5 text-primary" />
                  </div>
                  <div className="ml-3">
                    <h4 className="text-lg font-semibold">Intuicyjny interfejs</h4>
                    <p className="text-muted-foreground">
                      Łatwa nawigacja i przejrzysty układ dla szybkiej pracy
                    </p>
                  </div>
                </li>
                <li className="flex items-start">
                  <div className="mt-1 flex-shrink-0">
                    <Check className="h-5 w-5 text-primary" />
                  </div>
                  <div className="ml-3">
                    <h4 className="text-lg font-semibold">Zarządzanie materiałami</h4>
                    <p className="text-muted-foreground">
                      Dodawaj, edytuj i kategoryzuj swoje produkty
                    </p>
                  </div>
                </li>
                <li className="flex items-start">
                  <div className="mt-1 flex-shrink-0">
                    <Check className="h-5 w-5 text-primary" />
                  </div>
                  <div className="ml-3">
                    <h4 className="text-lg font-semibold">Śledzenie dostawców</h4>
                    <p className="text-muted-foreground">
                      Zarządzaj relacjami z dostawcami w jednym miejscu
                    </p>
                  </div>
                </li>
              </ul>
              <Button size="lg" className="px-8 py-6 text-lg" asChild>
                <Link href="/">
                  Przejdź do aplikacji
                  <ArrowRight className="ml-2" />
                </Link>
              </Button>
            </div>
            <div className="relative">
              <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/30 to-primary/10 opacity-50 blur-xl"></div>
              <div className="relative overflow-hidden rounded-lg border border-border bg-background p-4 shadow-xl">
                <Image
                  src="/screenshot-boilerplate.png"
                  alt="SaaSForge Dashboard"
                  width={800}
                  height={500}
                  placeholder="blur"
                  blurDataURL="/placeholder.png"
                  className="h-auto w-full"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-muted/30 px-4 py-16">
        <div className="container mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">Co mówią nasi klienci</h2>
            <p className="mx-auto max-w-2xl text-xl text-muted-foreground">
              Dołącz do tysięcy zadowolonych klientów, którzy usprawniają swoje procesy magazynowe z
              MagazynPro
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {/* Testimonial 1 */}
            <div className="rounded-lg border border-border bg-background p-6">
              <div className="mb-4 flex">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} className="h-5 w-5 fill-yellow-500 text-yellow-500" />
                ))}
              </div>
              <p className="mb-6 text-muted-foreground">
                "MagazynPro zrewolucjonizował sposób, w jaki zarządzamy naszym magazynem.
                Oszczędzamy kilka godzin dziennie na procesach inwentaryzacyjnych."
              </p>
              <div className="flex items-center">
                <div className="mr-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
                  <span className="font-bold text-primary">JN</span>
                </div>
                <div>
                  <h4 className="font-semibold">Jan Nowak</h4>
                  <p className="text-sm text-muted-foreground">
                    Kierownik Magazynu, Firma Logistyczna
                  </p>
                </div>
              </div>
            </div>

            {/* Testimonial 2 */}
            <div className="rounded-lg border border-border bg-background p-6">
              <div className="mb-4 flex">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} className="h-5 w-5 fill-yellow-500 text-yellow-500" />
                ))}
              </div>
              <p className="mb-6 text-muted-foreground">
                "Dzięki MagazynPro zwiększyliśmy dokładność naszego inwentarza o 98%. Funkcja
                skanowania kodów QR jest nie do przecenienia w naszej codziennej pracy."
              </p>
              <div className="flex items-center">
                <div className="mr-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
                  <span className="font-bold text-primary">AW</span>
                </div>
                <div>
                  <h4 className="font-semibold">Anna Wiśniewska</h4>
                  <p className="text-sm text-muted-foreground">
                    Dyrektor Operacyjny, Hurtownia Spożywcza
                  </p>
                </div>
              </div>
            </div>

            {/* Testimonial 3 */}
            <div className="rounded-lg border border-border bg-background p-6">
              <div className="mb-4 flex">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} className="h-5 w-5 fill-yellow-500 text-yellow-500" />
                ))}
              </div>
              <p className="mb-6 text-muted-foreground">
                "Intuicyjność MagazynPro pozwala nam na szybkie wdrożenie nowych pracowników.
                Raporty i analizy pomagają nam optymalizować zamawianie towaru."
              </p>
              <div className="flex items-center">
                <div className="mr-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
                  <span className="font-bold text-primary">PK</span>
                </div>
                <div>
                  <h4 className="font-semibold">Piotr Kowalczyk</h4>
                  <p className="text-sm text-muted-foreground">Właściciel, Sklep Meblowy</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Partners */}
      <section className="px-4 py-16">
        <div className="container mx-auto max-w-7xl">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-2xl font-bold md:text-3xl">Zaufali nam</h2>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              Dołącz do grona naszych zadowolonych klientów z różnych branż
            </p>
          </div>

          <div className="grid grid-cols-2 items-center justify-items-center gap-6 sm:grid-cols-3 lg:grid-cols-6">
            {[1, 2, 3, 4, 5, 6].map((partner) => (
              <div
                key={partner}
                className="flex h-16 w-32 items-center justify-center rounded bg-muted/30"
              >
                <span className="font-medium text-muted-foreground">Partner {partner}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-primary px-4 py-16 text-primary-foreground">
        <div className="container mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-8 md:flex-row md:items-center">
            <div>
              <h2 className="mb-4 text-3xl font-bold md:text-4xl">
                Gotowy na rewolucję w zarządzaniu magazynem?
              </h2>
              <p className="text-xl opacity-90">
                Dołącz do MagazynPro już dziś i zoptymalizuj swoje procesy magazynowe.
              </p>
            </div>
            <Button size="lg" className="px-8 py-6 text-lg shadow-lg" variant="secondary">
              Rozpocznij za darmo
              <ArrowRight className="ml-2" />
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
