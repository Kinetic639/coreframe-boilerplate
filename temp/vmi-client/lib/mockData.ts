import {
  ClientLocation,
  Vendor,
  Product,
  InventoryBalance,
  StockCountRequest,
  ReplenishmentProposal,
  Order,
  Promotion,
  DigitalFlyer,
  Showroom,
  Quotation,
  Conversation,
  Notification,
  UserProfile
} from './types';

export const currentUser: UserProfile = {
  name: 'Michał Stępień',
  role: 'Branch Manager', // Kierownik Oddziału
  organization: 'AutoService Komorniki',
  currentLocationId: 'loc-1'
};

export const mockLocations: ClientLocation[] = [
  {
    id: 'loc-1',
    name: 'Komorniki Warsztat',
    address: 'ul. Poznańska 14, 62-052 Komorniki'
  },
  {
    id: 'loc-2',
    name: 'Poznań Punkt Serwisowy',
    address: 'ul. Głogowska 120, 60-205 Poznań'
  }
];

export const mockVendors: Vendor[] = [
  {
    id: 'v-1',
    name: 'AutoParts Pro',
    industry: 'Części samochodowe i eksploatacyjne',
    accentColor: 'blue',
    connectionStatus: 'Aktywny',
    accountManager: {
      name: 'Tomasz Kowalski',
      phone: '+48 601 234 567',
      email: 't.kowalski@autopartspro.pl'
    },
    announcements: [
      {
        id: 'ann-1',
        title: 'Przerwa wakacyjna centrum logistycznego',
        content: 'Informujemy, że w dniach 1-5 sierpnia nasze główne centrum dystrybucyjne będzie nieaktywne z powodu inwentaryzacji. Prosimy o wcześniejsze składanie zamówień uzupełniających.',
        date: '2026-07-10'
      },
      {
        id: 'ann-2',
        title: 'Nowe tarcze hamulcowe ATE w ofercie',
        content: 'Od dzisiaj w katalogu dostępne są najnowsze tarcze powlekane ATE do modeli hybrydowych. Sprawdź warunki handlowe.',
        date: '2026-07-05'
      }
    ]
  },
  {
    id: 'v-2',
    name: 'WerkTools',
    industry: 'Profesjonalne narzędzia i wyposażenie',
    accentColor: 'orange',
    connectionStatus: 'Aktywny',
    accountManager: {
      name: 'Andrzej Wiśniewski',
      phone: '+48 602 987 654',
      email: 'a.wisniewski@werktools.pl'
    },
    announcements: [
      {
        id: 'ann-3',
        title: 'Katalog Jesień 2026 już dostępny!',
        content: 'Z przyjemnością udostępniamy najnowszy cyfrowy folder z nowościami narzędziowymi Milwaukee i Beta. Dostępne specjalne ceny pakietowe.',
        date: '2026-07-12'
      }
    ]
  },
  {
    id: 'v-3',
    name: 'CleanChem',
    industry: 'Chemia warsztatowa i środki czyszczące',
    accentColor: 'green',
    connectionStatus: 'Aktywny',
    accountManager: {
      name: 'Karolina Nowak',
      phone: '+48 501 111 222',
      email: 'k.nowak@cleanchem.com.pl'
    },
    announcements: [
      {
        id: 'ann-4',
        title: 'Aktualizacja kart charakterystyki substancji (REACH)',
        content: 'Zaktualizowane karty charakterystyki dla zmywaczy i odtłuszczaczy zostały dodane do załączników produktów w portalu.',
        date: '2026-07-08'
      }
    ]
  },
  {
    id: 'v-4',
    name: 'SafetyCore',
    industry: 'Odzież robocza, BHP i ochrona osobista',
    accentColor: 'red',
    connectionStatus: 'Aktywny',
    accountManager: {
      name: 'Mariusz Lewandowski',
      phone: '+48 703 555 444',
      email: 'm.lewandowski@safetycore.pl'
    },
    announcements: [
      {
        id: 'ann-5',
        title: 'Certyfikacja rękawic nitrylowych uległa zmianie',
        content: 'Nasze rękawice GripPro otrzymały podwyższoną klasę odporności na ścieranie EN388. Szczegóły u doradcy.',
        date: '2026-07-01'
      }
    ]
  }
];

export const mockProducts: Product[] = [
  // V-1: AutoParts Pro (10 produktów)
  {
    id: 'p-1',
    vendorId: 'v-1',
    name: 'Klocki hamulcowe TRW GDB1330',
    vendorSku: 'TRW-GDB1330',
    clientSku: 'SKU-K-001',
    category: 'Układ hamulcowy',
    unitOfMeasure: 'kpl.',
    packSize: 4,
    minOrderQty: 4,
    price: 145.00,
    availability: 'Wysoka',
    leadTime: '24h',
    imageUrl: 'https://picsum.photos/seed/trwbrakes/400/300',
    description: 'Wysokiej jakości klocki hamulcowe przeznaczone do osi przedniej samochodów z grupy VAG. Zapewniają doskonałą skuteczność i długą żywotność.',
    documents: [
      { name: 'Karta produktu TRW GDB1330.pdf', url: '#' },
      { name: 'Certyfikat zgodności WE.pdf', url: '#' }
    ],
    notes: 'Standardowy montaż w VW Golf, Audi A3, Skoda Octavia.',
    substitutes: ['p-2']
  },
  {
    id: 'p-2',
    vendorId: 'v-1',
    name: 'Klocki hamulcowe Brembo P85072',
    vendorSku: 'BREMBO-P85072',
    clientSku: 'SKU-K-002',
    category: 'Układ hamulcowy',
    unitOfMeasure: 'kpl.',
    packSize: 2,
    minOrderQty: 2,
    price: 169.00,
    promoPrice: 149.00,
    availability: 'Średnia',
    leadTime: '24h',
    imageUrl: 'https://picsum.photos/seed/brembobrakes/400/300',
    description: 'Klocki hamulcowe klasy premium o zredukowanym pyleniu. Znakomite odprowadzanie ciepła i odporność na fading.',
    documents: [{ name: 'Karta techniczna Brembo.pdf', url: '#' }],
    notes: 'Alternatywa o podwyższonej wydajności dla TRW GDB1330.',
    substitutes: ['p-1']
  },
  {
    id: 'p-3',
    vendorId: 'v-1',
    name: 'Tarcza hamulcowa ATE 24.0122-0150.1',
    vendorSku: 'ATE-240122',
    clientSku: 'SKU-T-010',
    category: 'Układ hamulcowy',
    unitOfMeasure: 'szt.',
    packSize: 2,
    minOrderQty: 2,
    price: 198.00,
    availability: 'Wysoka',
    leadTime: '24h',
    imageUrl: 'https://picsum.photos/seed/atediscs/400/300',
    description: 'Tarcza hamulcowa wentylowana i powlekana, odporna na korozję. Średnica 288mm. Zapewnia natychmiastowe hamowanie bez pisków.',
    documents: [{ name: 'Instrukcja montażu tarcz ATE.pdf', url: '#' }],
    substitutes: []
  },
  {
    id: 'p-4',
    vendorId: 'v-1',
    name: 'Filtr oleju Mann-Filter HU 711/51 x',
    vendorSku: 'MANN-HU711',
    clientSku: 'SKU-F-020',
    category: 'Filtry',
    unitOfMeasure: 'szt.',
    packSize: 10,
    minOrderQty: 10,
    price: 28.50,
    availability: 'Wysoka',
    leadTime: '24h',
    imageUrl: 'https://picsum.photos/seed/mannfilter/400/300',
    description: 'Filtr oleju z wkładem filtracyjnym o wysokiej chłonności. Skutecznie separuje zanieczyszczenia stałe z oleju silnikowego.',
    documents: [{ name: 'Katalog Mann Filter 2026.pdf', url: '#' }],
    notes: 'Szybka rotacja. Trzymać zapas.',
    substitutes: ['p-5']
  },
  {
    id: 'p-5',
    vendorId: 'v-1',
    name: 'Filtr oleju Filtron OE648/6',
    vendorSku: 'FILT-OE6486',
    clientSku: 'SKU-F-021',
    category: 'Filtry',
    unitOfMeasure: 'szt.',
    packSize: 10,
    minOrderQty: 10,
    price: 19.90,
    availability: 'Wysoka',
    leadTime: '24h',
    imageUrl: 'https://picsum.photos/seed/filtron/400/300',
    description: 'Wysokiej jakości polski odpowiednik filtra Mann-Filter. Bardzo dobry stosunek ceny do jakości.',
    documents: [],
    substitutes: ['p-4']
  },
  {
    id: 'p-6',
    vendorId: 'v-1',
    name: 'Filtr kabinowy węglowy Mann CUK 2939',
    vendorSku: 'MANN-CUK2939',
    clientSku: 'SKU-F-035',
    category: 'Filtry',
    unitOfMeasure: 'szt.',
    packSize: 5,
    minOrderQty: 5,
    price: 64.00,
    availability: 'Średnia',
    leadTime: '24h',
    imageUrl: 'https://picsum.photos/seed/manncabin/400/300',
    description: 'Filtr kabinowy z aktywnym węglem chroni przed kurzem, pyłkami, gazami i nieprzyjemnymi zapachami z zewnątrz.',
    documents: [],
    substitutes: []
  },
  {
    id: 'p-7',
    vendorId: 'v-1',
    name: 'Świeca zapłonowa NGK Laser Platinum LFR6AIX-11',
    vendorSku: 'NGK-LFR6AIX',
    clientSku: 'SKU-S-005',
    category: 'Układ zapłonowy',
    unitOfMeasure: 'szt.',
    packSize: 8,
    minOrderQty: 8,
    price: 49.00,
    availability: 'Wysoka',
    leadTime: '24h',
    imageUrl: 'https://picsum.photos/seed/ngkplug/400/300',
    description: 'Świeca zapłonowa platynowa o ekstremalnej trwałości. Elektroda środkowa z platyny zapewnia stabilną iskrę w każdych warunkach.',
    documents: [{ name: 'Tabela doboru świec NGK.pdf', url: '#' }],
    substitutes: []
  },
  {
    id: 'p-8',
    vendorId: 'v-1',
    name: 'Amortyzator gazowy Kayaba Excel-G 339700',
    vendorSku: 'KYB-339700',
    clientSku: 'SKU-A-044',
    category: 'Zawieszenie',
    unitOfMeasure: 'szt.',
    packSize: 2,
    minOrderQty: 2,
    price: 210.00,
    availability: 'Średnia',
    leadTime: '2-3 dni',
    imageUrl: 'https://picsum.photos/seed/kybshock/400/300',
    description: 'Dwururowy amortyzator gazowy przywracający oryginalne właściwości jezdne pojazdu. Wyjątkowa trwałość.',
    documents: [],
    substitutes: []
  },
  {
    id: 'p-9',
    vendorId: 'v-1',
    name: 'Żarówka H7 Philips Vision +30%',
    vendorSku: 'PHILIPS-H7V',
    clientSku: 'SKU-Z-087',
    category: 'Oświetlenie',
    unitOfMeasure: 'szt.',
    packSize: 10,
    minOrderQty: 10,
    price: 16.80,
    availability: 'Wysoka',
    leadTime: '24h',
    imageUrl: 'https://picsum.photos/seed/philipsh7/400/300',
    description: 'Żarówka halogenowa H7 dająca 30% więcej światła w porównaniu ze standardowymi żarówkami. Trwała i odporna na wstrząsy.',
    documents: [],
    substitutes: []
  },
  {
    id: 'p-10',
    vendorId: 'v-1',
    name: 'Płyn hamulcowy ATE SL.6 DOT4 1L',
    vendorSku: 'ATE-DOT4-SL6',
    clientSku: 'SKU-P-090',
    category: 'Płyny eksploatacyjne',
    unitOfMeasure: 'szt.',
    packSize: 6,
    minOrderQty: 6,
    price: 34.50,
    availability: 'Wysoka',
    leadTime: '24h',
    imageUrl: 'https://picsum.photos/seed/atedot4/400/300',
    description: 'Płyn hamulcowy o niskiej lepkości, idealnie zoptymalizowany dla nowoczesnych układów hamulcowych z ESP i ABS.',
    documents: [{ name: 'Karta charakterystyki ATE SL6.pdf', url: '#' }],
    substitutes: []
  },

  // V-2: WerkTools (10 produktów)
  {
    id: 'p-11',
    vendorId: 'v-2',
    name: 'Klucz udarowy akumulatorowy Milwaukee M18 FMTIW2F12',
    vendorSku: 'MIL-M18FMTIW',
    clientSku: 'SKU-N-201',
    category: 'Elektronarzędzia',
    unitOfMeasure: 'szt.',
    packSize: 1,
    minOrderQty: 1,
    price: 1199.00,
    availability: 'Średnia',
    leadTime: '2-3 dni',
    imageUrl: 'https://picsum.photos/seed/milwaukeewrench/400/300',
    description: 'Kompaktowy klucz udarowy M18 FUEL o średnim momencie obrotowym. Dostarcza do 745 Nm momentu zrywającego przy wadze zaledwie 2.3 kg.',
    documents: [
      { name: 'Instrukcja obsługi M18 FMTIW.pdf', url: '#' },
      { name: 'Gwarancja 3 lata Milwaukee.pdf', url: '#' }
    ],
    notes: 'Flagowe narzędzie w warsztacie.'
  },
  {
    id: 'p-12',
    vendorId: 'v-2',
    name: 'Zestaw kluczy nasadowych Beta 903E/C93 1/4+1/2',
    vendorSku: 'BETA-903EC93',
    clientSku: 'SKU-N-202',
    category: 'Narzędzia ręczne',
    unitOfMeasure: 'kpl.',
    packSize: 1,
    minOrderQty: 1,
    price: 489.00,
    promoPrice: 429.00,
    availability: 'Wysoka',
    leadTime: '24h',
    imageUrl: 'https://picsum.photos/seed/betatools/400/300',
    description: 'Profesjonalny 93-częściowy zestaw kluczy nasadowych i akcesoriów. Stal chromowo-wanadowa najwyższej próby. Poręczna walizka.',
    documents: [{ name: 'Ulotka promocyjna Beta 903.pdf', url: '#' }],
    substitutes: []
  },
  {
    id: 'p-13',
    vendorId: 'v-2',
    name: 'Suwmiarka cyfrowa Mitutoyo CD-15APX 150mm',
    vendorSku: 'MIT-500-196-30',
    clientSku: 'SKU-N-203',
    category: 'Narzędzia pomiarowe',
    unitOfMeasure: 'szt.',
    packSize: 1,
    minOrderQty: 1,
    price: 520.00,
    availability: 'Niska',
    leadTime: '3-5 dni',
    imageUrl: 'https://picsum.photos/seed/mitutoyocal/400/300',
    description: 'Suwmiarka cyfrowa Mitutoyo Absolute AOS o wysokiej dokładności pomiarowej (0.01 mm). Elektro-magnetyczny czujnik indukcyjny.',
    documents: [{ name: 'Certyfikat kalibracji fabrycznej.pdf', url: '#' }],
    substitutes: []
  },
  {
    id: 'p-14',
    vendorId: 'v-2',
    name: 'Lampa warsztatowa LED Scangrip Nova 4 Connect',
    vendorSku: 'SCAN-NOVA4',
    clientSku: 'SKU-N-204',
    category: 'Oświetlenie robocze',
    unitOfMeasure: 'szt.',
    packSize: 1,
    minOrderQty: 1,
    price: 360.00,
    availability: 'Wysoka',
    leadTime: '24h',
    imageUrl: 'https://picsum.photos/seed/scangriplight/400/300',
    description: 'Wszechstronny naświetlacz roboczy COB LED dostarczający do 4000 lumenów. Kompatybilny z akumulatorami 18V popularnych marek.',
    documents: [],
    substitutes: []
  },
  {
    id: 'p-15',
    vendorId: 'v-2',
    name: 'Zestaw wkrętaków Wera Kraftform Plus 300 6cz',
    vendorSku: 'WERA-105650',
    clientSku: 'SKU-N-205',
    category: 'Narzędzia ręczne',
    unitOfMeasure: 'kpl.',
    packSize: 3,
    minOrderQty: 3,
    price: 115.00,
    availability: 'Wysoka',
    leadTime: '24h',
    imageUrl: 'https://picsum.photos/seed/werascrews/400/300',
    description: 'Zestaw wkrętaków płaskich i krzyżowych z ergonomiczną rękojeścią Kraftform zapobiegającą powstawaniu pęcherzy.',
    documents: [],
    substitutes: []
  },
  {
    id: 'p-16',
    vendorId: 'v-2',
    name: 'Wkrętak dynamometryczny Wera 7440',
    vendorSku: 'WERA-7440',
    clientSku: 'SKU-N-206',
    category: 'Narzędzia ręczne',
    unitOfMeasure: 'szt.',
    packSize: 1,
    minOrderQty: 1,
    price: 380.00,
    availability: 'Średnia',
    leadTime: '2-3 dni',
    imageUrl: 'https://picsum.photos/seed/weratorque/400/300',
    description: 'Rękojeść nastawcza pistoletowa o zakresie 0.3 - 1.2 Nm. Zapewnia precyzyjne dokręcanie elementów elektronicznych.',
    documents: [],
    substitutes: []
  },
  {
    id: 'p-17',
    vendorId: 'v-2',
    name: 'Szczypce nastawne Knipex Cobra 250mm',
    vendorSku: 'KNIP-8701250',
    clientSku: 'SKU-N-207',
    category: 'Narzędzia ręczne',
    unitOfMeasure: 'szt.',
    packSize: 5,
    minOrderQty: 5,
    price: 128.00,
    availability: 'Wysoka',
    leadTime: '24h',
    imageUrl: 'https://picsum.photos/seed/knipex/400/300',
    description: 'Zaawansowane szczypce do rur i nakrętek z samozaciskającym się mechanizmem i precyzyjną regulacją przyciskiem.',
    documents: [],
    substitutes: []
  },
  {
    id: 'p-18',
    vendorId: 'v-2',
    name: 'Szczypce tnące boczne Knipex 160mm',
    vendorSku: 'KNIP-7001160',
    clientSku: 'SKU-N-208',
    category: 'Narzędzia ręczne',
    unitOfMeasure: 'szt.',
    packSize: 5,
    minOrderQty: 5,
    price: 89.00,
    availability: 'Wysoka',
    leadTime: '24h',
    imageUrl: 'https://picsum.photos/seed/knipexcut/400/300',
    description: 'Niezbędne szczypce tnące boczne z ostrzami precyzyjnymi do miękkiego i twardego drutu.',
    documents: [],
    substitutes: []
  },
  {
    id: 'p-19',
    vendorId: 'v-2',
    name: 'Grzechotka Beta 920/55 1/2 cala',
    vendorSku: 'BETA-92055',
    clientSku: 'SKU-N-209',
    category: 'Narzędzia ręczne',
    unitOfMeasure: 'szt.',
    packSize: 2,
    minOrderQty: 2,
    price: 185.00,
    availability: 'Średnia',
    leadTime: '24h',
    imageUrl: 'https://picsum.photos/seed/betaratchet/400/300',
    description: 'Wysokiej jakości rewersyjna grzechotka 1/2 cala z mechanizmem 72 zębów dla małego kąta roboczego.',
    documents: [],
    substitutes: []
  },
  {
    id: 'p-20',
    vendorId: 'v-2',
    name: 'Tester ciśnienia sprężania Yato YT-73024',
    vendorSku: 'YATO-YT73024',
    clientSku: 'SKU-N-210',
    category: 'Diagnostyka',
    unitOfMeasure: 'szt.',
    packSize: 1,
    minOrderQty: 1,
    price: 154.00,
    availability: 'Wysoka',
    leadTime: '24h',
    imageUrl: 'https://picsum.photos/seed/yatotester/400/300',
    description: 'Próbnik ciśnienia sprężania z manometrem przeznaczony do silników benzynowych.',
    documents: [],
    substitutes: []
  },

  // V-3: CleanChem (10 produktów)
  {
    id: 'p-21',
    vendorId: 'v-3',
    name: 'Zmywacz do hamulców Wurth Brake Cleaner 500ml',
    vendorSku: 'WURTH-08901087',
    clientSku: 'SKU-C-301',
    category: 'Aerozole techniczne',
    unitOfMeasure: 'szt.',
    packSize: 24, // Karton
    minOrderQty: 24,
    price: 11.20,
    promoPrice: 8.90,
    availability: 'Wysoka',
    leadTime: '24h',
    imageUrl: 'https://picsum.photos/seed/wurthclean/400/300',
    description: 'Wysoce skuteczny preparat czyszczący do tarcz hamulcowych, klocków oraz sprzęgieł. Błyskawicznie odtłuszcza i nie pozostawia osadów.',
    documents: [
      { name: 'Karta charakterystyki Wurth Brake Cleaner.pdf', url: '#' },
      { name: 'Karta techniczna zmywacza.pdf', url: '#' }
    ],
    notes: 'Kluczowy produkt eksploatacyjny warsztatu. Duże zużycie.',
    substitutes: ['p-22']
  },
  {
    id: 'p-22',
    vendorId: 'v-3',
    name: 'Zmywacz do części hamulcowych K2 600ml',
    vendorSku: 'K2-W125',
    clientSku: 'SKU-C-302',
    category: 'Aerozole techniczne',
    unitOfMeasure: 'szt.',
    packSize: 12,
    minOrderQty: 12,
    price: 9.80,
    availability: 'Wysoka',
    leadTime: '24h',
    imageUrl: 'https://picsum.photos/seed/k2clean/400/300',
    description: 'Skuteczny i tańszy zmywacz do hamulców o pojemności 600ml. Bardzo dobre ciśnienie aplikacji.',
    documents: [],
    substitutes: ['p-21']
  },
  {
    id: 'p-23',
    vendorId: 'v-3',
    name: 'Olej silnikowy Castrol Edge 5W-30 LL 5L',
    vendorSku: 'CAST-5W30-5L',
    clientSku: 'SKU-C-303',
    category: 'Oleje i smary',
    unitOfMeasure: 'szt.',
    packSize: 4,
    minOrderQty: 4,
    price: 219.00,
    availability: 'Wysoka',
    leadTime: '24h',
    imageUrl: 'https://picsum.photos/seed/castroloil/400/300',
    description: 'Syntetyczny olej silnikowy premium z technologią Fluid TITANIUM. Spełnia rygorystyczne normy VW 504 00 / 507 00.',
    documents: [{ name: 'Castrol Edge Specyfikacja.pdf', url: '#' }],
    substitutes: ['p-24']
  },
  {
    id: 'p-24',
    vendorId: 'v-3',
    name: 'Olej silnikowy Mobil 1 ESP 5W-30 5L',
    vendorSku: 'MOBIL-5W30-5L',
    clientSku: 'SKU-C-304',
    category: 'Oleje i smary',
    unitOfMeasure: 'szt.',
    packSize: 4,
    minOrderQty: 4,
    price: 195.00,
    availability: 'Średnia',
    leadTime: '24h',
    imageUrl: 'https://picsum.photos/seed/mobiloil/400/300',
    description: 'Olej silnikowy syntetyczny dedykowany do ochrony systemów redukcji emisji spalin DPF i GPF.',
    documents: [],
    substitutes: ['p-23']
  },
  {
    id: 'p-25',
    vendorId: 'v-3',
    name: 'Odrdzewiacz z MoS2 WD-40 Specialist 400ml',
    vendorSku: 'WD40-MOS2-400',
    clientSku: 'SKU-C-305',
    category: 'Aerozole techniczne',
    unitOfMeasure: 'szt.',
    packSize: 12,
    minOrderQty: 12,
    price: 24.50,
    availability: 'Wysoka',
    leadTime: '24h',
    imageUrl: 'https://picsum.photos/seed/wd40/400/300',
    description: 'Szybko działający penetrant wzbogacony o dwusiarczek molibdenu (MoS2), ułatwiający odkręcanie najbardziej zapieczonych śrub.',
    documents: [],
    substitutes: []
  },
  {
    id: 'p-26',
    vendorId: 'v-3',
    name: 'Smar miedziowy CX-80 Spray 500ml',
    vendorSku: 'CX80-MIEDZ-500',
    clientSku: 'SKU-C-306',
    category: 'Oleje i smary',
    unitOfMeasure: 'szt.',
    packSize: 12,
    minOrderQty: 12,
    price: 19.50,
    availability: 'Wysoka',
    leadTime: '24h',
    imageUrl: 'https://picsum.photos/seed/cx80miedz/400/300',
    description: 'Smar miedziowy wysokotemperaturowy (do 1100°C). Chroni przed zapiekaniem i korozją części pracujących pod dużym obciążeniem.',
    documents: [],
    substitutes: []
  },
  {
    id: 'p-27',
    vendorId: 'v-3',
    name: 'Pasta do mycia rąk Dreumex Classic 4.5kg',
    vendorSku: 'DREU-CLASS-45',
    clientSku: 'SKU-C-307',
    category: 'Higiena warsztatowa',
    unitOfMeasure: 'szt.',
    packSize: 2,
    minOrderQty: 2,
    price: 88.00,
    availability: 'Średnia',
    leadTime: '24h',
    imageUrl: 'https://picsum.photos/seed/dreumexpaste/400/300',
    description: 'Profesjonalna pasta żelowa do silnych zabrudzeń rąk z mikrogranulkami. Skutecznie usuwa smary, oleje, smołę i kleje.',
    documents: [{ name: 'Atest dermatologiczny Dreumex.pdf', url: '#' }],
    substitutes: []
  },
  {
    id: 'p-28',
    vendorId: 'v-3',
    name: 'Sorbent mineralny Damolin Absodan Plus 20kg',
    vendorSku: 'DAM-ABSODAN-20',
    clientSku: 'SKU-C-308',
    category: 'Higiena warsztatowa',
    unitOfMeasure: 'szt.',
    packSize: 1,
    minOrderQty: 5, // paleta lub paczka
    price: 54.00,
    availability: 'Wysoka',
    leadTime: '24h',
    imageUrl: 'https://picsum.photos/seed/sorbent/400/300',
    description: 'Naturalny sorbent mineralny o uziarnieniu 0.5-1 mm. Błyskawicznie wchłania oleje, płyny chłodnicze, paliwa i wodę z posadzki.',
    documents: [],
    substitutes: []
  },
  {
    id: 'p-29',
    vendorId: 'v-3',
    name: 'Płyn chłodniczy Borygo Nowy G12+ Różowy 5L',
    vendorSku: 'BORYGO-G12-5L',
    clientSku: 'SKU-C-309',
    category: 'Płyny eksploatacyjne',
    unitOfMeasure: 'szt.',
    packSize: 4,
    minOrderQty: 4,
    price: 39.00,
    availability: 'Wysoka',
    leadTime: '24h',
    imageUrl: 'https://picsum.photos/seed/borygocool/400/300',
    description: 'Nowoczesny płyn do chłodnic samochodowych na bazie glikolu etylowego. Zapewnia ochronę przed zamarzaniem do -35°C.',
    documents: [],
    substitutes: []
  },
  {
    id: 'p-30',
    vendorId: 'v-3',
    name: 'Pianka do czyszczenia klimatyzacji Liqui Moly 250ml',
    vendorSku: 'LM-4087',
    clientSku: 'SKU-C-310',
    category: 'Aerozole techniczne',
    unitOfMeasure: 'szt.',
    packSize: 6,
    minOrderQty: 6,
    price: 48.00,
    availability: 'Wysoka',
    leadTime: '24h',
    imageUrl: 'https://picsum.photos/seed/liquimolyac/400/300',
    description: 'Wysoce skuteczna pianka do odgrzybiania i czyszczenia parowników klimatyzacji. Likwiduje bakterie i grzyby.',
    documents: [],
    substitutes: []
  },

  // V-4: SafetyCore (10 produktów)
  {
    id: 'p-31',
    vendorId: 'v-4',
    name: 'Trzewiki robocze skórzane S3 Portwest Steelite',
    vendorSku: 'PORT-S3-BOOT',
    clientSku: 'SKU-B-401',
    category: 'Obuwie robocze',
    unitOfMeasure: 'pary',
    packSize: 1,
    minOrderQty: 2,
    price: 185.00,
    promoPrice: 159.00,
    availability: 'Wysoka',
    leadTime: '24h',
    imageUrl: 'https://picsum.photos/seed/portwestboots/400/300',
    description: 'Wygodne i bezpieczne trzewiki S3 ze stalowym podnoskiem oraz wkładką antyprzebiciową. Wodoodporna skóra licowa.',
    documents: [
      { name: 'Deklaracja zgodności Portwest S3.pdf', url: '#' },
      { name: 'Tabela rozmiarów obuwia.pdf', url: '#' }
    ],
    notes: 'Zamawiać regularne rozmiary 42, 43, 44.'
  },
  {
    id: 'p-32',
    vendorId: 'v-4',
    name: 'Spodnie robocze monterskie Snickers Workwear 6241 Stretch',
    vendorSku: 'SNIC-6241',
    clientSku: 'SKU-B-402',
    category: 'Odzież robocza',
    unitOfMeasure: 'szt.',
    packSize: 1,
    minOrderQty: 1,
    price: 490.00,
    availability: 'Średnia',
    leadTime: '2-3 dni',
    imageUrl: 'https://picsum.photos/seed/snickerspants/400/300',
    description: 'Profesjonalne elastyczne spodnie robocze z kieszeniami kaburowymi. Wyjątkowo trwały materiał Cordura Stretch.',
    documents: [{ name: 'Katalog Snickers 2026.pdf', url: '#' }],
    substitutes: ['p-33']
  },
  {
    id: 'p-33',
    vendorId: 'v-4',
    name: 'Spodnie robocze do pasa Urgent Combat',
    vendorSku: 'URG-COMBAT-P',
    clientSku: 'SKU-B-403',
    category: 'Odzież robocza',
    unitOfMeasure: 'szt.',
    packSize: 1,
    minOrderQty: 1,
    price: 145.00,
    availability: 'Wysoka',
    leadTime: '24h',
    imageUrl: 'https://picsum.photos/seed/urgentpants/400/300',
    description: 'Klasyczne, solidne spodnie monterskie z bawełny i poliestru o gramaturze 280g/m2. Wzmocnienia na kolanach.',
    documents: [],
    substitutes: ['p-32']
  },
  {
    id: 'p-34',
    vendorId: 'v-4',
    name: 'Rękawice nitrylowe bezpudrowe Grippaz Orange 50szt',
    vendorSku: 'GRIP-OR-50',
    clientSku: 'SKU-B-404',
    category: 'Środki ochrony indywidualnej',
    unitOfMeasure: 'op.',
    packSize: 10, // karton zbiorczy
    minOrderQty: 10,
    price: 78.00,
    availability: 'Wysoka',
    leadTime: '24h',
    imageUrl: 'https://picsum.photos/seed/grippazgloves/400/300',
    description: 'Grube, elastyczne rękawice nitrylowe z opatentowanym wzorem "rybiej łuski". Zapewniają niesamowity chwyt w środowisku zaolejonym.',
    documents: [{ name: 'Karta dopuszczeń Grippaz warsztat.pdf', url: '#' }],
    notes: 'Kluczowe dla mechaników. Bardzo szybka rotacja.',
    substitutes: ['p-35']
  },
  {
    id: 'p-35',
    vendorId: 'v-4',
    name: 'Rękawice robocze powlekane nitrylem Ansell HyFlex 11-840',
    vendorSku: 'ANSELL-11840',
    clientSku: 'SKU-B-405',
    category: 'Środki ochrony indywidualnej',
    unitOfMeasure: 'pary',
    packSize: 12,
    minOrderQty: 12,
    price: 12.50,
    availability: 'Wysoka',
    leadTime: '24h',
    imageUrl: 'https://picsum.photos/seed/ansellgloves/400/300',
    description: 'Ultracienkie i odporne na ścieranie rękawice robocze. Chronią dłonie, zachowując pełne czucie dotykowe.',
    documents: [],
    substitutes: ['p-34']
  },
  {
    id: 'p-36',
    vendorId: 'v-4',
    name: 'Okulary ochronne przyciemniane Uvex Pheos cx2',
    vendorSku: 'UVEX-PHEOS-CX2',
    clientSku: 'SKU-B-406',
    category: 'Środki ochrony indywidualnej',
    unitOfMeasure: 'szt.',
    packSize: 5,
    minOrderQty: 5,
    price: 49.00,
    availability: 'Wysoka',
    leadTime: '24h',
    imageUrl: 'https://picsum.photos/seed/uvexglasses/400/300',
    description: 'Okulary ochronne z powłoką odporną na zarysowania i parowanie. Doskonałe dopasowanie do twarzy dzięki elastycznym elementom.',
    documents: [],
    substitutes: []
  },
  {
    id: 'p-37',
    vendorId: 'v-4',
    name: 'Półmaska filtrująca FFP2 3M Aura 1862+ 20szt',
    vendorSku: '3M-1862-FFP2',
    clientSku: 'SKU-B-407',
    category: 'Środki ochrony indywidualnej',
    unitOfMeasure: 'op.',
    packSize: 5,
    minOrderQty: 5,
    price: 135.00,
    availability: 'Średnia',
    leadTime: '24h',
    imageUrl: 'https://picsum.photos/seed/3mmask/400/300',
    description: 'Wysokiej klasy półmaska filtrująca o składanej, 3-panelowej konstrukcji. Skuteczna ochrona przed pyłami zawieszonymi.',
    documents: [],
    substitutes: []
  },
  {
    id: 'p-38',
    vendorId: 'v-4',
    name: 'Nauszniki ochronne 3M Peltor Optime I H510A',
    vendorSku: '3M-PELTOR-OP1',
    clientSku: 'SKU-B-408',
    category: 'Środki ochrony indywidualnej',
    unitOfMeasure: 'szt.',
    packSize: 2,
    minOrderQty: 2,
    price: 110.00,
    availability: 'Średnia',
    leadTime: '2-3 dni',
    imageUrl: 'https://picsum.photos/seed/peltor/400/300',
    description: 'Słuchawki wygłuszające hałas, bardzo lekkie i komfortowe przy długotrwałym noszeniu w głośnym warsztacie (tłumienie 27 dB).',
    documents: [],
    substitutes: []
  },
  {
    id: 'p-39',
    vendorId: 'v-4',
    name: 'Apteczka warsztatowa ścienna DIN 13157',
    vendorSku: 'APTECZKA-DIN13157',
    clientSku: 'SKU-B-409',
    category: 'Wyposażenie BHP',
    unitOfMeasure: 'szt.',
    packSize: 1,
    minOrderQty: 1,
    price: 125.00,
    availability: 'Wysoka',
    leadTime: '24h',
    imageUrl: 'https://picsum.photos/seed/firstaid/400/300',
    description: 'Apteczka z tworzywa sztucznego wyposażona zgodnie z normą DIN 13157, z uchwytem ściennym i instrukcją pierwszej pomocy.',
    documents: [],
    substitutes: []
  },
  {
    id: 'p-40',
    vendorId: 'v-4',
    name: 'Kamizelka ostrzegawcza żółta Portwest C470',
    vendorSku: 'PORT-VEST-C470',
    clientSku: 'SKU-B-410',
    category: 'Odzież robocza',
    unitOfMeasure: 'szt.',
    packSize: 10,
    minOrderQty: 10,
    price: 11.50,
    availability: 'Wysoka',
    leadTime: '24h',
    imageUrl: 'https://picsum.photos/seed/highvisvest/400/300',
    description: 'Kamizelka odblaskowa o wysokiej widoczności, zapinana na rzep, z dwoma pasami odblaskowymi wokół torsu.',
    documents: [],
    substitutes: []
  }
];

// Stany zapasów (Inventory Balances) dla 2 lokalizacji (Komorniki [loc-1], Poznań [loc-2])
// Musimy stworzyć dokładnie min. 12 produktów o stanie "low-stock" (Below minimum lub Out of stock)
export const mockInventoryBalances: InventoryBalance[] = [
  // LOKALIZACJA 1: KOMORNIKI (Główna lokalizacja warsztatu)
  // v-1: AutoParts Pro
  { productId: 'p-1', locationId: 'loc-1', currentStock: 8, minStock: 6, targetStock: 16, incomingQty: 0, lastUpdated: '2026-07-12T10:00:00Z', stockStatus: 'Healthy' },
  { productId: 'p-2', locationId: 'loc-1', currentStock: 1, minStock: 4, targetStock: 8, incomingQty: 0, lastUpdated: '2026-07-11T12:00:00Z', stockStatus: 'Below minimum' }, // [LOW STOCK 1]
  { productId: 'p-3', locationId: 'loc-1', currentStock: 5, minStock: 4, targetStock: 12, incomingQty: 4, lastUpdated: '2026-07-10T08:30:00Z', stockStatus: 'Approaching minimum' },
  { productId: 'p-4', locationId: 'loc-1', currentStock: 45, minStock: 20, targetStock: 50, incomingQty: 0, lastUpdated: '2026-07-12T14:15:00Z', stockStatus: 'Healthy' },
  { productId: 'p-5', locationId: 'loc-1', currentStock: 0, minStock: 10, targetStock: 30, incomingQty: 0, lastUpdated: '2026-07-09T11:00:00Z', stockStatus: 'Out of stock' }, // [LOW STOCK 2]
  { productId: 'p-6', locationId: 'loc-1', currentStock: 3, minStock: 5, targetStock: 15, incomingQty: 0, lastUpdated: '2026-07-05T09:00:00Z', stockStatus: 'Below minimum' }, // [LOW STOCK 3]
  { productId: 'p-7', locationId: 'loc-1', currentStock: 24, minStock: 16, targetStock: 40, incomingQty: 0, lastUpdated: '2026-07-12T10:00:00Z', stockStatus: 'Healthy' },
  { productId: 'p-8', locationId: 'loc-1', currentStock: 2, minStock: 2, targetStock: 6, incomingQty: 2, lastUpdated: '2026-07-11T16:45:00Z', stockStatus: 'Approaching minimum' },
  { productId: 'p-9', locationId: 'loc-1', currentStock: 35, minStock: 20, targetStock: 80, incomingQty: 0, lastUpdated: '2026-07-12T10:00:00Z', stockStatus: 'Healthy' },
  { productId: 'p-10', locationId: 'loc-1', currentStock: 12, minStock: 12, targetStock: 30, incomingQty: 0, lastUpdated: '2026-07-10T11:20:00Z', stockStatus: 'Approaching minimum' },

  // v-2: WerkTools
  { productId: 'p-11', locationId: 'loc-1', currentStock: 2, minStock: 1, targetStock: 3, incomingQty: 0, lastUpdated: '2026-07-12T15:00:00Z', stockStatus: 'Healthy' },
  { productId: 'p-12', locationId: 'loc-1', currentStock: 3, minStock: 1, targetStock: 4, incomingQty: 0, lastUpdated: '2026-07-12T15:00:00Z', stockStatus: 'Healthy' },
  { productId: 'p-13', locationId: 'loc-1', currentStock: 0, minStock: 1, targetStock: 2, incomingQty: 0, lastUpdated: '2026-07-04T12:00:00Z', stockStatus: 'Out of stock' }, // [LOW STOCK 4]
  { productId: 'p-14', locationId: 'loc-1', currentStock: 4, minStock: 2, targetStock: 6, incomingQty: 0, lastUpdated: '2026-07-11T10:00:00Z', stockStatus: 'Healthy' },
  { productId: 'p-15', locationId: 'loc-1', currentStock: 15, minStock: 9, targetStock: 24, incomingQty: 0, lastUpdated: '2026-07-12T15:00:00Z', stockStatus: 'Healthy' },
  { productId: 'p-16', locationId: 'loc-1', currentStock: 1, minStock: 1, targetStock: 2, incomingQty: 0, lastUpdated: '2026-07-02T13:00:00Z', stockStatus: 'Needs verification' },
  { productId: 'p-17', locationId: 'loc-1', currentStock: 12, minStock: 10, targetStock: 20, incomingQty: 0, lastUpdated: '2026-07-12T15:00:00Z', stockStatus: 'Healthy' },
  { productId: 'p-18', locationId: 'loc-1', currentStock: 8, minStock: 10, targetStock: 20, incomingQty: 0, lastUpdated: '2026-07-01T14:00:00Z', stockStatus: 'Count outdated' }, // [LOW STOCK 5]
  { productId: 'p-19', locationId: 'loc-1', currentStock: 4, minStock: 4, targetStock: 10, incomingQty: 0, lastUpdated: '2026-07-12T15:00:00Z', stockStatus: 'Approaching minimum' },
  { productId: 'p-20', locationId: 'loc-1', currentStock: 2, minStock: 1, targetStock: 3, incomingQty: 0, lastUpdated: '2026-07-12T15:00:00Z', stockStatus: 'Healthy' },

  // v-3: CleanChem (Several low stocks as per request)
  { productId: 'p-21', locationId: 'loc-1', currentStock: 12, minStock: 48, targetStock: 144, incomingQty: 0, lastUpdated: '2026-07-11T09:00:00Z', stockStatus: 'Below minimum' }, // [LOW STOCK 6]
  { productId: 'p-22', locationId: 'loc-1', currentStock: 2, minStock: 12, targetStock: 48, incomingQty: 0, lastUpdated: '2026-07-08T10:15:00Z', stockStatus: 'Below minimum' }, // [LOW STOCK 7]
  { productId: 'p-23', locationId: 'loc-1', currentStock: 3, minStock: 8, targetStock: 24, incomingQty: 0, lastUpdated: '2026-07-12T13:40:00Z', stockStatus: 'Below minimum' }, // [LOW STOCK 8]
  { productId: 'p-24', locationId: 'loc-1', currentStock: 1, minStock: 8, targetStock: 20, incomingQty: 0, lastUpdated: '2026-07-12T13:40:00Z', stockStatus: 'Below minimum' }, // [LOW STOCK 9]
  { productId: 'p-25', locationId: 'loc-1', currentStock: 5, minStock: 24, targetStock: 72, incomingQty: 0, lastUpdated: '2026-07-12T13:40:00Z', stockStatus: 'Below minimum' }, // [LOW STOCK 10]
  { productId: 'p-26', locationId: 'loc-1', currentStock: 14, minStock: 12, targetStock: 36, incomingQty: 0, lastUpdated: '2026-07-12T13:40:00Z', stockStatus: 'Healthy' },
  { productId: 'p-27', locationId: 'loc-1', currentStock: 0, minStock: 2, targetStock: 6, incomingQty: 0, lastUpdated: '2026-07-10T11:00:00Z', stockStatus: 'Out of stock' }, // [LOW STOCK 11]
  { productId: 'p-28', locationId: 'loc-1', currentStock: 8, minStock: 5, targetStock: 15, incomingQty: 0, lastUpdated: '2026-07-12T13:40:00Z', stockStatus: 'Healthy' },
  { productId: 'p-29', locationId: 'loc-1', currentStock: 12, minStock: 8, targetStock: 24, incomingQty: 0, lastUpdated: '2026-07-12T13:40:00Z', stockStatus: 'Healthy' },
  { productId: 'p-30', locationId: 'loc-1', currentStock: 4, minStock: 6, targetStock: 18, incomingQty: 0, lastUpdated: '2026-07-12T13:40:00Z', stockStatus: 'Below minimum' }, // [LOW STOCK 12]

  // v-4: SafetyCore
  { productId: 'p-31', locationId: 'loc-1', currentStock: 10, minStock: 4, targetStock: 12, incomingQty: 0, lastUpdated: '2026-07-12T11:00:00Z', stockStatus: 'Healthy' },
  { productId: 'p-32', locationId: 'loc-1', currentStock: 2, minStock: 2, targetStock: 5, incomingQty: 0, lastUpdated: '2026-07-12T11:00:00Z', stockStatus: 'Healthy' },
  { productId: 'p-33', locationId: 'loc-1', currentStock: 6, minStock: 3, targetStock: 10, incomingQty: 0, lastUpdated: '2026-07-12T11:00:00Z', stockStatus: 'Healthy' },
  { productId: 'p-34', locationId: 'loc-1', currentStock: 25, minStock: 20, targetStock: 60, incomingQty: 0, lastUpdated: '2026-07-12T11:00:00Z', stockStatus: 'Healthy' },
  { productId: 'p-35', locationId: 'loc-1', currentStock: 48, minStock: 24, targetStock: 120, incomingQty: 0, lastUpdated: '2026-07-12T11:00:00Z', stockStatus: 'Healthy' },
  { productId: 'p-36', locationId: 'loc-1', currentStock: 12, minStock: 10, targetStock: 30, incomingQty: 0, lastUpdated: '2026-07-12T11:00:00Z', stockStatus: 'Healthy' },
  { productId: 'p-37', locationId: 'loc-1', currentStock: 8, minStock: 5, targetStock: 15, incomingQty: 0, lastUpdated: '2026-07-12T11:00:00Z', stockStatus: 'Healthy' },
  { productId: 'p-38', locationId: 'loc-1', currentStock: 3, minStock: 2, targetStock: 6, incomingQty: 0, lastUpdated: '2026-07-12T11:00:00Z', stockStatus: 'Healthy' },
  { productId: 'p-39', locationId: 'loc-1', currentStock: 2, minStock: 1, targetStock: 3, incomingQty: 0, lastUpdated: '2026-07-12T11:00:00Z', stockStatus: 'Healthy' },
  { productId: 'p-40', locationId: 'loc-1', currentStock: 45, minStock: 20, targetStock: 80, incomingQty: 0, lastUpdated: '2026-07-12T11:00:00Z', stockStatus: 'Healthy' },

  // LOKALIZACJA 2: POZNAŃ (Punkt serwisowy - stan zdrowy z kilkoma mniejszymi brakami)
  { productId: 'p-1', locationId: 'loc-2', currentStock: 4, minStock: 3, targetStock: 8, incomingQty: 0, lastUpdated: '2026-07-11T10:00:00Z', stockStatus: 'Healthy' },
  { productId: 'p-4', locationId: 'loc-2', currentStock: 15, minStock: 10, targetStock: 25, incomingQty: 0, lastUpdated: '2026-07-11T10:00:00Z', stockStatus: 'Healthy' },
  { productId: 'p-10', locationId: 'loc-2', currentStock: 2, minStock: 4, targetStock: 10, incomingQty: 0, lastUpdated: '2026-07-11T10:00:00Z', stockStatus: 'Below minimum' }, // Low stock dla loc-2
  { productId: 'p-12', locationId: 'loc-2', currentStock: 1, minStock: 1, targetStock: 2, incomingQty: 0, lastUpdated: '2026-07-11T10:00:00Z', stockStatus: 'Healthy' },
  { productId: 'p-14', locationId: 'loc-2', currentStock: 2, minStock: 1, targetStock: 3, incomingQty: 0, lastUpdated: '2026-07-11T10:00:00Z', stockStatus: 'Healthy' },
  { productId: 'p-21', locationId: 'loc-2', currentStock: 30, minStock: 24, targetStock: 48, incomingQty: 0, lastUpdated: '2026-07-11T10:00:00Z', stockStatus: 'Healthy' },
  { productId: 'p-22', locationId: 'loc-2', currentStock: 8, minStock: 6, targetStock: 12, incomingQty: 0, lastUpdated: '2026-07-11T10:00:00Z', stockStatus: 'Healthy' },
  { productId: 'p-34', locationId: 'loc-2', currentStock: 12, minStock: 10, targetStock: 20, incomingQty: 0, lastUpdated: '2026-07-11T10:00:00Z', stockStatus: 'Healthy' }
];

export const mockStockCountRequests: StockCountRequest[] = [
  {
    id: 'scr-1',
    vendorId: 'v-1',
    locationId: 'loc-1',
    title: 'Inwentaryzacja klocków i tarczy AutoParts',
    deadline: '2026-07-15',
    status: 'Oczekujące',
    productIds: ['p-1', 'p-2', 'p-3']
  },
  {
    id: 'scr-2',
    vendorId: 'v-3',
    locationId: 'loc-1',
    title: 'Zgłoszenie niskich stanów chemii warsztatowej',
    deadline: '2026-07-16',
    status: 'Oczekujące',
    productIds: ['p-21', 'p-22', 'p-27']
  }
];

export const mockReplenishmentProposals: ReplenishmentProposal[] = [
  {
    id: 'rp-1',
    vendorId: 'v-1',
    locationId: 'loc-1',
    proposalNumber: 'PROP-V1-202607-003',
    date: '2026-07-12',
    expiryDate: '2026-07-15',
    status: 'Oczekuje na zatwierdzenie',
    urgentLinesCount: 2,
    lines: [
      {
        productId: 'p-2',
        currentStock: 1,
        minStock: 4,
        targetStock: 8,
        incomingQty: 0,
        suggestedQty: 8, // Paczki po 2 szt. to wielokrotność 2, sugerowana 8 (4 op.)
        finalProposedQty: 8,
        price: 149.00,
        reason: 'Stan (1) spadł poniżej minimum ostrzegawczego (4). Propozycja wyrównania do stanu docelowego (8).',
        status: 'suggested'
      },
      {
        productId: 'p-5',
        currentStock: 0,
        minStock: 10,
        targetStock: 30,
        incomingQty: 0,
        suggestedQty: 30, // Paczki po 10, wielokrotność 30 (3 op.)
        finalProposedQty: 30,
        price: 19.90,
        reason: 'Produkt wyprzedany (brak zapasu). Propozycja pełnego zatowarowania.',
        status: 'suggested'
      },
      {
        productId: 'p-6',
        currentStock: 3,
        minStock: 5,
        targetStock: 15,
        incomingQty: 0,
        suggestedQty: 10, // Paczka po 5, wielokrotność 10 (2 op.)
        finalProposedQty: 10,
        price: 64.00,
        reason: 'Stan (3) poniżej minimum (5). Propozycja zaokrąglona do pełnego opakowania zbiorczego.',
        status: 'suggested'
      }
    ]
  },
  {
    id: 'rp-2',
    vendorId: 'v-3',
    locationId: 'loc-1',
    proposalNumber: 'PROP-V3-202607-011',
    date: '2026-07-13',
    expiryDate: '2026-07-16',
    status: 'Oczekuje na zatwierdzenie',
    urgentLinesCount: 4,
    lines: [
      {
        productId: 'p-21',
        currentStock: 12,
        minStock: 48,
        targetStock: 144,
        incomingQty: 0,
        suggestedQty: 144, // 6 kartonów po 24
        finalProposedQty: 144,
        price: 8.90,
        reason: 'Bardzo niski stan kluczowego zmywacza Wurth. Promocyjna cena zakupu.',
        status: 'suggested'
      },
      {
        productId: 'p-22',
        currentStock: 2,
        minStock: 12,
        targetStock: 48,
        incomingQty: 0,
        suggestedQty: 48, // 4 op. po 12
        finalProposedQty: 48,
        price: 9.80,
        reason: 'Zapas zbliża się do zera. Uzupełnienie zapasu zabezpieczającego.',
        status: 'suggested'
      },
      {
        productId: 'p-25',
        currentStock: 5,
        minStock: 24,
        targetStock: 72,
        incomingQty: 0,
        suggestedQty: 72, // 6 op. po 12
        finalProposedQty: 72,
        price: 24.50,
        reason: 'Stan krytyczny penetranta MoS2.',
        status: 'suggested'
      },
      {
        productId: 'p-27',
        currentStock: 0,
        minStock: 2,
        targetStock: 6,
        incomingQty: 0,
        suggestedQty: 6, // 3 op. po 2
        finalProposedQty: 6,
        price: 88.00,
        reason: 'Całkowity brak pasty do mycia rąk Dreumex.',
        status: 'suggested'
      }
    ]
  },
  {
    id: 'rp-3',
    vendorId: 'v-4',
    locationId: 'loc-1',
    proposalNumber: 'PROP-V4-202607-001',
    date: '2026-07-09',
    expiryDate: '2026-07-14',
    status: 'Wersja robocza',
    urgentLinesCount: 0,
    lines: [
      {
        productId: 'p-34',
        currentStock: 25,
        minStock: 20,
        targetStock: 60,
        incomingQty: 0,
        suggestedQty: 40, // 4 op. po 10
        finalProposedQty: 40,
        price: 78.00,
        reason: 'Uzupełnienie zapasu rotacyjnego rękawic Grippaz.',
        status: 'suggested'
      }
    ]
  }
];

export const mockOrders: Order[] = [
  {
    id: 'o-1',
    vendorId: 'v-1',
    locationId: 'loc-1',
    orderNumber: 'ZAM-202607-9812',
    date: '2026-07-11',
    requestedDeliveryDate: '2026-07-14',
    confirmedDeliveryDate: '2026-07-14',
    origin: 'Propozycja uzupełnienia',
    status: 'W przygotowaniu',
    poReference: 'PO-KOM-2026-081',
    hasAttachment: false,
    lines: [
      { productId: 'p-1', requestedQty: 12, confirmedQty: 12, shippedQty: 0, deliveredQty: 0, price: 145.00 },
      { productId: 'p-4', requestedQty: 30, confirmedQty: 30, shippedQty: 0, deliveredQty: 0, price: 28.50 },
      { productId: 'p-7', requestedQty: 16, confirmedQty: 16, shippedQty: 0, deliveredQty: 0, price: 49.00 }
    ],
    timeline: [
      { status: 'Szkic', date: '2026-07-11 08:30', description: 'Utworzono automatycznie z propozycji VMI.' },
      { status: 'Wysłane', date: '2026-07-11 09:15', description: 'Zamówienie zatwierdzone i wysłane do AutoParts Pro.' },
      { status: 'Potwierdzone', date: '2026-07-11 11:30', description: 'Sprzedawca potwierdził dostępność wszystkich pozycji i termin dostawy.' },
      { status: 'W przygotowaniu', date: '2026-07-12 14:00', description: 'Zamówienie jest pakowane w magazynie centralnym.' }
    ]
  },
  {
    id: 'o-2',
    vendorId: 'v-2',
    locationId: 'loc-1',
    orderNumber: 'ZAM-202607-9755',
    date: '2026-07-12',
    requestedDeliveryDate: '2026-07-15',
    origin: 'Zamówienie ręczne',
    status: 'Częściowo potwierdzone',
    poReference: 'PO-KOM-TOOL-09',
    notes: 'Klucz udarowy potrzebny na środę do naprawy klienta!',
    hasAttachment: true,
    lines: [
      { productId: 'p-11', requestedQty: 1, confirmedQty: 1, shippedQty: 0, deliveredQty: 0, price: 1199.00 },
      { productId: 'p-13', requestedQty: 1, confirmedQty: 0, shippedQty: 0, deliveredQty: 0, price: 520.00 } // Brak u dostawcy
    ],
    timeline: [
      { status: 'Wysłane', date: '2026-07-12 10:00', description: 'Wysłano ręczne zamówienie na narzędzia warsztatowe.' },
      { status: 'Częściowo potwierdzone', date: '2026-07-13 08:15', description: 'Brak suwmiarki Mitutoyo na magazynie WerkTools. Klucz udarowy potwierdzony do wysyłki.' }
    ]
  },
  {
    id: 'o-3',
    vendorId: 'v-3',
    locationId: 'loc-1',
    orderNumber: 'ZAM-202607-9520',
    date: '2026-07-08',
    requestedDeliveryDate: '2026-07-10',
    confirmedDeliveryDate: '2026-07-10',
    origin: 'Propozycja uzupełnienia',
    status: 'Dostarczone',
    hasAttachment: false,
    lines: [
      { productId: 'p-23', requestedQty: 12, confirmedQty: 12, shippedQty: 12, deliveredQty: 12, price: 219.00 },
      { productId: 'p-26', requestedQty: 24, confirmedQty: 24, shippedQty: 24, deliveredQty: 24, price: 19.50 },
      { productId: 'p-29', requestedQty: 8, confirmedQty: 8, shippedQty: 8, deliveredQty: 8, price: 39.00 }
    ],
    timeline: [
      { status: 'Wysłane', date: '2026-07-08 11:00', description: 'Zamówienie wysłane.' },
      { status: 'Wysłane (Kurier)', date: '2026-07-09 13:00', description: 'Przesyłka nadana kurierem DPD. Numer paczki: 1234567890.' },
      { status: 'Dostarczone', date: '2026-07-10 10:30', description: 'Dostarczono i odebrano w Komorniki Workshop.' }
    ]
  },
  {
    id: 'o-4',
    vendorId: 'v-4',
    locationId: 'loc-1',
    orderNumber: 'ZAM-202607-9301',
    date: '2026-07-10',
    requestedDeliveryDate: '2026-07-13',
    origin: 'Zaakceptowana oferta',
    status: 'Wysłane (Kurier)',
    poReference: 'PO-BHP-2026-02',
    hasAttachment: false,
    lines: [
      { productId: 'p-31', requestedQty: 4, confirmedQty: 4, shippedQty: 4, deliveredQty: 0, price: 159.00 },
      { productId: 'p-34', requestedQty: 20, confirmedQty: 20, shippedQty: 20, deliveredQty: 0, price: 78.00 }
    ],
    timeline: [
      { status: 'Wysłane', date: '2026-07-10 15:45', description: 'Zatwierdzono ofertę i wygenerowano zamówienie.' },
      { status: 'Potwierdzone', date: '2026-07-11 08:30', description: 'Zamówienie zatwierdzone.' },
      { status: 'Wysłane (Kurier)', date: '2026-07-13 09:00', description: 'Wysłane przesyłką kurierską GLS. Planowana dostawa jutro.' }
    ]
  },
  // Inne pomocnicze zamówienia dla spójności
  {
    id: 'o-5',
    vendorId: 'v-1',
    locationId: 'loc-2',
    orderNumber: 'ZAM-202607-9200',
    date: '2026-07-05',
    requestedDeliveryDate: '2026-07-08',
    origin: 'Ponowne zamówienie',
    status: 'Dostarczone',
    hasAttachment: false,
    lines: [
      { productId: 'p-1', requestedQty: 8, confirmedQty: 8, shippedQty: 8, deliveredQty: 8, price: 145.00 }
    ],
    timeline: [{ status: 'Dostarczone', date: '2026-07-08', description: 'Dostarczono do punktu w Poznaniu.' }]
  },
  {
    id: 'o-6',
    vendorId: 'v-2',
    locationId: 'loc-1',
    orderNumber: 'ZAM-202607-9411',
    date: '2026-07-06',
    requestedDeliveryDate: '2026-07-09',
    origin: 'Zamówienie ręczne',
    status: 'Anulowane',
    notes: 'Pomyłka w wyborze asortymentu.',
    hasAttachment: false,
    lines: [{ productId: 'p-17', requestedQty: 10, confirmedQty: 0, shippedQty: 0, deliveredQty: 0, price: 128.00 }],
    timeline: [{ status: 'Anulowane', date: '2026-07-06', description: 'Anulowane przez klienta przed wysyłką.' }]
  },
  {
    id: 'o-7',
    vendorId: 'v-3',
    locationId: 'loc-1',
    orderNumber: 'ZAM-202607-9422',
    date: '2026-07-13',
    requestedDeliveryDate: '2026-07-15',
    origin: 'Zamówienie ręczne',
    status: 'W trakcie weryfikacji',
    hasAttachment: false,
    lines: [
      { productId: 'p-28', requestedQty: 5, confirmedQty: 0, shippedQty: 0, deliveredQty: 0, price: 54.00 }
    ],
    timeline: [{ status: 'W trakcie weryfikacji', date: '2026-07-13 10:00', description: 'Oczekiwanie na akceptację handlowca.' }]
  },
  {
    id: 'o-8',
    vendorId: 'v-4',
    locationId: 'loc-2',
    orderNumber: 'ZAM-202607-9100',
    date: '2026-07-01',
    requestedDeliveryDate: '2026-07-04',
    origin: 'Zamówienie ręczne',
    status: 'Dostarczone',
    hasAttachment: false,
    lines: [{ productId: 'p-40', requestedQty: 20, confirmedQty: 20, shippedQty: 20, deliveredQty: 20, price: 11.50 }],
    timeline: [{ status: 'Dostarczone', date: '2026-07-04', description: 'Dostarczono do punktu Poznań.' }]
  }
];

export const mockPromotions: Promotion[] = [
  {
    id: 'pr-1',
    vendorId: 'v-1',
    title: 'Letni Festiwal Hamulców Brembo',
    bannerUrl: 'https://picsum.photos/seed/brembobanner/800/400',
    validFrom: '2026-07-01',
    validTo: '2026-07-31',
    description: 'Uzyskaj 12% rabatu na wszystkie klocki hamulcowe Brembo przy zamówieniu min. 4 kompletów. Dodatkowe punkty w programie partnerskim Ambra.',
    productIds: ['p-2'],
    badgeText: 'HIT SEZONU'
  },
  {
    id: 'pr-2',
    vendorId: 'v-2',
    title: 'Tydzień Elektronarzędzi Milwaukee',
    bannerUrl: 'https://picsum.photos/seed/milwaukeebanner/800/400',
    validFrom: '2026-07-10',
    validTo: '2026-07-20',
    description: 'Wydłużona gwarancja do 5 lat oraz darmowy akumulator 5.0Ah przy zakupie dowolnego klucza udarowego serii M18.',
    productIds: ['p-11'],
    badgeText: 'DARMOWY AKUMULATOR'
  },
  {
    id: 'pr-3',
    vendorId: 'v-3',
    title: 'Czyszczenie Magazynu: Wurth Brake Cleaner',
    bannerUrl: 'https://picsum.photos/seed/wurthbanner/800/400',
    validFrom: '2026-07-12',
    validTo: '2026-07-25',
    description: 'Przy zakupie całego kartonu (24 szt.) zmywacza do hamulców płacisz tylko 8.90 PLN netto za sztukę! Standardowa cena to 11.20 PLN.',
    productIds: ['p-21'],
    badgeText: 'WYPRZEDAŻ'
  },
  {
    id: 'pr-4',
    vendorId: 'v-4',
    title: 'BHP i Komfort Pracy: Promocja Portwest',
    bannerUrl: 'https://picsum.photos/seed/portwestbanner/800/400',
    validFrom: '2026-07-05',
    validTo: '2026-07-20',
    description: 'Profesjonalne buty skórzane Portwest S3 w obniżonej cenie 159 PLN netto (stara cena: 185 PLN). Bezpieczeństwo, na którym możesz polegać.',
    productIds: ['p-31'],
    badgeText: '-14% SUPER CENA'
  }
];

export const mockDigitalFlyers: DigitalFlyer[] = [
  {
    id: 'df-1',
    vendorId: 'v-2',
    title: 'Folder Nowości WerkTools 2026',
    coverUrl: 'https://picsum.photos/seed/toolcover/400/600',
    validFrom: '2026-07-01',
    validTo: '2026-07-31',
    pages: [
      { pageNumber: 1, productIds: ['p-11', 'p-12'], layoutType: 'duo' },
      { pageNumber: 2, productIds: ['p-15', 'p-17', 'p-18'], layoutType: 'grid' }
    ]
  },
  {
    id: 'df-2',
    vendorId: 'v-3',
    title: 'Ulotka Chemia Letnia CleanChem',
    coverUrl: 'https://picsum.photos/seed/chemcover/400/600',
    validFrom: '2026-07-05',
    validTo: '2026-08-05',
    pages: [
      { pageNumber: 1, productIds: ['p-21', 'p-25'], layoutType: 'duo' },
      { pageNumber: 2, productIds: ['p-26', 'p-27', 'p-29', 'p-30'], layoutType: 'grid' }
    ]
  }
];

export const mockShowrooms: Showroom[] = [
  {
    id: 'sr-1',
    vendorId: 'v-1',
    title: 'Centrum Diagnostyki i Układów Hamulcowych',
    description: 'Kolekcja starannie wyselekcjonowanych elementów układów hamulcowych klasy premium, które gwarantują brak reklamacji klientów Twojego warsztatu.',
    sections: [
      {
        title: 'Komponenty Hamulcowe Premium',
        description: 'Tarcze i klocki najczęściej wybierane przez naszych partnerów do aut grupy VAG.',
        productIds: ['p-1', 'p-2', 'p-3']
      },
      {
        title: 'Filtry i Płyny Eksploatacyjne',
        description: 'Podstawowe filtry oleju i płyny hamulcowe o niskiej lepkości.',
        productIds: ['p-4', 'p-5', 'p-10']
      }
    ]
  },
  {
    id: 'sr-2',
    vendorId: 'v-2',
    title: 'Wyposażenie Stanowiska Naprawczego',
    description: 'Od grzechotki po klucz udarowy. Zbuduj profesjonalne stanowisko z WerkTools.',
    sections: [
      {
        title: 'Narzędzia Dokręcające',
        description: 'Najbardziej odporne na obciążenia klucze i bity.',
        productIds: ['p-11', 'p-12', 'p-19']
      },
      {
        title: 'Pomiary i Precyzja',
        description: 'Narzędzia diagnostyczne i kalibrowane przyrządy suwmiarkowe.',
        productIds: ['p-13', 'p-16', 'p-20']
      }
    ]
  }
];

export const mockQuotations: Quotation[] = [
  {
    id: 'q-1',
    vendorId: 'v-4',
    quotationNumber: 'OFE-202607-0841',
    validTo: '2026-07-16', // Wygaśnie za 3 dni!
    lines: [
      { productId: 'p-31', qty: 6, originalPrice: 185.00, offeredPrice: 145.00 }, // Trzewiki
      { productId: 'p-32', qty: 4, originalPrice: 490.00, offeredPrice: 410.00 }, // Snickers
      { productId: 'p-39', qty: 2, originalPrice: 125.00, offeredPrice: 105.00 }  // Apteczki
    ],
    deliveryConditions: 'Darmowa dostawa kurierska bezpośrednio do Komorniki Workshop w 24h.',
    notes: 'Specjalna wycena przygotowana dla Pana Michała na doposażenie nowo zatrudnionych mechaników w lipcu.',
    totalValue: 2720.00,
    status: 'Oczekująca'
  },
  {
    id: 'q-2',
    vendorId: 'v-2',
    quotationNumber: 'OFE-202607-0711',
    validTo: '2026-07-28',
    lines: [
      { productId: 'p-11', qty: 2, originalPrice: 1199.00, offeredPrice: 1100.00 },
      { productId: 'p-12', qty: 2, originalPrice: 489.00, offeredPrice: 400.00 }
    ],
    deliveryConditions: 'Dostawa paletowa w cenie.',
    notes: 'Zapytanie o rozbudowę stanowisk roboczych.',
    totalValue: 3000.00,
    status: 'Zaakceptowana'
  },
  {
    id: 'q-3',
    vendorId: 'v-1',
    quotationNumber: 'OFE-202607-0599',
    validTo: '2026-07-08',
    lines: [
      { productId: 'p-8', qty: 10, originalPrice: 210.00, offeredPrice: 180.00 }
    ],
    deliveryConditions: 'Odbiór własny.',
    totalValue: 1800.00,
    status: 'Odrzucona'
  }
];

export const mockConversations: Conversation[] = [
  {
    id: 'c-1',
    vendorId: 'v-2',
    subject: 'Niedostępność suwmiarki Mitutoyo w zamówieniu ZAM-202607-9755',
    relatedObjectType: 'order',
    relatedObjectId: 'o-2',
    lastUpdated: '2026-07-13T08:15:00Z',
    unreadCount: 1, // Jedna nieprzeczytana!
    status: 'active',
    messages: [
      {
        id: 'm-1_1',
        sender: 'client',
        senderName: 'Michał Stępień',
        content: 'Dzień dobry, zależy mi bardzo na szybkiej wysyłce suwmiarki. Czy jest szansa na potwierdzenie?',
        timestamp: '2026-07-12T10:15:00Z'
      },
      {
        id: 'm-1_2',
        sender: 'vendor',
        senderName: 'Andrzej Wiśniewski',
        content: 'Dzień dobry Panie Michale. Niestety ten model suwmiarki Mitutoyo CD-15APX wyprzedał się z naszego centralnego magazynu. Sprowadzamy dostawę bezpośrednio od producenta, ale potrwa to około 5 dni roboczych. Czy klucz udarowy możemy wysłać już dziś oddzielnie?',
        timestamp: '2026-07-13T08:15:00Z'
      }
    ]
  },
  {
    id: 'c-2',
    vendorId: 'v-1',
    subject: 'Pytanie o zamiennik dla tarcz ATE 24.0122',
    relatedObjectType: 'product',
    relatedObjectId: 'p-3',
    lastUpdated: '2026-07-11T16:00:00Z',
    unreadCount: 0,
    status: 'active',
    messages: [
      {
        id: 'm-2_1',
        sender: 'client',
        senderName: 'Michał Stępień',
        content: 'Czy posiadają Państwo tarcze Brembo o tej samej specyfikacji od ręki na magazynie?',
        timestamp: '2026-07-11T14:30:00Z'
      },
      {
        id: 'm-2_2',
        sender: 'vendor',
        senderName: 'Tomasz Kowalski',
        content: 'Tak, posiadamy zamiennik Brembo o kodzie 09.9167.11. Koszt to 185 PLN netto za sztukę, dostępność od ręki z dostawą jutro rano.',
        timestamp: '2026-07-11T16:00:00Z'
      }
    ]
  },
  {
    id: 'c-3',
    vendorId: 'v-4',
    subject: 'Wycena butów i odzieży dla nowych pracowników',
    relatedObjectType: 'quotation',
    relatedObjectId: 'q-1',
    lastUpdated: '2026-07-10T12:00:00Z',
    unreadCount: 0,
    status: 'active',
    messages: [
      {
        id: 'm-3_1',
        sender: 'client',
        senderName: 'Michał Stępień',
        content: 'Proszę o przygotowanie oferty na 6 par trzewików Portwest S3, 4 pary spodni Snickers i 2 apteczki ścienne.',
        timestamp: '2026-07-09T09:00:00Z'
      },
      {
        id: 'm-3_2',
        sender: 'vendor',
        senderName: 'Mariusz Lewandowski',
        content: 'Dzień dobry. Przygotowałem dla Państwa dedykowaną wycenę OFE-202607-0841 z atrakcyjnymi rabatami na trzewiki (-14%) oraz spodnie Snickers. Oferta jest już widoczna w systemie w zakładce Oferty.',
        timestamp: '2026-07-10T12:00:00Z'
      }
    ]
  },
  {
    id: 'c-4',
    vendorId: 'v-3',
    subject: 'Zapytanie o dostępność sorbentu Damolin',
    relatedObjectType: 'none',
    lastUpdated: '2026-07-12T11:00:00Z',
    unreadCount: 0,
    status: 'active',
    messages: [
      {
        id: 'm-4_1',
        sender: 'client',
        senderName: 'Michał Stępień',
        content: 'Dzień dobry, czy przy zamówieniu 15 worków sorbentu otrzymamy dodatkowy upust?',
        timestamp: '2026-07-12T09:00:00Z'
      },
      {
        id: 'm-4_2',
        sender: 'vendor',
        senderName: 'Karolina Nowak',
        content: 'Powyżej 10 worków wysyłamy towar na palecie z darmową dostawą, a cena jednostkowa spada do 49 PLN netto za worek. Proszę o informację, czy przygotować takie zamówienie.',
        timestamp: '2026-07-12T11:00:00Z'
      }
    ]
  }
];

export const mockNotifications: Notification[] = [
  {
    id: 'n-1',
    vendorId: 'v-3',
    type: 'Low-stock warning',
    title: 'Krytycznie niski zapas CleanChem',
    content: 'Aż 6 produktów marki CleanChem w lokalizacji Komorniki Warsztat spadło poniżej poziomu minimalnego. Wymagane uzupełnienie.',
    date: '2026-07-13 08:30',
    isRead: false
  },
  {
    id: 'n-2',
    vendorId: 'v-1',
    type: 'New replenishment proposal',
    title: 'Nowa propozycja dostawy VMI',
    content: 'AutoParts Pro wygenerował nową automatyczną propozycję uzupełnienia zapasów PROP-V1-202607-003 dla Komorniki Warsztat.',
    date: '2026-07-12 10:15',
    isRead: false,
    relatedId: 'rp-1'
  },
  {
    id: 'n-3',
    vendorId: 'v-4',
    type: 'Quotation expiring',
    title: 'Oferta specjalna wygasa za 3 dni',
    content: 'Dedykowana wycena OFE-202607-0841 na odzież roboczą BHP od SafetyCore wygasa w dniu 2026-07-16.',
    date: '2026-07-13 07:00',
    isRead: false,
    relatedId: 'q-1'
  },
  {
    id: 'n-4',
    vendorId: 'v-2',
    type: 'Order status changed',
    title: 'Zamówienie częściowo potwierdzone',
    content: 'Narzędzia warsztatowe w zamówieniu ZAM-202607-9755 od WerkTools zostały zweryfikowane. Jedna pozycja niedostępna.',
    date: '2026-07-13 08:15',
    isRead: false,
    relatedId: 'o-2'
  },
  {
    id: 'n-5',
    vendorId: 'v-1',
    type: 'Stock-count request',
    title: 'Zlecenie inwentaryzacji klocków hamulcowych',
    content: 'AutoParts Pro prosi o aktualizację stanu magazynowego klocków i tarcz TRW/Brembo w celu optymalizacji dostaw VMI.',
    date: '2026-07-11 12:00',
    isRead: false,
    relatedId: 'scr-1'
  },
  {
    id: 'n-6',
    vendorId: 'v-2',
    type: 'New vendor message',
    title: 'Nowa wiadomość od WerkTools',
    content: 'Andrzej Wiśniewski napisał w sprawie niedostępności suwmiarki Mitutoyo: "Dzień dobry Panie Michale..."',
    date: '2026-07-13 08:15',
    isRead: false,
    relatedId: 'c-1'
  },
  {
    id: 'n-7',
    vendorId: 'v-3',
    type: 'New promotion',
    title: 'Letnia wyprzedaż zmywaczy Wurth',
    content: 'Zgarnij Wurth Brake Cleaner w bezkonkurencyjnej cenie 8.90 PLN netto przy zakupie kartonowym! Promocja aktywna do 25 lipca.',
    date: '2026-07-12 09:00',
    isRead: true,
    relatedId: 'pr-3'
  },
  {
    id: 'n-8',
    vendorId: 'v-4',
    type: 'New quotation',
    title: 'Nowa oferta specjalna SafetyCore',
    content: 'Przygotowaliśmy ofertę OFE-202607-0841 na spodnie i trzewiki robocze ze specjalnymi upustami partnerskimi.',
    date: '2026-07-10 12:00',
    isRead: true,
    relatedId: 'q-1'
  },
  {
    id: 'n-9',
    vendorId: 'v-3',
    type: 'Delivery update',
    title: 'Dostarczono zamówienie chemii warsztatowej',
    content: 'Kurier dostarczył zamówienie ZAM-202607-9520 do Komorniki Warsztat. Wszystkie pozycje zgodne ze specyfikacją.',
    date: '2026-07-10 10:30',
    isRead: true,
    relatedId: 'o-3'
  },
  {
    id: 'n-10',
    vendorId: 'v-1',
    type: 'Order status changed',
    title: 'Zamówienie w przygotowaniu',
    content: 'AutoParts Pro przekazał zamówienie ZAM-202607-9812 do pakowania. Planowana wysyłka dzisiaj.',
    date: '2026-07-12 14:00',
    isRead: true,
    relatedId: 'o-1'
  },
  {
    id: 'n-11',
    vendorId: 'v-2',
    type: 'New promotion',
    title: 'Tydzień Milwaukee z darmowym akumulatorem',
    content: 'Zamów klucz udarowy M18 i zyskaj darmowy akumulator 18V 5.0Ah.',
    date: '2026-07-10 08:00',
    isRead: true,
    relatedId: 'pr-2'
  },
  {
    id: 'n-12',
    vendorId: 'v-1',
    type: 'Stock-count request',
    title: 'Wykonano aktualizację zapasów Poznań',
    content: 'Inwentaryzacja asortymentu w punkcie Poznań została zakończona i zsynchronizowana z bazą VMI.',
    date: '2026-07-08 14:00',
    isRead: true
  }
];

// Dynamically attach available warehouse quantities to all mock products to ensure it is always populated
mockProducts.forEach(p => {
  const charCode = p.id.charCodeAt(p.id.length - 1);
  const factor = p.id.length > 3 ? p.id.charCodeAt(2) : 5;
  p.warehouseQty = Math.floor(15 + ((charCode * 17 + factor * 11) % 380));
});

