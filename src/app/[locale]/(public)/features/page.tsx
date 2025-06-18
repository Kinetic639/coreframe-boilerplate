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

const Features = () => {
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
      title: "Kodowanie QR",
      description:
        "Generuj i skanuj kody QR dla wszystkich produktów, lokalizacji i transakcji w systemie.",
      details: [
        "Automatyczne generowanie kodów QR",
        "Szybkie skanowanie za pomocą kamery",
        "Etykiety do druku z kodami QR",
        "Historia skanowań i audyty",
      ],
    },
    {
      id: "alerts",
      icon: Bell,
      title: "Alerty i powiadomienia",
      description:
        "Otrzymuj powiadomienia o niskim stanie magazynowym, terminach ważności i innych kluczowych zdarzeniach.",
      details: [
        "Konfigurowalne progi alertów",
        "Powiadomienia email i push",
        "Raporty o stanach krytycznych",
        "Śledzenie terminów ważności produktów",
      ],
    },
    {
      id: "barcode",
      icon: Barcode,
      title: "Kodowanie kreskowe",
      description:
        "Etykietowanie i skanowanie kodów kreskowych dla szybkiego zarządzania inwentarzem.",
      details: [
        "Wsparcie dla standardów 1D i 2D",
        "Integracja ze skanerami USB",
        "Drukowanie etykiet z kodami",
        "Masowe operacje za pomocą skanowania",
      ],
    },
    {
      id: "integrations",
      icon: Settings,
      title: "Integracje",
      description:
        "Łącz MagazynPro z innymi systemami w Twojej organizacji dzięki API i gotowym integracjom.",
      details: [
        "API RESTful dla deweloperów",
        "Gotowe integracje z popularnymi systemami",
        "Eksport i import danych w wielu formatach",
        "Automatyzacja przepływów pracy",
      ],
    },
    {
      id: "reporting",
      icon: BarChart,
      title: "Raportowanie",
      description:
        "Zaawansowane raportowanie i analizy dające wgląd w operacje magazynowe i trendy.",
      details: [
        "Konfigurowalne dashboardy",
        "Eksport raportów do PDF/Excel",
        "Analizy trendów i prognozowanie",
        "Śledzenie KPI i celów",
      ],
    },
  ];

  const additionalFeatures = [
    {
      icon: Search,
      title: "Zaawansowane wyszukiwanie",
      description:
        "Szybko znajdź produkty dzięki potężnemu silnikowi wyszukiwania z filtrowaniem i sortowaniem.",
    },
    {
      icon: Shield,
      title: "Kontrola dostępu",
      description:
        "Zarządzaj uprawnieniami i dostępem użytkowników do różnych funkcji i danych w systemie.",
    },
    {
      icon: Users,
      title: "Zarządzanie zespołem",
      description:
        "Przydzielaj zadania, śledź ich wykonanie i współpracuj efektywnie w całym zespole.",
    },
    {
      icon: Zap,
      title: "Optymalizacja procesów",
      description:
        "Automatyzuj powtarzalne zadania i optymalizuj procesy magazynowe w oparciu o dane.",
    },
  ];

  return (
    <div className="min-h-screen py-16">
      <div className="container mx-auto max-w-7xl px-4">
        {/* Hero */}
        <div className="mb-20 text-center">
          <h1 className="mb-6 text-4xl font-bold md:text-5xl">Funkcje MagazynPro</h1>
          <p className="mx-auto mb-8 max-w-3xl text-xl text-muted-foreground">
            Odkryj wszystkie możliwości MagazynPro, które pomogą Ci efektywnie zarządzać magazynem i
            optymalizować procesy
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button size="lg" className="text-lg">
              Rozpocznij za darmo
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button variant="outline" size="lg" className="text-lg" asChild>
              <Link href="/pricing">Zobacz cennik</Link>
            </Button>
          </div>
        </div>

        {/* Main features */}
        <div className="mb-24 space-y-32">
          {mainFeatures.map((feature, index) => (
            <div
              key={feature.id}
              className={`grid grid-cols-1 items-center gap-12 lg:grid-cols-2 ${
                index % 2 === 1 ? "lg:flex-row-reverse" : ""
              }`}
              id={feature.id}
            >
              <div className={index % 2 === 1 ? "lg:order-2" : ""}>
                <div className="mb-6">
                  <div className="mb-4 inline-flex items-center justify-center rounded-lg bg-primary/10 p-3">
                    <feature.icon className="h-8 w-8 text-primary" />
                  </div>
                  <h2 className="mb-4 text-3xl font-bold">{feature.title}</h2>
                  <p className="mb-6 text-lg text-muted-foreground">{feature.description}</p>

                  <div className="space-y-4">
                    {feature.details.map((detail, idx) => (
                      <div key={idx} className="flex items-start">
                        <CheckCircle2 className="mr-3 mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
                        <span>{detail}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Button className="mt-4">
                  Dowiedz się więcej
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>

              <div className={`relative ${index % 2 === 1 ? "lg:order-1" : ""}`}>
                <div className="absolute -inset-4 rounded-2xl bg-gradient-to-r from-primary/20 to-primary/5 opacity-70 blur-lg"></div>
                <div className="relative flex h-64 items-center justify-center rounded-xl border border-border bg-muted/30 p-8">
                  <feature.icon className="h-24 w-24 text-primary" strokeWidth={1.5} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Additional features */}
        <div className="mt-24">
          <h2 className="mb-12 text-center text-3xl font-bold">Jeszcze więcej możliwości</h2>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
            {additionalFeatures.map((feature, index) => (
              <div
                key={index}
                className="rounded-lg border border-border p-6 transition-all hover:border-primary/50"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-3 text-xl font-semibold">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Form at the bottom */}
        <div className="mt-20">
          <FeaturesContactForm />
        </div>

        {/* CTA */}
        <div className="mt-24 rounded-xl bg-primary/10 p-8 text-center md:p-12">
          <h2 className="mb-4 text-3xl font-bold">Gotowy, by wypróbować MagazynPro?</h2>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground">
            Dołącz do tysięcy firm, które już optymalizują swoje procesy magazynowe z MagazynPro.
            Rozpocznij bezpłatny okres próbny już dziś!
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button size="lg" className="text-lg">
              Rozpocznij za darmo
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button variant="outline" size="lg" className="text-lg" asChild>
              <Link href="/pricing">Zobacz cennik</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Features;
