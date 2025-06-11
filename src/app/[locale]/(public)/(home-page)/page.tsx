import { ArrowRight, Check, Zap, Search, Shield, BarChart, Smartphone, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import Image from "next/image";

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
    </main>
  );
}
