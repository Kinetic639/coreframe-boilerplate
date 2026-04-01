"use client";

import React from "react";
import Link from "next/link";
import {
  Smartphone,
  QrCode,
  Bell,
  Barcode,
  Settings,
  BarChart,
  ArrowRight,
  CheckCircle2,
  Shield,
  Zap,
  Search,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import FeaturesContactForm from "@/components/forms/FeaturesContactForm";

const FeaturesClient = () => {
  const mainFeatures = [
    {
      id: "mobile",
      icon: Smartphone,
      title: "Aplikacja mobilna",
      description:
        "Śledź inwentarz z dowolnego miejsca. Aplikacja dostępna na iOS i Android z pełną funkcjonalnością.",
      details: [
        "Skanowanie produktów w czasie rzeczywistym",
        "Pełna funkcjonalność offline",
        "Szybki dostęp do informacji o produktach",
        "Powiadomienia i alerty mobilne",
      ],
    },
    {
      id: "qr",
      icon: QrCode,
      title: "Kody QR i skanowanie",
      description:
        "Zaawansowane skanowanie kodów QR i kreskowych. Generuj własne kody dla produktów i lokalizacji.",
      details: [
        "Automatyczne generowanie kodów QR",
        "Obsługa różnych formatów kodów",
        "Szybkie wyszukiwanie poprzez skanowanie",
        "Integracja z systemem inwentaryzacji",
      ],
    },
    {
      id: "alerts",
      icon: Bell,
      title: "Powiadomienia i alerty",
      description:
        "Otrzymuj natychmiastowe powiadomienia o niskim stanie zapasów, nadchodzących dostawach i więcej.",
      details: [
        "Alerty o niskim stanie magazynowym",
        "Powiadomienia o nadchodzących dostawach",
        "Przypomnienia o audytach i zadaniach",
        "Personalizowane ustawienia alertów",
      ],
    },
    {
      id: "barcode",
      icon: Barcode,
      title: "System kodów kreskowych",
      description:
        "Kompleksowe zarządzanie kodami kreskowymi z obsługą różnych formatów i standardów branżowych.",
      details: [
        "Obsługa EAN, UPC, Code128 i innych",
        "Automatyczne rozpoznawanie formatów",
        "Generowanie etykiet z kodami",
        "Integracja z bazą danych produktów",
      ],
    },
    {
      id: "analytics",
      icon: BarChart,
      title: "Analityka i raporty",
      description:
        "Dogłębne analizy ruchu towaru, trendów sprzedaży i wydajności magazynu z interaktywnymi wykresami.",
      details: [
        "Raporty obrotu towarowego",
        "Analizy trendów i sezonowości",
        "Metryki wydajności magazynu",
        "Eksport danych do Excel/PDF",
      ],
    },
    {
      id: "management",
      icon: Settings,
      title: "Zarządzanie użytkownikami",
      description:
        "Zaawansowane zarządzanie dostępem z systemem ról i uprawnień dla różnych poziomów organizacji.",
      details: [
        "System ról i uprawnień",
        "Wielopoziomowa hierarchia dostępu",
        "Audyt aktywności użytkowników",
        "Bezpieczne logowanie i autoryzacja",
      ],
    },
  ];

  const additionalFeatures = [
    {
      icon: Shield,
      title: "Bezpieczeństwo",
      description: "Enterprise-grade security z szyfrowaniem end-to-end",
    },
    {
      icon: Zap,
      title: "Wydajność",
      description: "Szybkie ładowanie i responsywny interfejs",
    },
    {
      icon: Search,
      title: "Wyszukiwanie",
      description: "Zaawansowane wyszukiwanie i filtry",
    },
    {
      icon: Users,
      title: "Współpraca",
      description: "Praca zespołowa w czasie rzeczywistym",
    },
  ];

  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="px-4 py-16 md:py-24">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center">
            <h1 className="mb-6 text-4xl font-bold md:text-5xl lg:text-6xl">
              Funkcje, które <span className="text-primary">usprawniają</span> Twój magazyn
            </h1>
            <p className="mx-auto mb-8 max-w-3xl text-lg text-muted-foreground md:text-xl">
              Odkryj pełne możliwości MagazynPro. Od skanowania kodów QR po zaawansowaną analitykę -
              wszystko, czego potrzebujesz do efektywnego zarządzania zapasami.
            </p>
            <Button size="lg" className="px-8 py-6 text-lg" asChild>
              <Link href="/">
                Wypróbuj za darmo
                <ArrowRight className="ml-2" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Main Features */}
      <section className="px-4 py-16">
        <div className="container mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">Główne funkcje</h2>
            <p className="mx-auto max-w-2xl text-xl text-muted-foreground">
              Kompleksowe rozwiązanie dla każdego aspektu zarządzania magazynem
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {mainFeatures.map((feature) => (
              <div
                key={feature.id}
                className="group rounded-lg border border-border bg-background p-6 transition-all hover:border-primary/50 hover:shadow-lg"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-3 text-xl font-semibold">{feature.title}</h3>
                <p className="mb-4 text-muted-foreground">{feature.description}</p>
                <ul className="space-y-2">
                  {feature.details.map((detail, index) => (
                    <li key={index} className="flex items-start">
                      <CheckCircle2 className="mr-2 mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                      <span className="text-sm text-muted-foreground">{detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Additional Features */}
      <section className="bg-muted/30 px-4 py-16">
        <div className="container mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">I wiele więcej...</h2>
            <p className="mx-auto max-w-2xl text-xl text-muted-foreground">
              Dodatkowe funkcje, które czynią MagazynPro kompletnym rozwiązaniem
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {additionalFeatures.map((feature, index) => (
              <div
                key={index}
                className="rounded-lg border border-border bg-background p-6 text-center transition-all hover:border-primary/50"
              >
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <feature.icon className="h-8 w-8 text-primary" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Contact */}
      <section className="px-4 py-16 md:py-24">
        <div className="container mx-auto max-w-4xl">
          <div className="rounded-lg bg-primary/5 p-8 text-center md:p-12">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">
              Gotowy, aby zwiększyć wydajność magazynu?
            </h2>
            <p className="mb-8 text-lg text-muted-foreground">
              Skontaktuj się z nami, aby dowiedzieć się więcej o funkcjach MagazynPro i jak mogą one
              pomóc Twojej firmie.
            </p>
            <FeaturesContactForm />
          </div>
        </div>
      </section>
    </main>
  );
};

export default FeaturesClient;
