'use client';

import React from 'react';
import { 
  Building2, 
  HelpCircle, 
  Search, 
  FileText, 
  Clock, 
  CheckCircle2, 
  ArrowRight,
  ShieldAlert,
  Layers,
  Sparkles,
  Zap,
  Users,
  TrendingUp,
  Lock
} from 'lucide-react';

interface MarketplaceInfoProps {
  activeView: 'how-it-works' | 'for-vendors';
  onGoToSearch: () => void;
}

export default function MarketplaceInfo({ activeView, onGoToSearch }: MarketplaceInfoProps) {
  if (activeView === 'how-it-works') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-12 animate-fade-in text-left">
        {/* Header */}
        <div className="text-center space-y-2 max-w-xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-black font-display text-gray-900 dark:text-white uppercase tracking-tight leading-none">
            Jak działa Ambra Marketplace?
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Przewodnik po bezpiecznych zakupach hurtowych i automatyzacji VMI dla warsztatów i serwisów.
          </p>
        </div>

        {/* Steps Flow Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
          <div className="space-y-3 bg-white dark:bg-gray-900 p-5 rounded-2xl shadow-md text-xs leading-relaxed">
            <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-xs">1</div>
            <h3 className="font-extrabold text-sm uppercase text-gray-800 dark:text-white">Wyszukaj dostawców</h3>
            <p className="text-gray-500 dark:text-gray-400">
              Przeszukuj setki produktów, marek oraz firm w promieniu Poznania i okolic za pomocą filtrów lokalizacji i odległości.
            </p>
          </div>

          <div className="space-y-3 bg-white dark:bg-gray-900 p-5 rounded-2xl shadow-md text-xs leading-relaxed">
            <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-xs">2</div>
            <h3 className="font-extrabold text-sm uppercase text-gray-800 dark:text-white">Dodaj do zapytania</h3>
            <p className="text-gray-500 dark:text-gray-400">
              Skonfiguruj zapotrzebowanie asortymentowe. Nasz system poprowadzi Cię przez bezpieczną kalkulację opakowań zbiorczych.
            </p>
          </div>

          <div className="space-y-3 bg-white dark:bg-gray-900 p-5 rounded-2xl shadow-md text-xs leading-relaxed">
            <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-xs">3</div>
            <h3 className="font-extrabold text-sm uppercase text-gray-800 dark:text-white">Odbierz wyceny B2B</h3>
            <p className="text-gray-500 dark:text-gray-400">
              Twój wniosek RFQ trafia bezpośrednio do opiekuna. Wycena pojawi się na Twoim e-mailu w deklarowanym czasie reakcji.
            </p>
          </div>

          <div className="space-y-3 bg-white dark:bg-gray-900 p-5 rounded-2xl shadow-md text-xs leading-relaxed">
            <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-xs">4</div>
            <h3 className="font-extrabold text-sm uppercase text-gray-800 dark:text-white">Aktywuj system VMI</h3>
            <p className="text-gray-500 dark:text-gray-400">
              Uruchom pełną automatyzację. Otrzymaj konto w portalu i pozwól dostawcy zarządzać uzupełnianiem stanów w warsztacie.
            </p>
          </div>
        </div>

        {/* Detailed FAQ section */}
        <div className="space-y-6 pt-6">
          <h2 className="text-base font-black font-display uppercase tracking-tight text-gray-900 dark:text-white">Często zadawane pytania (FAQ)</h2>
          
          <div className="space-y-4 text-xs leading-relaxed">
            <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl shadow-md space-y-2">
              <h4 className="font-extrabold text-sm text-gray-800 dark:text-gray-200">Czy korzystanie z wyszukiwarki jest płatne?</h4>
              <p className="text-gray-500 dark:text-gray-400">
                Nie, publiczny katalog dostawców oraz możliwość wysyłania zapytań ofertowych (RFQ) są całkowicie bezpłatne dla wszystkich warsztatów mechanicznych, wulkanizacji oraz lakierni.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl shadow-md space-y-2">
              <h4 className="font-extrabold text-sm text-gray-800 dark:text-gray-200">Kim są zweryfikowani dostawcy?</h4>
              <p className="text-gray-500 dark:text-gray-400">
                To certyfikowani przez Ambra partnerzy logistyczni (hurtownie regionalne, producenci i importerzy części), którzy zobowiązali się do zachowania standardów dostaw B2B (błyskawiczny transport, oryginalne produkty i ustrukturyzowane cenniki).
              </p>
            </div>

            <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl shadow-md space-y-2">
              <h4 className="font-extrabold text-sm text-gray-800 dark:text-gray-200">Co oznacza skrót VMI?</h4>
              <p className="text-gray-500 dark:text-gray-400">
                <strong>VMI (Vendor Managed Inventory)</strong> to nowoczesny model, w którym dostawca monitoruje stan kluczowych części (np. oleje, filtry, klocki hamulcowe, sorbenty) w Twoim warsztacie i automatycznie planuje ich dostawy przed wyczerpaniem zapasów.
              </p>
            </div>
          </div>
        </div>

        <div className="text-center pt-4">
          <button
            onClick={onGoToSearch}
            className="py-3 px-8 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase rounded-xl shadow-md cursor-pointer"
          >
            Przejdź do wyszukiwarki dostawców
          </button>
        </div>
      </div>
    );
  }

  // Dla dostawców
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-12 animate-fade-in text-left text-xs leading-relaxed">
      {/* Header */}
      <div className="text-center space-y-2 max-w-xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-black font-display text-gray-900 dark:text-white uppercase tracking-tight leading-none">
          Zostań certyfikowanym dostawcą Ambra
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Udostępnij swoje stany magazynowe, automatyzuj zamówienia u klientów i rozwijaj sieć sprzedaży VMI w całej Polsce.
        </p>
      </div>

      {/* Benefits grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl shadow-md space-y-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center text-sm font-bold">
            <TrendingUp className="h-4 w-4" />
          </div>
          <h3 className="font-extrabold text-sm uppercase text-gray-800 dark:text-white">Nowy kanał sprzedaży</h3>
          <p className="text-gray-500 dark:text-gray-400">
            Zyskaj bezpośredni dostęp do setek zarejestrowanych warsztatów i serwisów poszukujących wiarygodnych dostawców w swojej okolicy.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl shadow-md space-y-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center text-sm font-bold">
            <Lock className="h-4 w-4" />
          </div>
          <h3 className="font-extrabold text-sm uppercase text-gray-800 dark:text-white">Lojalność klientów</h3>
          <p className="text-gray-500 dark:text-gray-400">
            Dzięki integracji VMI wiążesz klientów ze swoją hurtownią na stałe. Warsztaty kupują u Ciebie automatycznie, bez szukania alternatyw.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl shadow-md space-y-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center text-sm font-bold">
            <Zap className="h-4 w-4 text-amber-500 fill-amber-500/10" />
          </div>
          <h3 className="font-extrabold text-sm uppercase text-gray-800 dark:text-white">Cyfryzacja i automaty</h3>
          <p className="text-gray-500 dark:text-gray-400">
            Zredukuj koszty obsługi handlowej. Nasz system automatycznie generuje propozycje zamówień dla Twoich stałych klientów VMI.
          </p>
        </div>
      </div>

      {/* Register application form */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 space-y-6 shadow-md max-w-xl mx-auto">
        <div className="space-y-1">
          <h3 className="text-base font-bold text-gray-900 dark:text-white">Zgłoszenie rejestracyjne hurtowni B2B</h3>
          <p className="text-[10px] text-gray-400">Zgłoś swoją firmę do procesu weryfikacji. Nasz koordynator skontaktuje się w ciągu 48h roboczych.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-bold text-gray-700 dark:text-gray-300">
          <div className="space-y-1.5">
            <label>Pełna nazwa hurtowni / firmy *</label>
            <input type="text" className="w-full bg-gray-50 dark:bg-gray-950 rounded-xl px-3.5 py-2.5 outline-none dark:text-white text-xs font-bold" placeholder="np. AutoHurt Wielkopolska" />
          </div>
          <div className="space-y-1.5">
            <label>Numer NIP *</label>
            <input type="text" className="w-full bg-gray-50 dark:bg-gray-950 rounded-xl px-3.5 py-2.5 outline-none dark:text-white text-xs font-bold" placeholder="np. 7779876543" />
          </div>
          <div className="space-y-1.5">
            <label>Imię i nazwisko koordynatora *</label>
            <input type="text" className="w-full bg-gray-50 dark:bg-gray-950 rounded-xl px-3.5 py-2.5 outline-none dark:text-white text-xs font-bold" placeholder="np. Tomasz Nowak" />
          </div>
          <div className="space-y-1.5">
            <label>E-mail firmowy *</label>
            <input type="email" className="w-full bg-gray-50 dark:bg-gray-950 rounded-xl px-3.5 py-2.5 outline-none dark:text-white text-xs font-bold" placeholder="np. hurt@firma.pl" />
          </div>
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={() => alert('Dziękujemy za zgłoszenie! Koordynator sieci skontaktuje się z Państwem telefonicznie.')}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase rounded-xl cursor-pointer"
          >
            Wyślij wniosek o dołączenie do Ambra VMI
          </button>
        </div>
      </div>
    </div>
  );
}
