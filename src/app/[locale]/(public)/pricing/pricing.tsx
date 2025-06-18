"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Check, X, ArrowRight, Percent } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const Pricing = () => {
  // Billing toggle state
  const [isYearly, setIsYearly] = useState(false);

  // Stan dla suwaków
  const [locations, setLocations] = useState(5);
  const [users, setUsers] = useState(10);
  const [products, setProducts] = useState(1000);

  // Obliczanie ceny dla planu niestandardowego
  const calculateCustomPrice = () => {
    const basePrice = 29;
    const locationPrice = Math.floor(locations / 10) * 10;
    const userPrice = users * 5;
    const productPrice = Math.floor(products / 1000) * 15;

    const monthlyPrice = basePrice + locationPrice + userPrice + productPrice;

    // Apply 20% discount for yearly billing
    return isYearly ? Math.round(monthlyPrice * 0.8) : monthlyPrice;
  };

  const [customPrice, setCustomPrice] = useState(calculateCustomPrice());

  // Aktualizacja niestandardowej ceny, gdy zmieniają się wartości suwaków lub typ subskrypcji
  useEffect(() => {
    setCustomPrice(calculateCustomPrice());
  }, [locations, users, products, isYearly]);

  // Calculate price with yearly discount
  const getPrice = (monthlyPrice: number) => {
    return isYearly ? Math.round(monthlyPrice * 0.8) : monthlyPrice;
  };

  // Dane dla planów cenowych
  const plans = [
    {
      name: "Podstawowy",
      price: 29,
      features: [
        "Do 5 lokalizacji",
        "Do 5 użytkowników",
        "Do 1000 produktów",
        "Aplikacja mobilna",
        "Kody QR i kody kreskowe",
        "Podstawowe raporty",
      ],
      limitations: ["Brak integracji API", "Brak zaawansowanych raportów", "Wsparcie przez e-mail"],
    },
    {
      name: "Profesjonalny",
      price: 89,
      popular: true,
      features: [
        "Do 15 lokalizacji",
        "Do 20 użytkowników",
        "Do 10 000 produktów",
        "Aplikacja mobilna",
        "Kody QR i kody kreskowe",
        "Zaawansowane raporty",
        "Integracja API",
        "Audyt i historia zmian",
      ],
      limitations: ["Ograniczone integracje zewnętrzne"],
    },
    {
      name: "Biznes",
      price: 199,
      features: [
        "Nielimitowane lokalizacje",
        "Do 50 użytkowników",
        "Do 100 000 produktów",
        "Aplikacja mobilna",
        "Kody QR i kody kreskowe",
        "Zaawansowane raporty",
        "Pełna integracja API",
        "Audyt i historia zmian",
        "Priorytetowe wsparcie 24/7",
        "Dedykowany opiekun klienta",
      ],
      limitations: [],
    },
  ];

  return (
    <div className="min-h-screen py-16">
      <div className="container mx-auto max-w-7xl px-4">
        {/* Nagłówek strony */}
        <div className="mb-16 text-center">
          <h1 className="mb-4 text-4xl font-bold md:text-5xl">Przejrzysty cennik</h1>
          <p className="mx-auto mb-8 max-w-2xl text-xl text-muted-foreground">
            Wybierz plan idealny dla Twojego biznesu lub skonfiguruj własny
          </p>

          {/* Toggle dla wyboru subskrypcji */}
          <div className="mb-8 flex items-center justify-center gap-4">
            <ToggleGroup
              type="single"
              value={isYearly ? "yearly" : "monthly"}
              onValueChange={(value) => {
                if (value === "yearly" || value === "monthly") {
                  setIsYearly(value === "yearly");
                }
              }}
              className="rounded-full bg-accent/50 p-1"
            >
              <ToggleGroupItem
                value="monthly"
                variant="pill"
                size="lg"
                className="rounded-full transition-all duration-300 data-[state=on]:shadow-md"
              >
                Miesięcznie
              </ToggleGroupItem>
              <ToggleGroupItem
                value="yearly"
                variant="pill"
                size="lg"
                className="flex items-center gap-2 rounded-full transition-all duration-300 data-[state=on]:shadow-md"
              >
                <span>Rocznie</span>
                <span className="flex items-center gap-1 rounded-full bg-primary/20 px-2 py-0.5 text-xs text-primary">
                  <Percent className="h-3 w-3" />
                  20%
                </span>
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Informacja o zniżce */}
          <div
            className={`transform transition-all duration-300 ${isYearly ? "translate-y-0 opacity-100" : "absolute -translate-y-4 opacity-0"}`}
          >
            <p className="text-sm font-medium text-primary">Oszczędź 20% z planem rocznym</p>
          </div>
        </div>

        {/* Plany cenowe */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-4">
          {/* Standardowe plany */}
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`flex flex-col rounded-lg border p-8 transition-all duration-300 hover:border-primary hover:shadow-md ${
                plan.popular ? "relative border-primary shadow-lg" : "border-border"
              }`}
            >
              {plan.popular && (
                <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 transform rounded-full bg-primary px-4 py-1 text-sm font-medium text-primary-foreground">
                  Najpopularniejszy
                </div>
              )}
              <h3 className="text-2xl font-bold">{plan.name}</h3>
              <div className="mb-6 mt-4">
                <span className="text-4xl font-bold">{getPrice(plan.price)} zł</span>
                <span className="text-muted-foreground">
                  /{isYearly ? "mies. (rozliczenie roczne)" : "miesiąc"}
                </span>
                {(isYearly || !isYearly) && (
                  <div className="mt-1 text-sm">
                    {isYearly ? (
                      <>
                        <span className="text-muted-foreground line-through">{plan.price} zł</span>
                        <span className="ml-2 text-primary">Oszczędzasz 20%</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">
                        Z planem rocznym oszczędzasz 20%
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex-grow">
                <div className="mb-6 space-y-3">
                  {plan.features.map((feature, idx) => (
                    <div key={idx} className="flex items-center">
                      <Check className="mr-2 h-5 w-5 flex-shrink-0 text-green-500" />
                      <span>{feature}</span>
                    </div>
                  ))}

                  {plan.limitations.map((limitation, idx) => (
                    <div key={idx} className="flex items-center text-muted-foreground">
                      <X className="mr-2 h-5 w-5 flex-shrink-0 text-muted-foreground" />
                      <span>{limitation}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                className={`w-full ${plan.popular ? "" : "mt-4"}`}
                variant={plan.popular ? "default" : "outline"}
                size="lg"
              >
                Wybierz plan
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          ))}

          {/* Plan niestandardowy z suwakami */}
          <div className="rounded-lg border border-border p-8 transition-all duration-300 hover:border-primary hover:shadow-md">
            <h3 className="text-2xl font-bold">Plan Niestandardowy</h3>
            <div className="mb-6 mt-4">
              <span className="text-4xl font-bold">{customPrice} zł</span>
              <span className="text-muted-foreground">
                /{isYearly ? "mies. (rozliczenie roczne)" : "miesiąc"}
              </span>
              {(isYearly || !isYearly) && (
                <div className="mt-1 text-sm">
                  {isYearly ? (
                    <>
                      <span className="text-muted-foreground line-through">
                        {Math.round(customPrice / 0.8)} zł
                      </span>
                      <span className="ml-2 text-primary">Oszczędzasz 20%</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Z planem rocznym oszczędzasz 20%</span>
                  )}
                </div>
              )}
            </div>

            <div className="mb-6 space-y-6">
              {/* Suwak lokalizacji */}
              <div>
                <div className="mb-2 flex justify-between">
                  <label className="text-sm font-medium">Liczba lokalizacji</label>
                  <span className="text-sm font-bold">{locations}</span>
                </div>
                <Slider
                  value={[locations]}
                  min={1}
                  max={50}
                  step={1}
                  onValueChange={(value) => setLocations(value[0])}
                  className="mb-2"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1</span>
                  <span>50+</span>
                </div>
              </div>

              {/* Suwak użytkowników */}
              <div>
                <div className="mb-2 flex justify-between">
                  <label className="text-sm font-medium">Liczba użytkowników</label>
                  <span className="text-sm font-bold">{users}</span>
                </div>
                <Slider
                  value={[users]}
                  min={1}
                  max={100}
                  step={1}
                  onValueChange={(value) => setUsers(value[0])}
                  className="mb-2"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1</span>
                  <span>100+</span>
                </div>
              </div>

              {/* Suwak produktów */}
              <div>
                <div className="mb-2 flex justify-between">
                  <label className="text-sm font-medium">Liczba produktów</label>
                  <span className="text-sm font-bold">{products.toLocaleString()}</span>
                </div>
                <Slider
                  value={[products]}
                  min={100}
                  max={100000}
                  step={100}
                  onValueChange={(value) => setProducts(value[0])}
                  className="mb-2"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>100</span>
                  <span>100 000+</span>
                </div>
              </div>
            </div>

            <Button className="w-full" size="lg">
              Dostosuj plan
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* FAQ lub dodatkowe informacje */}
        <div className="mx-auto mt-20 max-w-3xl">
          <h2 className="mb-6 text-center text-2xl font-bold md:text-3xl">
            Często zadawane pytania
          </h2>

          <div className="space-y-6">
            <div>
              <h3 className="mb-2 text-xl font-semibold">Czy mogę zmienić plan w przyszłości?</h3>
              <p className="text-muted-foreground">
                Tak, możesz w dowolnym momencie zmienić swój plan. Zmiany zostaną uwzględnione w
                kolejnym okresie rozliczeniowym.
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-xl font-semibold">
                Czy oferujecie zniżki dla organizacji non-profit?
              </h3>
              <p className="text-muted-foreground">
                Tak, oferujemy specjalne warunki dla organizacji non-profit i placówek edukacyjnych.
                Skontaktuj się z naszym zespołem sprzedaży, aby uzyskać więcej informacji.
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-xl font-semibold">Co zawiera okres próbny?</h3>
              <p className="text-muted-foreground">
                Nasz 14-dniowy okres próbny daje dostęp do wszystkich funkcji planu Profesjonalnego.
                Nie wymagamy karty kredytowej, aby rozpocząć.
              </p>
            </div>
          </div>
        </div>

        {/* Formularz kontaktowy */}
        <div className="mx-auto mt-20 max-w-3xl rounded-lg bg-accent/30 p-8 shadow-sm">
          <div className="mb-6 text-center">
            <h2 className="mb-2 text-2xl font-bold md:text-3xl">Brakuje czegoś ważnego?</h2>
            <p className="text-muted-foreground">
              Napisz do nas wiadomość. Monitorujemy sugestie z tej strony codziennie.
            </p>
          </div>

          <form className="space-y-4">
            <div>
              <label htmlFor="suggestion" className="mb-1 block text-sm font-medium">
                Nad czym mamy pracować:
              </label>
              <textarea
                id="suggestion"
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
              ></textarea>
            </div>

            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium">
                Skontaktuj się ze mną na ten email:
              </label>
              <input
                id="email"
                type="email"
                className="w-full rounded-md border border-input bg-background px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <Button type="submit" className="px-8 py-2">
              Wyślij
            </Button>

            <p className="mt-4 text-xs text-muted-foreground">
              Prosimy o jak najbardziej szczegółowy opis. Prawdziwi ludzie czytają Twoje sugestie.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
