import type { VmiPortalSnapshotDto } from "./types";

export const vmiPortalSnapshotFixture: VmiPortalSnapshotDto = {
  user: {
    name: "Michał Stępień",
    role: "Kierownik oddziału VMI",
    organization: "AutoService Komorniki",
    activeLocationId: "loc-komorniki",
  },
  locations: [
    {
      id: "loc-komorniki",
      name: "Komorniki Warsztat",
      address: "ul. Poznańska 14, 62-052 Komorniki",
    },
    {
      id: "loc-poznan",
      name: "Poznań Punkt Serwisowy",
      address: "ul. Głogowska 120, 60-205 Poznań",
    },
  ],
  vendors: [
    {
      id: "vendor-autoparts",
      name: "AutoParts Pro",
      industry: "Części samochodowe i eksploatacyjne",
      accentColor: "blue",
      connectionStatus: "Aktywny",
      status: "Aktywny",
      accountManager: {
        name: "Tomasz Kowalski",
        phone: "+48 601 234 567",
        email: "t.kowalski@autopartspro.pl",
      },
      contacts: [
        {
          name: "Tomasz Kowalski",
          role: "Główny opiekun",
          phone: "+48 601 234 567",
          email: "t.kowalski@autopartspro.pl",
          status: "online",
        },
        {
          name: "Janusz Nowak",
          role: "Wsparcie techniczne",
          phone: "+48 601 111 222",
          email: "j.nowak@autopartspro.pl",
          status: "online",
        },
      ],
      portfolio: {
        since: "2004",
        about:
          "AutoParts Pro to wiodący dostawca oryginalnych części zamiennych i akcesoriów samochodowych. Działamy w systemie VMI, dostarczając produkty bezpośrednio do warsztatów w czasie krótszym niż 4 godziny.",
        specialties: ["Układy hamulcowe", "Filtry i oleje", "Zawieszenie", "Elektryka samochodowa"],
        certifications: ["ISO 9001:2015", "TÜV Rheinland", "ATE Brake Center"],
      },
      announcements: [
        {
          id: "autoparts-news-1",
          title: "Limitowana Oferta: Dodatkowy rabat 15% na wybrane elementy złączne VMI",
          type: "offer",
          content:
            "Specjalny pakiet rabatowy przygotowany dla Twoich oddziałów handlowych. Wszystkie zamówienia na wybrane śruby, nakrętki oraz podkładki ocynkowane złożone do końca tego tygodnia za pośrednictwem portalu VMI zostaną zrabatowane o dodatkowe 15% netto!",
          badgeText: "PROMOCJA -15%",
        },
        {
          id: "autoparts-news-2",
          title: "Wdrożenie zautomatyzowanych regałów logistycznych VMI Express",
          type: "info",
          content:
            "W przyszłym miesiącu planujemy montaż inteligentnych, zautomatyzowanych regałów magazynowych bezpośrednio w Twoich halach warsztatowych. System będzie zintegrowany ze skanerem kodów kreskowych, dzięki czemu stany inwentaryzacji będą raportowane w czasie rzeczywistym.",
          badgeText: "NOWOŚĆ TECHNICZNA",
        },
      ],
    },
    {
      id: "vendor-werktools",
      name: "WerkTools",
      industry: "Profesjonalne narzędzia i wyposażenie",
      accentColor: "orange",
      connectionStatus: "Aktywny",
      status: "Aktywny",
      accountManager: {
        name: "Andrzej Wiśniewski",
        phone: "+48 602 987 654",
        email: "a.wisniewski@werktools.pl",
      },
      contacts: [
        {
          name: "Andrzej Wiśniewski",
          role: "Kluczowy opiekun",
          phone: "+48 602 987 654",
          email: "a.wisniewski@werktools.pl",
          status: "online",
        },
        {
          name: "Marcin Zieliński",
          role: "Inżynier sprzedaży",
          phone: "+48 602 333 444",
          email: "m.zielinski@werktools.pl",
          status: "offline",
        },
      ],
      portfolio: {
        since: "2011",
        about:
          "WerkTools specjalizuje się w dostarczaniu najwyższej jakości narzędzi ręcznych, pneumatycznych i elektronarzędzi dla wymagających profesjonalistów warsztatowych.",
        specialties: ["Narzędzia ręczne", "Pneumatyka", "Wózki warsztatowe", "Elektronarzędzia"],
        certifications: ["Certyfikat ISO 9001", "Gwarancja WerkLife", "Atesty bezpieczeństwa CE"],
      },
      announcements: [
        {
          id: "werktools-news-1",
          title: "Wyprzedaż zestawów narzędziowych Beta: do -25% do końca miesiąca!",
          type: "offer",
          content:
            "Uzupełnij wyposażenie stanowisk pracy o legendarne zestawy kluczy i wkrętaków marki Beta. Zamówienia składane przez system VMI automatycznie otrzymują 25% upustu. Oferta ważna do wyczerpania zapasów magazynowych.",
          badgeText: "WYPRZEDAŻ -25%",
        },
        {
          id: "werktools-news-2",
          title: "Mobilna kalibracja kluczy dynamometrycznych w Twoim warsztacie",
          type: "info",
          content:
            "Nasz mobilny autobus techniczny odwiedzi Twoje serwisy w przyszły wtorek. Oferujemy bezpłatną kalibrację i certyfikację wszystkich kluczy dynamometrycznych używanych na stanowiskach naprawczych. Zapisz się już dziś!",
          badgeText: "MOBILNY SERWIS",
        },
      ],
    },
    {
      id: "vendor-cleanchem",
      name: "CleanChem",
      industry: "Chemia warsztatowa i środki czyszczące",
      accentColor: "green",
      connectionStatus: "Aktywny",
      status: "Aktywny",
      accountManager: {
        name: "Karolina Nowak",
        phone: "+48 501 111 222",
        email: "k.nowak@cleanchem.com.pl",
      },
      contacts: [
        {
          name: "Karolina Nowak",
          role: "Opiekun handlowy",
          phone: "+48 501 111 222",
          email: "k.nowak@cleanchem.com.pl",
          status: "online",
        },
        {
          name: "Piotr Kaczmarek",
          role: "Dyrektor handlowy",
          phone: "+48 501 555 666",
          email: "p.kaczmarek@cleanchem.com.pl",
          status: "busy",
        },
      ],
      portfolio: {
        since: "2015",
        about:
          "CleanChem to producent innowacyjnych, ekologicznych preparatów czyszczących, odtłuszczaczy i chemii technicznej przeznaczonej dla przemysłu i warsztatów.",
        specialties: ["Zmywacze ekologiczne", "Płyny eksploatacyjne", "Środki BHP i czystości", "Chemia warsztatowa"],
        certifications: ["Normy REACH", "Atest PZH", "ISO 14001:2015"],
      },
      announcements: [
        {
          id: "cleanchem-news-1",
          title: "Premiera: Ekologiczny zmywacz BioClean-15 wolny od LZO",
          type: "info",
          content:
            "Przedstawiamy w pełni biodegradowalny, bezpieczny dla skóry zmywacz montażowy serii BioClean-15. Wyprodukowany na bazie ekstraktów cytrusowych, nie wydziela szkodliwych oparów i doskonale czyści tarcze hamulcowe.",
          badgeText: "EKO NOWOŚĆ",
        },
        {
          id: "cleanchem-news-2",
          title: "Bezpłatna dzierżawa automatycznych stacji dozujących chemię",
          type: "offer",
          content:
            "Chcesz obniżyć zużycie koncentratów myjących? Zainstaluj bezpłatną, automatyczną stację dozującą CleanChem Eco-Mix. Urządzenie precyzyjnie miesza wodę z preparatem, redukując koszty chemii o 35%.",
          badgeText: "ZYSKAJ OSZCZĘDNOŚĆ",
        },
      ],
    },
    {
      id: "vendor-safetycore",
      name: "SafetyCore",
      industry: "Odzież robocza, BHP i ochrona osobista",
      accentColor: "rose",
      connectionStatus: "Aktywny",
      status: "Aktywny",
      accountManager: {
        name: "Mariusz Lewandowski",
        phone: "+48 703 555 444",
        email: "m.lewandowski@safetycore.pl",
      },
      contacts: [
        {
          name: "Marek Jankowski",
          role: "Konsultant techniczny",
          phone: "+48 701 444 555",
          email: "m.jankowski@safetycore.pl",
          status: "online",
        },
        {
          name: "Anna Dąbrowska",
          role: "Dział logistyki",
          phone: "+48 701 888 999",
          email: "a.dabrowska@safetycore.pl",
          status: "online",
        },
      ],
      portfolio: {
        since: "2009",
        about:
          "SafetyCore to Twój zaufany partner w dziedzinie bezpieczeństwa i higieny pracy. Projektujemy i dostarczamy profesjonalną odzież roboczą, obuwie i ochronniki.",
        specialties: ["Odzież robocza BHP", "Obuwie ochronne S3", "Ochrona dróg oddechowych", "Automaty vendingowe BHP"],
        certifications: ["EN ISO 20345", "Certyfikaty OEKO-TEX", "Standard CE Ochrony"],
      },
      announcements: [
        {
          id: "safetycore-news-1",
          title: "Szybka personalizacja odzieży: Haft komputerowy z logo gratis!",
          type: "offer",
          content:
            "Dla wszystkich nowych zamówień na kurtki i spodnie robocze marki SafetyCore oferujemy wykonanie haftu komputerowego z logo Twojego serwisu zupełnie za darmo. Promocja obowiązuje przy zamówieniach powyżej 10 kpl.",
          badgeText: "HAFT GRATIS",
        },
        {
          id: "safetycore-news-2",
          title: "Montaż automatów vendingowych BHP-omat VMI na Twojej hali",
          type: "announcement",
          content:
            "Uruchomiliśmy program pilotażowy montażu automatów BHP-omat. Twoi mechanicy mogą pobierać rękawice robocze, maski i okulary ochronne za pomocą kart pracowniczych. Pełna kontrola zużycia BHP 24/7.",
          badgeText: "BHP VENDING",
        },
      ],
    },
  ],
  inventory: [
    {
      id: "inv-brake-pads",
      vendorId: "vendor-autoparts",
      locationId: "loc-komorniki",
      productName: "Klocki hamulcowe TRW GDB1330",
      clientSku: "SKU-K-001",
      unit: "kpl.",
      currentStock: 3,
      minStock: 6,
      targetStock: 18,
      incomingQty: 0,
      status: "Below minimum",
      lastUpdated: "2026-07-20T08:30:00.000Z",
    },
    {
      id: "inv-oil-filter",
      vendorId: "vendor-autoparts",
      locationId: "loc-komorniki",
      productName: "Filtr oleju Mann-Filter HU 711/51 x",
      clientSku: "SKU-F-020",
      unit: "szt.",
      currentStock: 22,
      minStock: 15,
      targetStock: 45,
      incomingQty: 20,
      status: "Healthy",
      lastUpdated: "2026-07-20T09:15:00.000Z",
    },
    {
      id: "inv-gloves",
      vendorId: "vendor-cleanchem",
      locationId: "loc-komorniki",
      productName: "Rekawice nitrylowe GripPro XL",
      clientSku: "SKU-BHP-011",
      unit: "op.",
      currentStock: 1,
      minStock: 8,
      targetStock: 24,
      incomingQty: 4,
      status: "Approaching minimum",
      lastUpdated: "2026-07-19T13:20:00.000Z",
    },
    {
      id: "inv-wrench-set",
      vendorId: "vendor-werktools",
      locationId: "loc-poznan",
      productName: "Zestaw kluczy Beta 42/S12",
      clientSku: "SKU-N-100",
      unit: "kpl.",
      currentStock: 0,
      minStock: 2,
      targetStock: 5,
      incomingQty: 0,
      status: "Out of stock",
      lastUpdated: "2026-07-18T11:05:00.000Z",
    },
  ],
  proposals: [
    {
      id: "proposal-001",
      vendorId: "vendor-autoparts",
      locationId: "loc-komorniki",
      proposalNumber: "PROP-VMI-2026-001",
      status: "Oczekuje na zatwierdzenie",
      expiryDate: "2026-07-25",
      urgentLinesCount: 2,
      totalValue: 2460,
    },
    {
      id: "proposal-002",
      vendorId: "vendor-cleanchem",
      locationId: "loc-komorniki",
      proposalNumber: "PROP-VMI-2026-002",
      status: "Oczekuje na zatwierdzenie",
      expiryDate: "2026-07-27",
      urgentLinesCount: 1,
      totalValue: 840,
    },
  ],
  orders: [
    {
      id: "order-001",
      vendorId: "vendor-autoparts",
      locationId: "loc-komorniki",
      orderNumber: "ZAM-VMI-2026-041",
      status: "W przygotowaniu",
      requestedDeliveryDate: "2026-07-22",
      totalValue: 1840,
    },
    {
      id: "order-002",
      vendorId: "vendor-werktools",
      locationId: "loc-poznan",
      orderNumber: "ZAM-VMI-2026-039",
      status: "Potwierdzone",
      requestedDeliveryDate: "2026-07-24",
      totalValue: 1260,
    },
  ],
  messageThreads: [
    {
      id: "thread-001",
      vendorId: "vendor-autoparts",
      subject: "Termin dostawy filtrów Mann",
      unreadCount: 2,
      lastUpdated: "2026-07-20T15:35:00.000Z",
    },
    {
      id: "thread-002",
      vendorId: "vendor-cleanchem",
      subject: "Korekta progów minimalnych BHP",
      unreadCount: 1,
      lastUpdated: "2026-07-20T10:15:00.000Z",
    },
  ],
};
