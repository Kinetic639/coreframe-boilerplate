import { PublicVendor, PublicProduct, PublicCatalog, PublicPromotion, PublicFlyer, PublicAvailability, PublicPriceMode } from './types';

export const mockCities = [
  'Poznań',
  'Komorniki',
  'Luboń',
  'Swadzim',
  'Gniezno',
  'Kalisz',
  'Wrocław',
  'Sady',
  'Konin',
  'Swarzędz'
];

export const mockCategories = [
  'Części samochodowe',
  'Chemia warsztatowa',
  'Narzędzia',
  'Wyposażenie warsztatu',
  'Odzież robocza',
  'Bezpieczeństwo i BHP',
  'Materiały lakiernicze',
  'Opony i akcesoria',
  'Materiały eksploatacyjne',
  'Elektryka pojazdowa',
  'Kosmetyki samochodowe',
  'Łączniki i pneumatyka'
];

export const mockBrands = [
  'Castrol',
  'Bosch',
  'Karcher',
  'Wurth',
  '3M',
  'Yato',
  'Mann-Filter',
  'Continental',
  'Brembo',
  'Philips'
];

export const mockVendors: PublicVendor[] = [
  {
    id: 'mv-1',
    name: 'AutoParts Pro',
    slug: 'autoparts-pro',
    logoUrl: 'https://picsum.photos/seed/partslogo/120/120',
    coverUrl: 'https://picsum.photos/seed/partscover/800/400',
    category: 'Części samochodowe',
    city: 'Poznań',
    address: 'ul. Głogowska 412, 60-004 Poznań',
    distanceKm: 2.4,
    isVerified: true,
    deliveryAvailable: true,
    collectionAvailable: true,
    shortDescription: 'Czołowy dystrybutor części układu hamulcowego, napędowego oraz zawieszenia w Wielkopolsce.',
    longDescription: 'AutoParts Pro to profesjonalny dostawca działający od ponad 15 lat na rynku wielkopolskim. Specjalizujemy się w dystrybucji hurtowej podzespołów mechanicznych do aut osobowych i dostawczych. Naszym klientom oferujemy pełne wsparcie techniczne, błyskawiczne dostawy własną flotą kurierską 3 razy dziennie oraz dostęp do unikalnych marek premium.',
    contactEmail: 'hurtownia@autopartspro.pl',
    contactPhone: '+48 61 823 45 00',
    openingHours: 'Pon - Pt: 7:00 - 18:00, Sob: 8:00 - 14:00',
    serviceArea: 'Województwo Wielkopolskie, Lubuskie',
    deliveryTerms: 'Dostawa gratis przy zamówieniach powyżej 300 PLN. Standardowy czas dostawy: 2-4h.',
    responseTimeText: 'Zwykle odpowiada w 15 minut',
    profileCompleteness: 95,
    featuredBrands: ['Brembo', 'Bosch', 'Continental'],
    productCategories: ['Części samochodowe', 'Materiały eksploatacyjne']
  },
  {
    id: 'mv-2',
    name: 'WerkTools Polska',
    slug: 'werktools-polska',
    logoUrl: 'https://picsum.photos/seed/toolslogo/120/120',
    coverUrl: 'https://picsum.photos/seed/toolscover/800/400',
    category: 'Narzędzia',
    city: 'Komorniki',
    address: 'ul. Poznańska 88, 62-052 Komorniki',
    distanceKm: 8.1,
    isVerified: true,
    deliveryAvailable: true,
    collectionAvailable: true,
    shortDescription: 'Profesjonalne narzędzia ręczne, elektronarzędzia pneumatyczne i wyposażenie warsztatów samochodowych.',
    longDescription: 'WerkTools Polska jest wyłącznym dystrybutorem profesjonalnych systemów narzędziowych dedykowanych dla autoryzowanych serwisów i niezależnych warsztatów mechanicznych. W ofercie posiadamy szeroki asortyment wózków narzędziowych, kluczy pneumatycznych, przyrządów pomiarowych i specjalistycznych ściągaczy.',
    contactEmail: 'b2b@werktools.pl',
    contactPhone: '+48 61 899 12 34',
    openingHours: 'Pon - Pt: 8:00 - 17:00',
    serviceArea: 'Cała Polska (wysyłka kurierska)',
    deliveryTerms: 'Darmowa wysyłka powyżej 1000 PLN netto. Paczki wysyłane są w ciągu 24h za pośrednictwem DPD lub DHL.',
    responseTimeText: 'Zwykle odpowiada w 1 godzinę',
    profileCompleteness: 90,
    featuredBrands: ['Yato', 'Wurth'],
    productCategories: ['Narzędzia', 'Wyposażenie warsztatu']
  },
  {
    id: 'mv-3',
    name: 'CleanChem Professional',
    slug: 'cleanchem-professional',
    logoUrl: 'https://picsum.photos/seed/chemlogo/120/120',
    coverUrl: 'https://picsum.photos/seed/chemcover/800/400',
    category: 'Chemia warsztatowa',
    city: 'Luboń',
    address: 'ul. Przemysłowa 14, 62-030 Luboń',
    distanceKm: 6.7,
    isVerified: true,
    deliveryAvailable: true,
    collectionAvailable: true,
    shortDescription: 'Płyny eksploatacyjne, zmywacze, smary i profesjonalne środki czyszczące dla przemysłu motoryzacyjnego.',
    longDescription: 'CleanChem dostarcza najwyższej jakości chemię warsztatową i przemysłową. Nasza linia produktów obejmuje ekologiczne płyny czyszczące, zmywacze do hamulców o obniżonej lotności, koncentraty chłodnicze oraz wysokotemperaturowe smary syntetyczne, spełniające rygorystyczne normy środowiskowe.',
    contactEmail: 'kontakt@cleanchem-pro.pl',
    contactPhone: '+48 61 654 32 10',
    openingHours: 'Pon - Pt: 8:00 - 16:00',
    serviceArea: 'Polska Zachodnia',
    deliveryTerms: 'Dostawa paletowa w 48h. Przy stałej współpracy rabaty logistyczne i brak minimum zamówieniowego.',
    responseTimeText: 'Zwykle odpowiada w 30 minut',
    profileCompleteness: 88,
    featuredBrands: ['Castrol', 'Wurth'],
    productCategories: ['Chemia warsztatowa', 'Kosmetyki samochodowe']
  },
  {
    id: 'mv-4',
    name: 'SafetyCore',
    slug: 'safetycore',
    logoUrl: 'https://picsum.photos/seed/safelogo/120/120',
    coverUrl: 'https://picsum.photos/seed/safecover/800/400',
    category: 'Bezpieczeństwo i BHP',
    city: 'Swadzim',
    address: 'ul. Parkowa 3, 62-080 Swadzim',
    distanceKm: 12.0,
    isVerified: true,
    deliveryAvailable: true,
    collectionAvailable: true,
    shortDescription: 'Certyfikowane ubrania robocze, rękawice ochronne, okulary oraz systemy bezpieczeństwa pracy w warsztatach.',
    longDescription: 'SafetyCore to wiodący dostawca profesjonalnych rozwiązań z zakresu BHP. Zaopatrujemy serwisy samochodowe i lakiernie w specjalistyczne maski oddechowe, niepalne kombinezony, rękawice nitrylowe o podwyższonej odporności na chemię oraz obuwie ochronne z podnoskami kompozytowymi.',
    contactEmail: 'zamowienia@safetycore.pl',
    contactPhone: '+48 61 814 15 16',
    openingHours: 'Pon - Pt: 7:30 - 16:30',
    serviceArea: 'Wielkopolska i Lubuskie',
    deliveryTerms: 'Dostawa kurierska w 24h. Możliwość personalizacji odzieży roboczej (logo firmowe haftem lub sitodrukiem).',
    responseTimeText: 'Zwykle odpowiada w 20 minut',
    profileCompleteness: 92,
    featuredBrands: ['3M'],
    productCategories: ['Bezpieczeństwo i BHP', 'Odzież robocza']
  },
  {
    id: 'mv-5',
    name: 'LakierTech',
    slug: 'lakiertech',
    logoUrl: 'https://picsum.photos/seed/lakierlogo/120/120',
    coverUrl: 'https://picsum.photos/seed/lakiercover/800/400',
    category: 'Materiały lakiernicze',
    city: 'Poznań',
    address: 'ul. Grunwaldzka 290, 60-166 Poznań',
    distanceKm: 4.8,
    isVerified: true,
    deliveryAvailable: true,
    collectionAvailable: true,
    shortDescription: 'Lakiery samochodowe, szpachlówki, podkłady oraz materiały ścierne dla lakierni renowacyjnych.',
    longDescription: 'LakierTech to autoryzowane centrum dystrybucji systemów lakierniczych. Oferujemy komputerowy dobór kolorów, profesjonalne pistolety natryskowe, krążki ścierne, papiery maskujące i zaawansowane systemy polerskie ułatwiające pracę każdemu lakiernikowi.',
    contactEmail: 'doradztwo@lakiertech.poznan.pl',
    contactPhone: '+48 502 900 800',
    openingHours: 'Pon - Pt: 8:00 - 17:00, Sob: 9:00 - 13:00',
    serviceArea: 'Promień 100km od Poznania',
    deliveryTerms: 'Szybki dowóz lakierów na terenie Poznania w 2h. Wysyłka ogólnokrajowa kurierem w 24h.',
    responseTimeText: 'Zwykle odpowiada w 10 minut',
    profileCompleteness: 85,
    featuredBrands: ['3M', 'Wurth'],
    productCategories: ['Materiały lakiernicze', 'Bezpieczeństwo i BHP']
  },
  {
    id: 'mv-6',
    name: 'MotoFiltry Partner',
    slug: 'motofiltry-partner',
    logoUrl: 'https://picsum.photos/seed/filterlogo/120/120',
    coverUrl: 'https://picsum.photos/seed/filtercover/800/400',
    category: 'Materiały eksploatacyjne',
    city: 'Gniezno',
    address: 'ul. Roosevelta 154, 62-200 Gniezno',
    distanceKm: 52.0,
    isVerified: false,
    deliveryAvailable: true,
    collectionAvailable: true,
    shortDescription: 'Kompleksowa oferta filtrów oleju, powietrza, paliwa i kabinowych do wszystkich typów pojazdów.',
    longDescription: 'Jesteśmy bezpośrednim importerem i dystrybutorem filtrów samochodowych najwyższej klasy. Współpracujemy z czołowymi światowymi producentami OEM. Dostarczamy filtry do aut osobowych, ciężarowych, a także maszyn rolniczych i budowlanych bezpośrednio do warsztatów w regionie.',
    contactEmail: 'biuro@motofiltry-partner.pl',
    contactPhone: '+48 61 426 99 99',
    openingHours: 'Pon - Pt: 8:00 - 16:30',
    serviceArea: 'Wschodnia Wielkopolska',
    deliveryTerms: 'Dostawa własnym transportem w wybrane dni tygodnia lub codzienna wysyłka DPD.',
    responseTimeText: 'Zwykle odpowiada w 2 godziny',
    profileCompleteness: 82,
    featuredBrands: ['Mann-Filter', 'Bosch'],
    productCategories: ['Materiały eksploatacyjne']
  },
  {
    id: 'mv-7',
    name: 'ProfiOpony',
    slug: 'profiopony',
    logoUrl: 'https://picsum.photos/seed/tyrelogo/120/120',
    coverUrl: 'https://picsum.photos/seed/tyrecover/800/400',
    category: 'Opony i akcesoria',
    city: 'Kalisz',
    address: 'ul. Wrocławska 110, 62-800 Kalisz',
    distanceKm: 120.0,
    isVerified: true,
    deliveryAvailable: true,
    collectionAvailable: true,
    shortDescription: 'Hurtownia opon osobowych, dostawczych i ciężarowych oraz ciężarki, zawory i akcesoria wulkanizacyjne.',
    longDescription: 'ProfiOpony to regionalne centrum oponiarskie i hurtownia akcesoriów wulkanizacyjnych. Oferujemy ogumienie letnie, zimowe i wielosezonowe wiodących producentów. Dodatkowo kompleksowo zaopatrujemy serwisy oponiarskie w ciężarki wyważające, łatki, kleje i zawory.',
    contactEmail: 'kalisz@profiopony.pl',
    contactPhone: '+48 62 765 43 21',
    openingHours: 'Pon - Pt: 8:00 - 18:00, Sob: 8:00 - 13:00',
    serviceArea: 'Wielkopolska Południowa, Łódzkie',
    deliveryTerms: 'Wysyłka opon w 24h na terenie całej Polski. Zamówienia powyżej 4 sztuk opon - dostawa bezpłatna.',
    responseTimeText: 'Zwykle odpowiada w 45 minut',
    profileCompleteness: 90,
    featuredBrands: ['Continental'],
    productCategories: ['Opony i akcesoria', 'Materiały eksploatacyjne']
  },
  {
    id: 'mv-8',
    name: 'Serwis Supply',
    slug: 'serwis-supply',
    logoUrl: 'https://picsum.photos/seed/supplylogo/120/120',
    coverUrl: 'https://picsum.photos/seed/supplycover/800/400',
    category: 'Wyposażenie warsztatu',
    city: 'Wrocław',
    address: 'ul. Krakowska 15, 50-424 Wrocław',
    distanceKm: 165.0,
    isVerified: true,
    deliveryAvailable: true,
    collectionAvailable: false,
    shortDescription: 'Podnośniki, kompresory, wyważarki, urządzenia do geometrii kół oraz serwis maszyn.',
    longDescription: 'Serwis Supply dostarcza kompleksowe wyposażenie stanowisk naprawczych i diagnostycznych. Zajmujemy się nie tylko sprzedażą ciężkich maszyn warsztatowych, ale również ich projektowaniem, instalacją, certyfikacją UDT oraz serwisem pogwarancyjnym na terenie całego kraju.',
    contactEmail: 'projekty@serwissupply.pl',
    contactPhone: '+48 71 345 67 89',
    openingHours: 'Pon - Pt: 8:00 - 16:00',
    serviceArea: 'Cała Polska',
    deliveryTerms: 'Transport ciężki kalkulowany indywidualnie. Serwis i montaż na miejscu u klienta w cenie urządzenia.',
    responseTimeText: 'Zwykle odpowiada w 4 godziny',
    profileCompleteness: 94,
    featuredBrands: ['Karcher', 'Yato'],
    productCategories: ['Wyposażenie warsztatu', 'Narzędzia']
  },
  {
    id: 'mv-9',
    name: 'TruckParts Wielkopolska',
    slug: 'truckparts-wielkopolska',
    logoUrl: 'https://picsum.photos/seed/trucklogo/120/120',
    coverUrl: 'https://picsum.photos/seed/truckcover/800/400',
    category: 'Części samochodowe',
    city: 'Sady',
    address: 'ul. Rolna 12, 62-080 Sady',
    distanceKm: 14.5,
    isVerified: true,
    deliveryAvailable: true,
    collectionAvailable: true,
    shortDescription: 'Dystrybucja profesjonalnych części zamiennych do samochodów ciężarowych, naczep oraz autobusów.',
    longDescription: 'TruckParts specjalizuje się wyłącznie w rynku pojazdów użytkowych i ciężkich. Dostarczamy tarcze hamulcowe, miechy zawieszenia, elementy pneumatyki i oświetlenie do pojazdów marek MAN, Scania, DAF, Volvo, Iveco oraz naczep SAF/BPW.',
    contactEmail: 'truck@truckparts.com.pl',
    contactPhone: '+48 61 816 22 11',
    openingHours: 'Pon - Pt: 7:00 - 17:00, Sob: 8:00 - 12:00',
    serviceArea: 'Województwo Wielkopolskie, Zachodniopomorskie',
    deliveryTerms: 'Własne trasy logistyczne 2 razy dziennie w promieniu 50km. Wysyłka kurierem paletowym w 24h.',
    responseTimeText: 'Zwykle odpowiada w 1 godzinę',
    profileCompleteness: 87,
    featuredBrands: ['Brembo', 'Bosch'],
    productCategories: ['Części samochodowe', 'Łączniki i pneumatyka']
  },
  {
    id: 'mv-10',
    name: 'Warsztat Plus',
    slug: 'warsztat-plus',
    logoUrl: 'https://picsum.photos/seed/pluslogo/120/120',
    coverUrl: 'https://picsum.photos/seed/pluscover/800/400',
    category: 'Materiały eksploatacyjne',
    city: 'Konin',
    address: 'ul. Spółdzielców 4, 62-510 Konin',
    distanceKm: 105.0,
    isVerified: false,
    deliveryAvailable: true,
    collectionAvailable: true,
    shortDescription: 'Szybkie dostawy materiałów czyszczących, sorbentów, żarówek, opasek i drobnych akcesoriów.',
    longDescription: 'Warsztat Plus to sprawdzony partner w dostawach codziennych artykułów niezbędnych do funkcjonowania każdego serwisu. W naszym asortymencie znajdziesz czyściwa papierowe, pasty BHP do rąk, sorbenty do rozlewisk olejowych, żarówki halogenowe i ledowe, taśmy oraz chemię aerozolową.',
    contactEmail: 'sklep@warsztatplus.pl',
    contactPhone: '+48 63 240 10 20',
    openingHours: 'Pon - Pt: 8:00 - 17:00, Sob: 8:00 - 13:00',
    serviceArea: 'Wielkopolska Wschodnia',
    deliveryTerms: 'Darmowa dostawa na terenie Konina i okolic przy zamówieniach od 150 PLN.',
    responseTimeText: 'Zwykle odpowiada w 2 godziny',
    profileCompleteness: 80,
    featuredBrands: ['Philips', '3M', 'Wurth'],
    productCategories: ['Materiały eksploatacyjne', 'Elektryka pojazdowa']
  },
  {
    id: 'mv-11',
    name: 'ElectroCar',
    slug: 'electrocar',
    logoUrl: 'https://picsum.photos/seed/eleclogo/120/120',
    coverUrl: 'https://picsum.photos/seed/eleccover/800/400',
    category: 'Elektryka pojazdowa',
    city: 'Swarzędz',
    address: 'ul. Wrzesińska 52, 62-020 Swarzędz',
    distanceKm: 11.2,
    isVerified: true,
    deliveryAvailable: true,
    collectionAvailable: true,
    shortDescription: 'Akumulatory, alternatory, rozruszniki, czujniki samochodowe, bezpieczniki i okablowanie.',
    longDescription: 'ElectroCar to wyspecjalizowana hurtownia elektryki i elektroniki pojazdowej. Posiadamy na stanie ponad 5000 referencji akumulatorów rozruchowych, czujników układu silnikowego (ABS, ESP, ciśnienia spalin), cewek zapłonowych oraz profesjonalnych konektorów i przewodów instalacyjnych.',
    contactEmail: 'b2b@electrocar.poznan.pl',
    contactPhone: '+48 61 817 40 50',
    openingHours: 'Pon - Pt: 8:00 - 16:30',
    serviceArea: 'Wielkopolska Centralna',
    deliveryTerms: 'Bezpieczny transport akumulatorów (odbiór zużytych). Szybka dostawa własna na terenie Swarzędza i Poznania.',
    responseTimeText: 'Zwykle odpowiada w 30 minut',
    profileCompleteness: 91,
    featuredBrands: ['Bosch', 'Philips'],
    productCategories: ['Elektryka pojazdowa', 'Materiały eksploatacyjne']
  },
  {
    id: 'mv-12',
    name: 'FastMover Logistics',
    slug: 'fastmover-logistics',
    logoUrl: 'https://picsum.photos/seed/moverlogo/120/120',
    coverUrl: 'https://picsum.photos/seed/movercover/800/400',
    category: 'Materiały eksploatacyjne',
    city: 'Poznań',
    address: 'ul. Wichrowa 4, 60-449 Poznań',
    distanceKm: 4.1,
    isVerified: true,
    deliveryAvailable: true,
    collectionAvailable: true,
    shortDescription: 'Ekspresowe dostawy płynów chłodniczych, spryskiwaczy, olejów beczkowych i akcesoriów samochodowych.',
    longDescription: 'FastMover to wyspecjalizowany operator logistyczny i dystrybutor masowych płynów eksploatacyjnych. Posiadamy własne cysterny oraz magazyn wysokiego składowania płynów. Zaopatrujemy stacje paliw, serwisy flotowe i duże warsztaty w oleje silnikowe (również w beczkach 60L/208L) i płyny chłodnicze w konkurencyjnych cenach.',
    contactEmail: 'zamowienia@fastmover.pl',
    contactPhone: '+48 61 848 10 10',
    openingHours: 'Pon - Pt: 6:00 - 18:00',
    serviceArea: 'Cała Wielkopolska, woj. Lubuskie, Kujawsko-Pomorskie',
    deliveryTerms: 'Dostawa w 24h. Przy zamówieniach beczkowych gwarantujemy bezpłatną dostawę windą samochodową.',
    responseTimeText: 'Zwykle odpowiada w 15 minut',
    profileCompleteness: 89,
    featuredBrands: ['Castrol', 'Continental'],
    productCategories: ['Materiały eksploatacyjne', 'Chemia warsztatowa']
  }
];

// Helper to generate 100 products
// Let's manually create some core products, and use a generator to populate up to 100 high-quality products.
const baseProducts: PublicProduct[] = [
  {
    id: 'mp-1',
    name: 'Olej silnikowy Castrol EDGE 5W-30 LL 5L',
    slug: 'olej-silnikowy-castrol-edge-5w-30-ll-5l',
    vendorId: 'mv-1',
    brand: 'Castrol',
    category: 'Materiały eksploatacyjne',
    sku: 'CAS-5W30-EDGE-5L',
    imageUrl: 'https://picsum.photos/seed/castrol5w30/200/200',
    priceMode: 'exact',
    priceValue: 189.90,
    availability: 'Dostępny',
    unit: 'szt.',
    packSize: 4,
    minEnquiryQty: 4,
    description: 'Zaawansowany syntetyczny olej silnikowy Castrol EDGE 5W-30 LL z technologią Fluid TITANIUM fizycznie zmienia swoją strukturę, stając się mocniejszym pod obciążeniem, aby utrzymać dystans między metalowymi powierzchniami i zmniejszyć tarcie. Spełnia normy VW 504 00 / 507 00, MB 229.31/229.51, Porsche C30.',
    specifications: {
      'Lepkość': '5W-30',
      'Pojemność': '5 Litrów',
      'Klasa jakości': 'ACEA C3',
      'Zastosowanie': 'Silniki benzynowe i Diesla z filtrem DPF',
      'Technologia': 'Fluid TITANIUM'
    },
    isNew: true,
    sellMode: 'piece'
  },
  {
    id: 'mp-2',
    name: 'Klocki hamulcowe Brembo P 85 020 (Przód)',
    slug: 'klocki-hamulcowe-brembo-p-85-020-przod',
    vendorId: 'mv-1',
    brand: 'Brembo',
    category: 'Części samochodowe',
    sku: 'BRE-P85020',
    imageUrl: 'https://picsum.photos/seed/brembopads/200/200',
    priceMode: 'from',
    priceValue: 125.00,
    availability: 'Dostępny',
    unit: 'kpl.',
    packSize: 1,
    minEnquiryQty: 2,
    description: 'Wysokiej jakości klocki hamulcowe Brembo na oś przednią zapewniające maksymalne bezpieczeństwo, krótszą drogę hamowania i cichą pracę dzięki zastosowaniu zaawansowanej mieszanki ciernej. Zawierają czujnik zużycia oraz akcesoria montażowe.',
    specifications: {
      'Grubość': '19.7 mm',
      'Szerokość': '156.4 mm',
      'Wysokość': '71.4 mm',
      'System hamulcowy': 'Teves',
      'Oś': 'Przednia'
    },
    sellMode: 'package'
  },
  {
    id: 'mp-3',
    name: 'Zmywacz do hamulców Wurth Brake Cleaner 500ml',
    slug: 'zmywacz-do-hamulcow-wurth-brake-cleaner-500ml',
    vendorId: 'mv-3',
    brand: 'Wurth',
    category: 'Chemia warsztatowa',
    sku: 'WUR-08901087',
    imageUrl: 'https://picsum.photos/seed/wurthbrake/200/200',
    priceMode: 'exact',
    priceValue: 9.80,
    availability: 'Dostępny',
    unit: 'szt.',
    packSize: 12,
    minEnquiryQty: 12,
    description: 'Do szybkiego usuwania oleistych/tłustych osadów, sadzy, pyłu hamulcowego na pojazdach, hamulcach tarczowych i bębnowych, obudowach silników i skrzyń biegów. Nie zawiera acetonu ani silikonu.',
    specifications: {
      'Pojemność': '500 ml',
      'Opakowanie zbiorcze': 'Karton 12 szt.',
      'Kolor': 'Bezbarwny',
      'Baza chemiczna': 'Nafta alifatyczna'
    },
    sellMode: 'both'
  },
  {
    id: 'mp-4',
    name: 'Wózek narzędziowy Yato YT-0902 z wyposażeniem 177 cz.',
    slug: 'wozek-narzedziowy-yato-yt-0902-z-wyposazeniem-177-cz',
    vendorId: 'mv-2',
    brand: 'Yato',
    category: 'Narzędzia',
    sku: 'YAT-YT-0902',
    imageUrl: 'https://picsum.photos/seed/yatotrolley/200/200',
    priceMode: 'range',
    priceValue: 1850.00,
    priceMax: 2100.00,
    availability: 'Ograniczona dostępność',
    unit: 'szt.',
    packSize: 1,
    minEnquiryQty: 1,
    description: 'Profesjonalna szafka serwisowa Yato wyposażona w 6 szuflad na prowadnicach kulkowych. Zawiera 177 specjalnie dobranych narzędzi w profilowanych wkładkach z pianki EVA. Ściany boczne perforowane do montażu akcesoriów, centralny zamek, stabilne koła z hamulcem.',
    specifications: {
      'Ilość szuflad': '6',
      'Ilość narzędzi': '177 sztuk',
      'Nośność max': '300 kg',
      'Wymiary szafki': '975 x 765 x 465 mm',
      'Materiał': 'Blacha stalowa lakierowana proszkowo'
    },
    sellMode: 'piece'
  },
  {
    id: 'mp-5',
    name: 'Rękawice nitrylowe ochronne 3M Comfort Grip (L)',
    slug: 'rekawice-nitrylowe-ochronne-3m-comfort-grip-l',
    vendorId: 'mv-4',
    brand: '3M',
    category: 'Bezpieczeństwo i BHP',
    sku: '3M-CG-NIT-L',
    imageUrl: 'https://picsum.photos/seed/3mgloves/200/200',
    priceMode: 'exact',
    priceValue: 14.50,
    availability: 'Dostępny',
    unit: 'para',
    packSize: 10,
    minEnquiryQty: 10,
    description: 'Oddychające rękawice robocze 3M pokryte mikro-porowatą pianką nitrylową na dłoni. Zapewniają doskonałą chwytność narzędzi w środowisku zaolejonym i suchym, wysoką odporność na ścieranie i precyzję dotykową.',
    specifications: {
      'Rozmiar': 'L (9)',
      'Powłoka': 'Spieniony nitryl',
      'Materiał bazy': 'Dzianina nylonowa elastyczna',
      'Zastosowanie': 'Montaż precyzyjny, mechanika pojazdowa, logistyka'
    }
  },
  {
    id: 'mp-6',
    name: 'Myjka wysokociśnieniowa Karcher HDS 8/18-4 C Classic',
    slug: 'myjka-wysokocisnieniowa-karcher-hds-8-18-4-c-classic',
    vendorId: 'mv-8',
    brand: 'Karcher',
    category: 'Wyposażenie warsztatu',
    sku: 'KAR-HDS-818',
    imageUrl: 'https://picsum.photos/seed/karcherhds/200/200',
    priceMode: 'on_request',
    availability: 'Na zamówienie',
    unit: 'szt.',
    packSize: 1,
    minEnquiryQty: 1,
    description: 'Trójfazowa myjka wysokociśnieniowa z podgrzewaniem wody klasy kompaktowej. Wyposażona w 4-biegunowy wolnoobrotowy silnik chłodzony wodą oraz innowacyjny tryb eco!efficiency obniżający zużycie paliwa o 20%. Przeznaczona do intensywnych prac w myjniach i serwisach.',
    specifications: {
      'Ciśnienie robocze': '30-180 bar',
      'Wydajność tłoczenia': '290-800 l/h',
      'Max temperatura': '80 / 155 °C',
      'Moc przyłącza': '6.0 kW',
      'Pojemność zbiornika paliwa': '15 Litrów'
    }
  },
  {
    id: 'mp-7',
    name: 'Tarcza hamulcowa Brembo Oro (Tył)',
    slug: 'tarcza-hamulcowa-brembo-oro-tyl',
    vendorId: 'mv-1',
    brand: 'Brembo',
    category: 'Części samochodowe',
    sku: 'BRE-09.B337.21',
    imageUrl: 'https://picsum.photos/seed/bremborotor/200/200',
    priceMode: 'after_login',
    availability: 'Zapytaj o dostępność',
    unit: 'szt.',
    packSize: 2,
    minEnquiryQty: 2,
    description: 'Wentylowana tarcza hamulcowa Brembo o wysokiej zawartości węgla (High Carbon), pokryta powłoką antykorozyjną UV, co gwarantuje doskonałe parametry termiczne i świetny wygląd przez długi czas. Sprzedawane wyłącznie w parach.',
    specifications: {
      'Średnica': '300 mm',
      'Grubość tarczy': '22 mm',
      'Minimalna grubość': '20 mm',
      'Ilość otworów': '5',
      'Typ': 'Wentylowana, pokrywana'
    }
  },
  {
    id: 'mp-8',
    name: 'Półmaska lakiernicza 3M serii 6000 z filtrami A2P3',
    slug: 'polmaska-lakiernicza-3m-serii-6000-z-filtrami-a2p3',
    vendorId: 'mv-5',
    brand: '3M',
    category: 'Bezpieczeństwo i BHP',
    sku: '3M-6200-SET',
    imageUrl: 'https://picsum.photos/seed/3mmask/200/200',
    priceMode: 'exact',
    priceValue: 145.00,
    availability: 'Dostępny',
    unit: 'szt.',
    packSize: 1,
    minEnquiryQty: 1,
    description: 'Kompletny zestaw lakierniczy gotowy do użycia. Zawiera półmaskę wielokrotnego użytku 3M 6200 (rozmiar M), dwa pochłaniacze gazów organicznych 6055 A2, cztery filtry cząstek stałych 5925 P2 oraz dwa pierścienie mocujące filtry 501. Chroni przed oparami rozpuszczalników organicznych i pyłem.',
    specifications: {
      'Rozmiar półmaski': 'M (średnia)',
      'Norma maski': 'EN 140:1998',
      'Norma filtrów': 'EN 14387 / EN 143',
      'Klasa ochrony': 'A2P2 (gazy organiczne, pyły)'
    },
    isNew: true
  }
];

// Let's generate remaining products to reach exactly 100 products.
export const mockProducts: PublicProduct[] = [...baseProducts];

// Let's dynamically generate remaining 92 products to have rich search and catalogs
const categoriesPool = mockCategories;
const brandsPool = mockBrands;
const vendorsPool = mockVendors;
const availPool: PublicAvailability[] = ['Dostępny', 'Ograniczona dostępność', 'Na zamówienie', 'Zapytaj o dostępność'];
const priceModes: PublicPriceMode[] = ['exact', 'from', 'range', 'on_request', 'after_login'];

const namesByCategory: Record<string, string[]> = {
  'Części samochodowe': [
    'Tarcza hamulcowa Brembo Sport', 'Klocki hamulcowe Bosch Blue', 'Filtry oleju Mann-Filter HU', 'Świece zapłonowe Bosch Iridium',
    'Amortyzator przedni Sachs G', 'Sprzęgło kompletne LUK Pro', 'Pasek klinowy Gates Micro', 'Wahacz przedni Lemforder',
    'Łącznik stabilizatora Meyle HD', 'Przegub napędowy Lobro'
  ],
  'Chemia warsztatowa': [
    'Zmywacz do hamulców Wurth Pro', 'Smar miedziowy spray Wurth', 'Smar silikonowy Karcher Clean', 'Płyn wielozadaniowy WD-40 5L',
    'Penetrant odrdzewiacz Wurth Rost', 'Środek do czyszczenia wtrysków Castrol', 'Klej anaerobowy do gwintów Wurth', 'Smar wysokotemperaturowy do łożysk',
    'Pasta montażowa do wydechów', 'Pianka do czyszczenia klimatyzacji Wurth'
  ],
  'Narzędzia': [
    'Zestaw kluczy nasadowych Yato 1/2 3/8 1/4 108cz', 'Klucz pneumatyczny Yato 1350 Nm', 'Wkrętak akumulatorowy Bosch GO', 'Klucz dynamometryczny Yato 40-200Nm',
    'Szczypce nastawne do rur Wurth', 'Zestaw bitów i wierteł Bosch Tough', 'Młotek ślusarski Yato 500g', 'Suwmiarka cyfrowa Yato 150mm',
    'Zestaw wykrętaków do zerwanych śrub', 'Próbnik napięcia 12-24V Wurth'
  ],
  'Wyposażenie warsztatu': [
    'Podnośnik dwukolumnowy Serwis Supply 4T', 'Kompresor tłokowy Serwis Supply 200L', 'Wyważarka do kół Yato Professional', 'Montażownica do opon Serwis Supply',
    'Wysysarka do oleju pneumatyczna', 'Prasa hydrauliczna warsztatowa 20T', 'Zlewarka oleju grawitacyjna 80L', 'Ładowarka z rozruchem akumulatorów 12/24V',
    'Lampa warsztatowa LED podmaskowa Philips', 'Lampa inspekcyjna LED akumulatorowa Philips'
  ],
  'Bezpieczeństwo i BHP': [
    'Okulary ochronne 3M SecureFit przyciemniane', 'Maska przeciwpyłowa 3M Aura FFP3', 'Zatyczki do uszu 3M z pałąkiem', 'Szelki bezpieczeństwa 3M do prac na wysokości',
    'Apteczka warsztatowa pierwszej pomocy ścienna', 'Gaśnica proszkowaGP-4x warsztatowa', 'Sorbent mineralny do oleju Absodan 20kg', 'Parawan spawalniczy ochronny 3M',
    'Maska spawalnicza automatyczna 3M Speedglas', 'Okulary ochronne przeciwodpryskowe 3M'
  ],
  'Odzież robocza': [
    'Spodnie robocze ogrodniczki SafetyCore', 'Kombinezon warsztatowy mechanika SafetyCore', 'Kurtka robocza softshell SafetyCore', 'Buty robocze S3 z metalowym noskiem',
    'Trzewiki ochronne zimowe SafetyCore S3', 'Koszulka polo robocza SafetyCore czarna', 'Kamizelka ostrzegawcza odblaskowa SafetyCore', 'Czapka robocza z daszkiem ochronnym',
    'Polar warsztatowy wzmocniony SafetyCore', 'Rękawice robocze skórzane SafetyCore'
  ],
  'Materiały lakiernicze': [
    'Podkład akrylowy LakierTech 5:1 HS 1L', 'Lakier bezbarwny LakierTech 2:1 Scratch Resistant', 'Szpachlówka uniwersalna LakierTech z włóknem', 'Zmywacz silikonowy LakierTech 5L',
    'Krążek ścierny 3M Hookit P500 150mm', 'Taśma maskująca lakiernicza 3M Premium', 'Pistolet lakierniczy natryskowy SATA-style', 'Sita lakiernicze jednorazowe 125 mic',
    'Kubki lakiernicze z podziałką LakierTech 1L', 'Folia maskująca lakiernicza z taśmą 3M'
  ],
  'Opony i akcesoria': [
    'Opona Continental PremiumContact 6 205/55R16', 'Opona Continental WinterContact TS 870', 'Ciężarki klejone do felg aluminiowych stalowe 5g', 'Zawór bezdętkowy TR413 gumowy',
    'Klej do opon aktywator ProfiOpony', 'Łatka wulkanizacyjna do dętek ProfiOpony', 'Pasta montażowa do opon ProfiOpony 3kg', 'Kreda wulkanizacyjna żółta',
    'Czujnik ciśnienia opon TPMS uniwersalny', 'Wyważarka ręczna do kół motocyklowych'
  ],
  'Materiały eksploatacyjne': [
    'Filtry kabinowe węglowe Mann-Filter CUK', 'Świece żarowe Bosch Duraterm', 'Pióra wycieraczek Bosch AeroTwin komplet', 'Płyn hamulcowy Castrol React DOT 4 1L',
    'Płyn chłodniczy koncentrat Castrol Radicool', 'Żarówki halogenowe Philips H7 X-treme', 'Żarówki LED retrofit Philips H4 LED', 'Płyn do spryskiwaczy zimowy FastMover 5L',
    'Płyn do spryskiwaczy letni FastMover 5L', 'Bezpieczniki samochodowe zestaw płytkowych'
  ],
  'Elektryka pojazdowa': [
    'Akumulator Bosch S5 AGM 70Ah 760A', 'Akumulator Bosch S4 45Ah 400A', 'Regulator napięcia alternatora Bosch', 'Przewody rozruchowe miedziane Yato 600A',
    'Taśma izolacyjna materiałowa tesa Pro', 'Konektory samochodowe zestaw ze szczypcami', 'Tester akumulatorów cyfrowy Yato', 'Cewka zapłonowa Bosch Twin',
    'Syrena alarmowa samochodowa 12V', 'Przekaźnik samochodowy uniwersalny 12V 40A'
  ],
  'Kosmetyki samochodowe': [
    'Szampon samochodowy z woskiem CleanChem 5L', 'Płyn do mycia szyb samochodowych CleanChem', 'Preparat do czyszczenia kokpitu matowy', 'Aktywna pianka do mycia aut CleanChem 5L',
    'Wosk syntetyczny twardy do lakieru CleanChem', 'Środek do czyszczenia tapicerki skórzanej', 'Glinka lakiernicza do usuwania osadów', 'Ręcznik z mikrofibry do osuszania lakieru',
    'Czernidło do opon i plastików zewnętrznych', 'Zapach samochodowy premium CleanChem spray'
  ],
  'Łączniki i pneumatyka': [
    'Szybkozłącze pneumatyczne gniazdo na wąż', 'Wąż pneumatyczny poliuretanowy spiralny 10m', 'Opaski zaciskowe ślimakowe stalowe zestaw', 'Odwadniacz filtr powietrza do kompresora',
    'Naolejacz pneumatyczny do narzędzi Yato', 'Pistolet do przedmuchiwania powietrzem Wurth', 'Zestaw nitonakrętek stalowych Yato M3-M10', 'Pistolet pneumatyczny do pompowania kół',
    'Nitownica dźwigniowa do nitów Yato', 'Kołki rozporowe i spinki samochodowe zestaw'
  ]
};

let seed = 42;
function random(): number {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

let productCounter = 9; // starts after baseProducts (mp-8)
const generatedIds = new Set(baseProducts.map(p => p.id));

while (productCounter <= 100) {
  // pick a random category
  const category = categoriesPool[Math.floor(random() * categoriesPool.length)];
  const names = namesByCategory[category];
  if (!names) continue;

  const rawName = names[Math.floor(random() * names.length)];
  
  // pick a random brand
  const brand = brandsPool[Math.floor(random() * brandsPool.length)];
  
  // ensure we generate a distinct name by attaching brand or SKU
  const productId = `mp-${productCounter}`;
  const sku = `${brand.substring(0,3).toUpperCase()}-${Math.floor(100000 + random() * 900000)}`;
  const name = `${rawName} ${brand} (${sku.split('-')[1]})`;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  // select a vendor whose profile includes this product's category
  let matchingVendors = vendorsPool.filter(v => v.productCategories.includes(category));
  if (matchingVendors.length === 0) {
    matchingVendors = [vendorsPool[Math.floor(random() * vendorsPool.length)]];
  }
  const vendor = matchingVendors[Math.floor(random() * matchingVendors.length)];

  const priceMode = priceModes[Math.floor(random() * priceModes.length)];
  let priceValue: number | undefined = undefined;
  let priceMax: number | undefined = undefined;

  if (priceMode === 'exact' || priceMode === 'from') {
    priceValue = parseFloat((20 + random() * 380).toFixed(2));
  } else if (priceMode === 'range') {
    priceValue = parseFloat((50 + random() * 100).toFixed(2));
    priceMax = parseFloat((priceValue + 50 + random() * 150).toFixed(2));
  }

  const availability = availPool[Math.floor(random() * availPool.length)];
  const packSize = [1, 2, 4, 6, 10, 12, 20, 24][Math.floor(random() * 8)];
  
  const specKeys: Record<string, string[]> = {
    'Lepkość': ['5W-30', '10W-40', '0W-20', '75W-90'],
    'Rozmiar': ['S', 'M', 'L', 'XL', 'XXL', '15 cali', '16 cali', '17 cali'],
    'Moc': ['100W', '250W', '500W', '1200W', '2000W'],
    'Materiał': ['Stal stopowa', 'Poliuretan', 'Skóra syntetyczna', 'Mikrofibra', 'Aluminium'],
    'Kraj produkcji': ['Niemcy', 'Polska', 'Włochy', 'Japonia'],
    'Certyfikat': ['CE', 'TUV', 'ISO 9001', 'EN 388', 'EN 166']
  };

  const specifications: Record<string, string> = {
    'Kod EAN': `590${Math.floor(1000000000 + random() * 9000000000)}`,
    'Gwarancja': '24 miesiące B2B'
  };

  // Add 2 more random specs
  const specKeysAvailable = Object.keys(specKeys);
  const specKey1 = specKeysAvailable[Math.floor(random() * specKeysAvailable.length)];
  specifications[specKey1] = specKeys[specKey1][Math.floor(random() * specKeys[specKey1].length)];
  
  const product: PublicProduct = {
    id: productId,
    name,
    slug,
    vendorId: vendor.id,
    brand,
    category,
    sku,
    imageUrl: `https://picsum.photos/seed/prod${productCounter}/200/200`,
    priceMode,
    priceValue,
    priceMax,
    availability,
    unit: category === 'Odzież robocza' || category === 'Narzędzia' || category === 'Wyposażenie warsztatu' ? 'szt.' : 'op.',
    packSize,
    minEnquiryQty: packSize === 1 ? 5 : packSize,
    description: `Wysokiej jakości ${name.toLowerCase()} dedykowany do profesjonalnych zastosowań warsztatowych. Produkt zaprojektowany z myślą o wysokiej wytrzymałości i niezawodności w trudnych warunkach eksploatacyjnych. Sprawdzony w setkach warsztatów w całej Polsce.`,
    specifications,
    isNew: random() > 0.85
  };

  mockProducts.push(product);
  productCounter++;
}

// 8 Public Catalogs
export const mockCatalogs: PublicCatalog[] = [
  {
    id: 'mc-1',
    vendorId: 'mv-1',
    title: 'Katalog Układów Hamulcowych Brembo B2B',
    coverUrl: 'https://picsum.photos/seed/catcover1/300/400',
    description: 'Pełen asortyment tarcze i klocki hamulcowe Brembo Oro, Sport oraz serii standardowej.',
    category: 'Części samochodowe',
    productCount: 15,
    lastUpdated: '2026-06-15',
    productIds: ['mp-2', 'mp-7', 'mp-10', 'mp-20', 'mp-30']
  },
  {
    id: 'mc-2',
    vendorId: 'mv-2',
    title: 'Wózki i Wyposażenie Warsztatowe Yato 2026',
    coverUrl: 'https://picsum.photos/seed/catcover2/300/400',
    description: 'Kompletne szafki serwisowe, zestawy kluczy, narzędzia pneumatyczne i oświetlenie.',
    category: 'Narzędzia',
    productCount: 22,
    lastUpdated: '2026-07-01',
    productIds: ['mp-4', 'mp-15', 'mp-25', 'mp-35', 'mp-45']
  },
  {
    id: 'mc-3',
    vendorId: 'mv-3',
    title: 'Chemia Profesjonalna i Smary CleanChem',
    coverUrl: 'https://picsum.photos/seed/catcover3/300/400',
    description: 'Zmywacze, penetranty, smary miedziowe i silikonowe oraz koncentraty przemysłowe.',
    category: 'Chemia warsztatowa',
    productCount: 18,
    lastUpdated: '2026-05-20',
    productIds: ['mp-3', 'mp-11', 'mp-21', 'mp-31', 'mp-41']
  },
  {
    id: 'mc-4',
    vendorId: 'mv-4',
    title: 'Bezpieczeństwo i BHP w warsztacie 3M/SafetyCore',
    coverUrl: 'https://picsum.photos/seed/catcover4/300/400',
    description: 'Ochrona dróg oddechowych, okulary, rękawice nitrylowe oraz odzież ochronna.',
    category: 'Bezpieczeństwo i BHP',
    productCount: 14,
    lastUpdated: '2026-06-30',
    productIds: ['mp-5', 'mp-12', 'mp-22', 'mp-32', 'mp-42']
  },
  {
    id: 'mc-5',
    vendorId: 'mv-5',
    title: 'Systemy Polerskie i Dobór Lakierów LakierTech',
    coverUrl: 'https://picsum.photos/seed/catcover5/300/400',
    description: 'Profesjonalne podkłady, szpachlówki, krążki ścierne oraz systemy ochronne lakiernika.',
    category: 'Materiały lakiernicze',
    productCount: 12,
    lastUpdated: '2026-07-10',
    productIds: ['mp-8', 'mp-13', 'mp-23', 'mp-33', 'mp-43']
  },
  {
    id: 'mc-6',
    vendorId: 'mv-11',
    title: 'Instalacja Elektryczna i Akumulatory ElectroCar',
    coverUrl: 'https://picsum.photos/seed/catcover6/300/400',
    description: 'Rozruszniki, alternatory, zestawy bezpieczników oraz przewody i akumulatory AGM.',
    category: 'Elektryka pojazdowa',
    productCount: 20,
    lastUpdated: '2026-07-05',
    productIds: ['mp-14', 'mp-24', 'mp-34', 'mp-44', 'mp-54']
  },
  {
    id: 'mc-7',
    vendorId: 'mv-7',
    title: 'Ogumienie Continental i Akcesoria ProfiOpony',
    coverUrl: 'https://picsum.photos/seed/catcover7/300/400',
    description: 'Wulkanizacja, opony osobowe, SUV, ciężarowe oraz zawory TPMS i wyważarki.',
    category: 'Opony i akcesoria',
    productCount: 16,
    lastUpdated: '2026-06-18',
    productIds: ['mp-16', 'mp-26', 'mp-36', 'mp-46', 'mp-56']
  },
  {
    id: 'mc-8',
    vendorId: 'mv-12',
    title: 'Płyny Masowe i Oleje Beczkowe FastMover',
    coverUrl: 'https://picsum.photos/seed/catcover8/300/400',
    description: 'Koncentraty chłodnicze, spryskiwacze, oleje Castrol w beczkach dla serwisów.',
    category: 'Materiały eksploatacyjne',
    productCount: 19,
    lastUpdated: '2026-07-11',
    productIds: ['mp-1', 'mp-17', 'mp-27', 'mp-37', 'mp-47']
  }
];

// 10 Promotions
export const mockPromotions: PublicPromotion[] = [
  {
    id: 'mprom-1',
    vendorId: 'mv-1',
    title: 'Tydzień Układu Hamulcowego Brembo',
    description: 'Kup min. 4 komplety klocków Brembo, a otrzymasz zmywacz do hamulców gratis oraz dodatkowe 5% rabatu przy wycenie.',
    validFrom: '2026-07-10',
    validTo: '2026-07-20',
    badgeText: '-5% na klocki i tarcze',
    productIds: ['mp-2', 'mp-7']
  },
  {
    id: 'mprom-2',
    vendorId: 'mv-3',
    title: 'Czyszczenie Magazynów CleanChem',
    description: 'Zmywacze Wurth 500ml w super cenie 9.80 PLN przy zamówieniach kartonowych (wielokrotność 12 sztuk).',
    validFrom: '2026-07-01',
    validTo: '2026-07-31',
    badgeText: 'HIT CENOWY',
    productIds: ['mp-3']
  },
  {
    id: 'mprom-3',
    vendorId: 'mv-2',
    title: 'Wyposażenie warsztatu Yato w leasingu 0%',
    description: 'Zapytaj o darmowe finansowanie wózków narzędziowych i szafek serwisowych Yato.',
    validFrom: '2026-06-15',
    validTo: '2026-07-30',
    badgeText: 'Leasing 0%',
    productIds: ['mp-4']
  },
  {
    id: 'mprom-4',
    vendorId: 'mv-4',
    title: 'BHP SafetyCore - Bezpieczny Warsztat',
    description: 'Kup odzież roboczą SafetyCore za min. 500 PLN, a otrzymasz opakowanie rękawic nitrylowych 3M za 1 PLN.',
    validFrom: '2026-07-12',
    validTo: '2026-07-25',
    badgeText: 'Pakiet BHP 1 PLN',
    productIds: ['mp-5']
  },
  {
    id: 'mprom-5',
    vendorId: 'mv-5',
    title: 'Pakiet Lakiernika 3M',
    description: 'Wszystkie maski lakiernicze serii 6000 oraz krążki ścierne w cenach hurtowych bez konieczności rejestracji.',
    validFrom: '2026-07-05',
    validTo: '2026-07-25',
    badgeText: 'LAKIER-MIX',
    productIds: ['mp-8']
  },
  {
    id: 'mprom-6',
    vendorId: 'mv-12',
    title: 'Beczkowe szaleństwo Castrol',
    description: 'Przy zamówieniu beczki oleju silnikowego Castrol 60L dostajesz firmowy kombinezon mechanika gratis.',
    validFrom: '2026-07-01',
    validTo: '2026-07-31',
    badgeText: 'PREZENT DO BECZKI',
    productIds: ['mp-1']
  },
  {
    id: 'mprom-7',
    vendorId: 'mv-11',
    title: 'Akumulatory Bosch AGM z gwarancją rozruchu',
    description: 'Wycena pakietowa akumulatorów Bosch AGM na sezon letni. Odbiór zużytych akumulatorów w cenie.',
    validFrom: '2026-07-01',
    validTo: '2026-08-31',
    badgeText: 'AGM HIT',
    productIds: ['mp-14', 'mp-24']
  },
  {
    id: 'mprom-8',
    vendorId: 'mv-7',
    title: 'Sezon na opony Continental',
    description: 'Darmowa dostawa przy zapytaniu o min. 8 opon Continental PremiumContact lub WinterContact.',
    validFrom: '2026-07-10',
    validTo: '2026-07-31',
    badgeText: 'Darmowy kurier',
    productIds: ['mp-16', 'mp-26']
  },
  {
    id: 'mprom-9',
    vendorId: 'mv-8',
    title: 'Promocja na ciężkie myjki Karcher',
    description: 'Urządzenia wysokociśnieniowe HDS 8/18 podlegają bezpłatnej demonstracji w Twoim warsztacie przed zakupem.',
    validFrom: '2026-07-01',
    validTo: '2026-08-15',
    badgeText: 'Darmowe Demo',
    productIds: ['mp-6']
  },
  {
    id: 'mprom-10',
    vendorId: 'mv-10',
    title: 'Materiały warsztatowe w pakietach',
    description: 'Czyściwa, sorbenty i opaski zaciskowe. Kup 3 pudła czyściwa, 4-te otrzymasz za pół ceny.',
    validFrom: '2026-07-01',
    validTo: '2026-07-31',
    badgeText: '3+1 za 50%',
    productIds: ['mp-28', 'mp-38']
  }
];

// 5 Digital Flyers
// These should resemble brochures or catalogs, with structured pages.
export const mockFlyers: PublicFlyer[] = [
  {
    id: 'mfl-1',
    slug: 'gazetka-bezpieczny-warsztat-bhp',
    vendorId: 'mv-4',
    title: 'Gazetka Bezpieczeństwa BHP - Lato 2026',
    coverUrl: 'https://picsum.photos/seed/flycover1/300/400',
    validFrom: '2026-07-01',
    validTo: '2026-07-31',
    pages: [
      {
        pageNumber: 1,
        layoutType: 'hero',
        title: 'Komfort i bezpieczeństwo w upalne dni',
        productIds: ['mp-5'],
        headline: 'Rękawice Nitrylowe 3M Comfort Grip',
        description: 'Doskonałe dopasowanie, wysoka oddychalność i odporność na zaolejenia. Zapewnij swoim pracownikom komfort nawet w 30-stopniowym upale.'
      },
      {
        pageNumber: 2,
        layoutType: 'grid',
        title: 'Pełna ochrona dróg oddechowych',
        productIds: ['mp-12', 'mp-22', 'mp-32', 'mp-42']
      },
      {
        pageNumber: 3,
        layoutType: 'duo',
        title: 'Buty i Spodnie Robocze Premium',
        productIds: ['mp-18', 'mp-19']
      },
      {
        pageNumber: 4,
        layoutType: 'cta',
        title: 'Zamów profesjonalną wycenę BHP dla Twojej firmy',
        productIds: [],
        headline: 'Zapytaj o rabaty ilościowe',
        description: 'Nasi doradcy bezpłatnie dobiorą odpowiednie środki ochrony indywidualnej i przygotują ofertę szytą na miarę Twojego serwisu.'
      }
    ]
  },
  {
    id: 'mfl-2',
    slug: 'renowacja-i-lakierowanie-profesjonalne',
    vendorId: 'mv-5',
    title: 'Renowacja i Lakierowanie - Nowości LakierTech',
    coverUrl: 'https://picsum.photos/seed/flycover2/300/400',
    validFrom: '2026-07-05',
    validTo: '2026-07-25',
    pages: [
      {
        pageNumber: 1,
        layoutType: 'hero',
        title: 'Zdrowe płuca przy lakierowaniu',
        productIds: ['mp-8'],
        headline: 'Kompletny Zestaw Lakierniczy 3M serii 6000',
        description: 'Niezawodna ochrona przed oparami lakierów organicznych, rozpuszczalników i pyłu ściernego. Zestaw z pochłaniaczami i filtrami.'
      },
      {
        pageNumber: 2,
        layoutType: 'grid',
        title: 'Materiały ścierne i taśmy 3M',
        productIds: ['mp-13', 'mp-23', 'mp-33', 'mp-43']
      },
      {
        pageNumber: 3,
        layoutType: 'comparison',
        title: 'Porównanie podkładów akrylowych',
        productIds: ['mp-13', 'mp-23'],
        headline: 'Zwykły podkład vs High Structure HS',
        description: 'Zobacz różnicę w sile krycia, czasie schnięcia oraz łatwości szlifowania. Wybierz rozwiązanie dostosowane do czasu pracy w kabinie.'
      },
      {
        pageNumber: 4,
        layoutType: 'cta',
        title: 'Skonfiguruj swoje zapytanie lakiernicze',
        productIds: [],
        headline: 'Ekspresowe dopasowanie koloru',
        description: 'Prześlij nam numery lakierów OEM (kod lakieru z tabliczki znamionowej), a przygotujemy wycenę gotowych zestawów lakierniczych.'
      }
    ]
  },
  {
    id: 'mfl-3',
    slug: 'narzedzia-reczne-i-pneumatyczne-yato',
    vendorId: 'mv-2',
    title: 'Narzędzia Yato - Wyposażenie Warsztatowe',
    coverUrl: 'https://picsum.photos/seed/flycover3/300/400',
    validFrom: '2026-06-15',
    validTo: '2026-07-30',
    pages: [
      {
        pageNumber: 1,
        layoutType: 'hero',
        title: 'Szafka Twoich marzeń',
        productIds: ['mp-4'],
        headline: 'Wózek narzędziowy Yato 177 cz.',
        description: 'Wszystkie klucze nasadowe, płaskie, oczkowe, szczypce i wkrętaki posegregowane w trwałych piankach EVA. Solidna stalowa szafka.'
      },
      {
        pageNumber: 2,
        layoutType: 'grid',
        title: 'Elektronarzędzia pneumatyczne',
        productIds: ['mp-15', 'mp-25', 'mp-35', 'mp-45']
      },
      {
        pageNumber: 3,
        layoutType: 'cta',
        title: 'Kupuj taniej w zestawach B2B',
        productIds: [],
        headline: 'Wyposażenie warsztatu od A do Z',
        description: 'Planujesz otwarcie nowego stanowiska lub modernizację? Prześlij nam listę potrzebnych narzędzi, a otrzymasz dedykowany rabat ilościowy.'
      }
    ]
  },
  {
    id: 'mfl-4',
    slug: 'chemia-i-czystosc-cleanchem',
    vendorId: 'mv-3',
    title: 'Przewodnik Czystości Warsztatowej CleanChem',
    coverUrl: 'https://picsum.photos/seed/flycover4/300/400',
    validFrom: '2026-07-01',
    validTo: '2026-08-31',
    pages: [
      {
        pageNumber: 1,
        layoutType: 'hero',
        title: 'Koniec z piskami i zabrudzeniami',
        productIds: ['mp-3'],
        headline: 'Zmywacz do hamulców Wurth Brake Cleaner',
        description: 'Błyskawicznie odtłuszcza i czyści, odparowuje bez pozostawiania śladów. Idealny do tarcz hamulcowych, sprzęgieł i bloków silnika.'
      },
      {
        pageNumber: 2,
        layoutType: 'grid',
        title: 'Kosmetyki samochodowe i środki czyszczące',
        productIds: ['mp-11', 'mp-21', 'mp-31', 'mp-41']
      }
    ]
  },
  {
    id: 'mfl-5',
    slug: 'akumulatory-i-elektryka-2026',
    vendorId: 'mv-11',
    title: 'Niezawodny Prąd - Akumulatory AGM Bosch',
    coverUrl: 'https://picsum.photos/seed/flycover5/300/400',
    validFrom: '2026-07-01',
    validTo: '2026-08-31',
    pages: [
      {
        pageNumber: 1,
        layoutType: 'hero',
        title: 'Moc dla systemów Start-Stop',
        productIds: ['mp-14'],
        headline: 'Akumulator Bosch S5 AGM 70Ah 760A',
        description: 'Technologia Absorbent Glass Mat zapewnia 4-krotnie dłuższą żywotność cykliczną i bezkompromisowy rozruch w każdych warunkach.'
      },
      {
        pageNumber: 2,
        layoutType: 'grid',
        title: 'Elektryka, oświetlenie i bezpieczniki',
        productIds: ['mp-24', 'mp-34', 'mp-44', 'mp-54']
      }
    ]
  }
];

// Enriching matching product list for flyers and catalogs so clicking on a product works
// Let's make sure productIds listed in mockCatalogs and mockFlyers exist in mockProducts:
mockCatalogs.forEach(catalog => {
  catalog.productIds = catalog.productIds.map((pid, idx) => {
    // ensure mockProducts has it, otherwise assign an existing one
    const pExists = mockProducts.some(p => p.id === pid);
    if (!pExists) {
      // borrow an ID
      return mockProducts[idx % mockProducts.length].id;
    }
    return pid;
  });
});

mockFlyers.forEach(flyer => {
  flyer.pages.forEach(page => {
    page.productIds = page.productIds.map((pid, idx) => {
      const pExists = mockProducts.some(p => p.id === pid);
      if (!pExists) {
        return mockProducts[(idx + 5) % mockProducts.length].id;
      }
      return pid;
    });
  });
});
