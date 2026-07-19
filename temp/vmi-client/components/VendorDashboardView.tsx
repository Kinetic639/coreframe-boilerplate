'use client';

import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, 
  BookOpen, 
  Calendar, 
  Check, 
  CheckSquare, 
  ChevronLeft,
  ChevronRight, 
  FileText, 
  Filter,
  Grid,
  Info, 
  Layers, 
  List,
  Mail, 
  MessageSquare, 
  Minus, 
  Phone, 
  Plus, 
  Search, 
  Settings,
  ShoppingBag, 
  ShoppingCart, 
  Table,
  Tag, 
  Trash2, 
  User 
} from 'lucide-react';
import { cn } from '../lib/utils';
import { 
  Vendor, 
  Product, 
  Order, 
  Quotation, 
  DigitalFlyer, 
  Showroom, 
  ReplenishmentProposal,
  OrderLine,
  ClientLocation
} from '../lib/types';

interface VendorDashboardViewProps {
  vendor: Vendor;
  products: Product[];
  orders: Order[];
  quotations: Quotation[];
  flyers: DigitalFlyer[];
  showrooms: Showroom[];
  proposals: ReplenishmentProposal[];
  locations: ClientLocation[];
  activeLocationId: string;
  cart: OrderLine[];
  onBack: () => void;
  onAddToCart: (productId: string, qty: number) => void;
  onRemoveFromCart: (productId: string) => void;
  onUpdateCartQty: (productId: string, qty: number) => void;
  onCheckout: (deliveryLocationId: string, requestedDeliveryDate: string, poReference: string, comments: string) => void;
  onOpenFlyer: (flyer: DigitalFlyer) => void;
  onAskVendorQuestion: (productId: string, subject: string) => void;
  initialNewsId?: string;
}

const VENDOR_CONTACTS: Record<string, Array<{ name: string; role: string; phone: string; email: string; status: 'online' | 'busy' | 'offline' }>> = {
  'v-1': [
    { name: 'Tomasz Kowalski', role: 'Główny opiekun', phone: '+48 601 234 567', email: 't.kowalski@autopartspro.pl', status: 'online' },
    { name: 'Anna Nowak', role: 'Wsparcie techniczne', phone: '+48 601 111 222', email: 'a.nowak@autopartspro.pl', status: 'busy' }
  ],
  'v-2': [
    { name: 'Andrzej Wiśniewski', role: 'Kluczowy opiekun', phone: '+48 602 987 654', email: 'a.wisniewski@werktools.pl', status: 'online' },
    { name: 'Karol Kaczmarek', role: 'Doradca techniczny', phone: '+48 602 333 444', email: 'k.kaczmarek@werktools.pl', status: 'online' },
    { name: 'Marta Wójcik', role: 'Dział logistyki', phone: '+48 602 555 666', email: 'm.wojcik@werktools.pl', status: 'offline' }
  ],
  'v-3': [
    { name: 'Karolina Nowak', role: 'Opiekun handlowy', phone: '+48 501 111 222', email: 'k.nowak@cleanchem.com.pl', status: 'online' }
  ],
  'v-4': [
    { name: 'Mariusz Lewandowski', role: 'Doradca BHP', phone: '+48 703 555 444', email: 'm.lewandowski@safetycore.pl', status: 'busy' },
    { name: 'Jan Kowalski', role: 'Dział zamówień', phone: '+48 703 111 222', email: 'j.kowalski@safetycore.pl', status: 'offline' }
  ]
};

const VENDOR_PORTFOLIOS: Record<string, {
  title: string;
  description: string;
  stats: Array<{ label: string; value: string }>;
  highlights: Array<{ title: string; description: string }>;
  since: string;
  about: string;
  specialties: string[];
  certifications: string[];
  headquarters: string;
  website: string;
  gallery: string[];
}> = {
  'v-1': {
    title: 'AutoParts Pro B2B Logistics Group',
    description: 'Największy dystrybutor certyfikowanych części mechanicznych w Europie Środkowo-Wschodniej. Nasze oddziały obsługują ponad 15 000 warsztatów dziennie, zapewniając dostawy w systemie VMI (Vendor Managed Inventory) z dokładnością rzędu 99.8%.',
    stats: [
      { label: 'Rok założenia', value: '2004' },
      { label: 'Centra logistyczne', value: '5 w całej Polsce' },
      { label: 'Czas reakcji SLA', value: '< 4 godziny' },
      { label: 'Certyfikat jakości', value: 'ISO 9001:2015' }
    ],
    highlights: [
      { title: 'Inteligentne systemy dystrybucji VMI Express', description: 'Nasze samochody logistyczne kursują na predefiniowanych trasach dwa razy dziennie, zapewniając ciągłą wymianę asortymentu.' },
      { title: 'Bezpośrednia integracja z systemami ERP', description: 'Możliwość automatycznego składania zamówień przez API lub bezprzewodowe skanery kodów kreskowych.' },
      { title: 'Flota 120 aut dostawczych', description: 'Specjalnie przystosowane pojazdy transportowe z kontrolowaną temperaturą dla wymagających komponentów chemicznych.' }
    ],
    since: '2004',
    about: 'AutoParts Pro to wiodący dostawca oryginalnych części zamiennych i akcesoriów samochodowych. Działamy w systemie VMI, dostarczając produkty bezpośrednio do warsztatów w czasie krótszym niż 4 godziny.',
    specialties: ['Układy hamulcowe', 'Filtry i oleje', 'Zawieszenie', 'Elektryka samochodowa'],
    certifications: ['ISO 9001:2015', 'TÜV Rheinland', 'ATE Brake Center'],
    headquarters: 'ul. Poznańska 145, 60-120 Poznań',
    website: 'www.autopartspro.pl',
    gallery: ['https://picsum.photos/seed/parts1/400/250', 'https://picsum.photos/seed/parts2/400/250', 'https://picsum.photos/seed/parts3/400/250']
  },
  'v-2': {
    title: 'WerkTools Professional Engineering',
    description: 'Lider rynku profesjonalnych narzędzi warsztatowych, sprzętu pneumatycznego oraz mebli przemysłowych. Dostarczamy niezawodne oprzyrządowanie dla profesjonalistów, oferując pełne ubezpieczenie techniczne oraz mobilny serwis naprawczy w 24 godziny.',
    stats: [
      { label: 'Rok założenia', value: '2011' },
      { label: 'Obsługiwane marki', value: 'Milwaukee, Beta, Hazet' },
      { label: 'Gwarancja', value: 'Dożywotnia na ręczne' },
      { label: 'Serwis techniczny', value: 'Mobilny, 24h' }
    ],
    highlights: [
      { title: 'System zautomatyzowanych szaf narzędziowych ToolBox VMI', description: 'Kompaktowe dyspensery narzędziowe wydające sprzęt na kod kreskowy pracownika, eliminujące pomyłki magazynowe.' },
      { title: 'Kalibracja kluczy dynamometrycznych', description: 'Profesjonalne laboratorium wzorcujące z certyfikacją PCA zapewniające najwyższą precyzję pomiarów.' },
      { title: 'Kompleksowe wyposażenie stacji kontroli', description: 'Od podnośników po zaawansowane dymomierze i komputery diagnostyczne.' }
    ],
    since: '2011',
    about: 'WerkTools specjalizuje się w dostarczaniu najwyższej jakości narzędzi ręcznych, pneumatycznych i elektronarzędzi dla wymagających profesjonalistów warsztatowych.',
    specialties: ['Narzędzia ręczne', 'Pneumatyka', 'Wózki warsztatowe', 'Elektronarzędzia'],
    certifications: ['Certyfikat ISO 9001', 'Gwarancja WerkLife', 'Atesty bezpieczeństwa CE'],
    headquarters: 'ul. Przemysłowa 42, 62-052 Komorniki',
    website: 'www.werktools.pl',
    gallery: ['https://picsum.photos/seed/tools1/400/250', 'https://picsum.photos/seed/tools2/400/250', 'https://picsum.photos/seed/tools3/400/250']
  },
  'v-3': {
    title: 'CleanChem Eco-Tech Chemistry',
    description: 'Innowacyjny producent chemii czyszczącej, odtłuszczaczy oraz ekologicznych detergentów dla branży automotive. Wszystkie nasze preparaty spełniają rygorystyczne normy REACH i są biodegradowalne w ponad 95%.',
    stats: [
      { label: 'Rok założenia', value: '2015' },
      { label: 'Norma ekologiczna', value: 'ISO 14001:2015' },
      { label: 'Certyfikacja BHP', value: 'Pełna REACH i PZH' },
      { label: 'Dostawy masowe', value: 'Paleto-kontenery IBC' }
    ],
    highlights: [
      { title: 'Biodegradowalny zmywacz serii BioClean-15', description: 'Unikalna receptura na bazie terpenów roślinnych o skuteczności przewyższającej tradycyjne rozpuszczalniki.' },
      { title: 'Automatyczne stacje dozujące chemię', description: 'Montowane i serwisowane bezpłatnie u klienta w celu optymalnego rozcieńczania koncentratów.' },
      { title: 'Program utylizacji opakowań', description: 'W ramach VMI odbieramy i bezpłatnie utylizujemy wszystkie puste opakowania po naszych chemikaliach.' }
    ],
    since: '2015',
    about: 'CleanChem to producent innowacyjnych, ekologicznych preparatów czyszczących, odtłuszczaczy i chemii technicznej przeznaczonej dla przemysłu i warsztatów.',
    specialties: ['Zmywacze ekologiczne', 'Płyny eksploatacyjne', 'Środki BHP i czystości', 'Chemia warsztatowa'],
    certifications: ['Normy REACH', 'Atest PZH', 'ISO 14001:2015 (Eco)'],
    headquarters: 'ul. Chemików 12, 50-300 Wrocław',
    website: 'www.cleanchem.com.pl',
    gallery: ['https://picsum.photos/seed/chem1/400/250', 'https://picsum.photos/seed/chem2/400/250', 'https://picsum.photos/seed/chem3/400/250']
  },
  'v-4': {
    title: 'SafetyCore Protective Gear & Safety',
    description: 'Dostawca najwyższej klasy środków ochrony indywidualnej (BHP), certyfikowanego obuwia ochronnego oraz odzieży roboczej na zamówienie. Specjalizujemy się w personalizacji odzieży (haft komputerowy, termonadruki) dla dużych sieci serwisowych.',
    stats: [
      { label: 'Rok założenia', value: '2009' },
      { label: 'Obsługiwani pracownicy', value: 'Ponad 45 000 rocznie' },
      { label: 'Normy ochrony stóp', value: 'EN ISO 20345 S3' },
      { label: 'Personalizacja', value: 'Własna szwalnia i haft' }
    ],
    highlights: [
      { title: 'Szybkie dopasowanie rozmiarów skanerem 3D', description: 'Nasz mobilny doradca wykonuje cyfrowe skany stóp i sylwetek pracowników dla idealnego dopasowania odzieży.' },
      { title: 'Materiały trudnopalne nowej generacji CoreTech', description: 'Mieszanki włókien zapewniające niespotykaną lekkość i oddychalność przy zachowaniu maksymalnych norm ochrony.' },
      { title: 'Automaty BHP-omat VMI', description: 'Szafy vendingowe dystrybuujące rękawice, okulary i maski bezpośrednio na halach produkcyjnych przez 24/7.' }
    ],
    since: '2009',
    about: 'SafetyCore to Twój zaufany partner w dziedzinie bezpieczeństwa i higieny pracy. Projektujemy i dostarczamy profesjonalną odzież roboczą, obuwie i ochronniki.',
    specialties: ['Odzież robocza BHP', 'Obuwie ochronne S3', 'Ochrona dróg oddechowych', 'Automaty vendingowe BHP'],
    certifications: ['EN ISO 20345', 'Certyfikaty OEKO-TEX', 'Standard CE Ochrony'],
    headquarters: 'ul. Robotnicza 8, 02-300 Warszawa',
    website: 'www.safecut.pl',
    gallery: ['https://picsum.photos/seed/safe1/400/250', 'https://picsum.photos/seed/safe2/400/250', 'https://picsum.photos/seed/safe3/400/250']
  }
};

export const VENDOR_ANNOUNCEMENTS: Record<string, Array<{
  id: string;
  title: string;
  type: 'announcement' | 'offer' | 'info';
  content: string;
  badgeText: string;
}>> = {
  'v-1': [
    {
      id: 'v1-news-1',
      title: 'Limitowana Oferta: Dodatkowy rabat 15% na wybrane elementy złączne VMI',
      type: 'offer',
      content: 'Specjalny pakiet rabatowy przygotowany dla Twoich oddziałów handlowych. Wszystkie zamówienia na wybrane śruby, nakrętki oraz podkładki ocynkowane złożone do końca tego tygodnia za pośrednictwem portalu VMI zostaną zrabatowane o dodatkowe 15% netto!',
      badgeText: 'PROMOCJA -15%'
    },
    {
      id: 'v1-news-2',
      title: 'Wdrożenie zautomatyzowanych regałów logistycznych VMI Express',
      type: 'info',
      content: 'W przyszłym miesiącu planujemy montaż inteligentnych, zautomatyzowanych regałów magazynowych bezpośrednio w Twoich halach warsztatowych. System będzie zintegrowany ze skanerem kodów kreskowych, dzięki czemu stany inwentaryzacji będą raportowane w czasie rzeczywistym.',
      badgeText: 'NOWOŚĆ TECHNICZNA'
    },
    {
      id: 'v1-news-3',
      title: 'Zasady BHP przy odbiorze dostaw interwencyjnych',
      type: 'announcement',
      content: 'Przypominamy wszystkim kierownikom oddziałów o bezwzględnym obowiązku używania kamizelek odblaskowych oraz obuwia ochronnego podczas rozładunku dostaw realizowanych przez spedycję VMI Express.',
      badgeText: 'BHP I LOGISTYKA'
    }
  ],
  'v-2': [
    {
      id: 'v2-news-1',
      title: 'Wyprzedaż zestawów narzędziowych Beta: do -25% do końca miesiąca!',
      type: 'offer',
      content: 'Uzupełnij wyposażenie stanowisk pracy o legendarne zestawy kluczy i wkrętaków marki Beta. Zamówienia składane przez system VMI automatycznie otrzymują 25% upustu. Oferta ważna do wyczerpania zapasów magazynowych.',
      badgeText: 'WYPRZEDAŻ -25%'
    },
    {
      id: 'v2-news-2',
      title: 'Mobilna kalibracja kluczy dynamometrycznych w Twoim warsztacie',
      type: 'info',
      content: 'Nasz mobilny autobus techniczny odwiedzi Twoje serwisy w przyszły wtorek. Oferujemy bezpłatną kalibrację i certyfikację wszystkich kluczy dynamometrycznych używanych na stanowiskach naprawczych. Zapisz się już dziś!',
      badgeText: 'MOBILNY SERWIS'
    },
    {
      id: 'v2-news-3',
      title: 'Prezentacja nowej serii szaf narzędziowych ToolBox VMI',
      type: 'announcement',
      content: 'Wprowadzamy nową generację inteligentnych szaf warsztatowych ToolBox z wbudowaną wagą RFID. Automatyczna ewidencja wydawania i zwrotu narzędzi pozwoli wyeliminować straty operacyjne o ponad 40%.',
      badgeText: 'INNOWACJA'
    }
  ],
  'v-3': [
    {
      id: 'v3-news-1',
      title: 'Premiera: Ekologiczny zmywacz BioClean-15 wolny od LZO',
      type: 'info',
      content: 'Przedstawiamy w pełni biodegradowalny, bezpieczny dla skóry zmywacz montażowy serii BioClean-15. Wyprodukowany na bazie ekstraktów cytrusowych, nie wydziela szkodliwych oparów i doskonale czyści tarcze hamulcowe.',
      badgeText: 'EKO NOWOŚĆ'
    },
    {
      id: 'v3-news-2',
      title: 'Bezpłatna dzierżawa automatycznych stacji dozujących chemię',
      type: 'offer',
      content: 'Chcesz obniżyć zużycie koncentratów myjących? Zainstaluj bezpłatną, automatyczną stację dozującą CleanChem Eco-Mix. Urządzenie precyzyjnie miesza wodę z preparatem, redukując koszty chemii o 35%.',
      badgeText: 'ZYSKAJ OSZCZĘDNOŚĆ'
    },
    {
      id: 'v3-news-3',
      title: 'Odbiór i utylizacja pustych beczek i opakowań VMI',
      type: 'announcement',
      content: 'W ramach naszej polityki zero waste, kierowcy dostarczający chemię VMI mogą bezpłatnie odebrać zużyte opakowania i beczki plastikowe w celu ich ponownego napełnienia lub ekologicznej utylizacji.',
      badgeText: 'UTYLIZACJA BEZPŁATNA'
    }
  ],
  'v-4': [
    {
      id: 'v4-news-1',
      title: 'Szybka personalizacja odzieży: Haft komputerowy z logo gratis!',
      type: 'offer',
      content: 'Dla wszystkich nowych zamówień na kurtki i spodnie robocze marki SafetyCore oferujemy wykonanie haftu komputerowego z logo Twojego serwisu zupełnie za darmo. Promocja obowiązuje przy zamówieniach powyżej 10 kpl.',
      badgeText: 'HAFT GRATIS'
    },
    {
      id: 'v4-news-2',
      title: 'Nowa norma ochrony EN ISO 20345 S3 dla obuwia roboczego',
      type: 'info',
      content: 'Wszystkie modele butów ochronnych z naszej najnowszej kolekcji posiadają już pełne akredytacje nowej, zaostrzonej normy EN ISO 20345:2022. Wybierz maksymalną stabilność stopy i ochronę antyprzebiciową.',
      badgeText: 'NORMA BHP 2022'
    },
    {
      id: 'v4-news-3',
      title: 'Montaż automatów vendingowych BHP-omat VMI na Twojej hali',
      type: 'announcement',
      content: 'Uruchomiliśmy program pilotażowy montażu automatów BHP-omat. Twoi mechanicy mogą pobierać rękawice robocze, maski i okulary ochronne za pomocą kart pracowniczych. Pełna kontrola zużycia BHP 24/7.',
      badgeText: 'BHP VENDING'
    }
  ]
};

function ProductCartControl({
  productId,
  packSize,
  unitOfMeasure,
  itemInCart,
  onAddToCart,
  onUpdateCartQty,
  onRemoveFromCart,
  accentBgClass,
}: {
  productId: string;
  packSize: number;
  unitOfMeasure: string;
  itemInCart?: OrderLine;
  onAddToCart: (productId: string, qty: number) => void;
  onUpdateCartQty: (productId: string, qty: number) => void;
  onRemoveFromCart: (productId: string) => void;
  accentBgClass: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempPacks, setTempPacks] = useState(1);
  const [showSuccess, setShowSuccess] = useState(false);

  const activePacks = itemInCart ? Math.ceil(itemInCart.requestedQty / packSize) : 0;

  const handleStartEditing = () => {
    setTempPacks(activePacks > 0 ? activePacks : 1);
    setIsEditing(true);
  };

  const handleConfirm = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newQty = tempPacks * packSize;
    if (newQty <= 0) {
      onRemoveFromCart(productId);
    } else {
      if (itemInCart) {
        onUpdateCartQty(productId, newQty);
      } else {
        onAddToCart(productId, newQty);
      }
    }
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      setIsEditing(false);
    }, 1200);
  };

  if (showSuccess) {
    return (
      <div className="w-full flex items-center justify-center gap-1 py-2 rounded-xl bg-emerald-500 text-white font-extrabold text-[10px] sm:text-xs transition-all animate-pulse shadow-sm">
        <Check className="h-3.5 w-3.5" />
        <span>Zatwierdzono!</span>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-1.5 w-full">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setTempPacks((p) => Math.max(0, p - 1));
          }}
          className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-250 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 flex items-center justify-center cursor-pointer font-bold select-none shrink-0"
          title="-1 paczka"
        >
          <Minus className="h-3 w-3" />
        </button>

        <div className="flex-1 text-center font-bold text-gray-800 dark:text-blue-300 font-mono text-[10px] bg-gray-50 dark:bg-gray-900/80 py-1 rounded-lg leading-tight">
          <div className="font-extrabold">{tempPacks} op.</div>
          <div className="text-[8px] text-gray-400 font-normal">({tempPacks * packSize} szt.)</div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            setTempPacks((p) => p + 1);
          }}
          className="w-7 h-7 rounded-lg bg-[#2A3B4C] dark:bg-blue-600 hover:bg-[#1E2B38] text-white flex items-center justify-center cursor-pointer font-bold shrink-0 select-none"
          title="+1 paczka"
        >
          <Plus className="h-3 w-3" />
        </button>

        <button
          onClick={handleConfirm}
          className="w-7 h-7 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center cursor-pointer font-bold shrink-0 shadow-sm"
          title="Potwierdź"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  if (activePacks > 0) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleStartEditing();
        }}
        className="w-full py-2 px-2.5 rounded-xl font-extrabold text-[10px] sm:text-xs bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100/50 dark:hover:bg-emerald-950/40 transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
      >
        <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span className="truncate">{activePacks} op. ({itemInCart?.requestedQty} szt.)</span>
      </button>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        handleStartEditing();
      }}
      className={cn(
        "w-full py-2 px-2.5 rounded-xl font-extrabold text-[10px] sm:text-xs text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm",
        accentBgClass
      )}
    >
      <ShoppingCart className="h-3.5 w-3.5 shrink-0" />
      <span>Kup</span>
    </button>
  );
}

export default function VendorDashboardView({
  vendor,
  products,
  orders,
  quotations,
  flyers,
  showrooms,
  proposals,
  locations,
  activeLocationId,
  cart,
  onBack,
  onAddToCart,
  onRemoveFromCart,
  onUpdateCartQty,
  onCheckout,
  onOpenFlyer,
  onAskVendorQuestion,
  initialNewsId
}: VendorDashboardViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'catalog' | 'promotions' | 'quotations' | 'cart' | 'contact'>('overview');
  const [activeNewsIndex, setActiveNewsIndex] = useState<number>(0);
  const [tileSize, setTileSize] = useState<number>(200);
  
  // Full-screen News & Announcements Gallery States
  const [isNewsOpen, setIsNewsOpen] = useState<boolean>(!!initialNewsId);
  const [activeNewsId, setActiveNewsId] = useState<string>(initialNewsId || '');
  const [prevInitialNewsId, setPrevInitialNewsId] = useState<string | undefined>(initialNewsId);
  const [customNewsByVendor, setCustomNewsByVendor] = useState<Record<string, Array<{
    id: string;
    title: string;
    type: 'announcement' | 'offer' | 'info';
    content: string;
    date: string;
    badgeText?: string;
  }>>>({});

  if (initialNewsId !== prevInitialNewsId) {
    setPrevInitialNewsId(initialNewsId);
    if (initialNewsId) {
      setActiveNewsId(initialNewsId);
      setIsNewsOpen(true);
    }
  }

  const newsList = useMemo(() => {
    const list = VENDOR_ANNOUNCEMENTS[vendor.id] || [];
    const baseList = list.map((item, idx) => ({
      ...item,
      date: `2026-07-${15 - idx}`
    }));
    const customList = customNewsByVendor[vendor.id] || [];
    return [...customList, ...baseList];
  }, [vendor.id, customNewsByVendor]);

  const allAnnouncements = useMemo(() => {
    const portfolio = VENDOR_PORTFOLIOS[vendor.id];
    return [
      {
        id: 'slide-about',
        title: `O nas: ${vendor.name}`,
        type: 'portfolio_about' as const,
        content: portfolio?.about || 'Wiodący dostawca w systemie VMI.',
        date: 'PORTFOLIO',
        badgeText: portfolio ? `Partner od ${portfolio.since}` : undefined
      },
      {
        id: 'slide-specs',
        title: 'Nasze specjalizacje i certyfikaty jakości',
        type: 'portfolio_specialties' as const,
        content: `Główne obszary działania: ${portfolio?.specialties.join(', ') || ''}. Posiadane standardy i akredytacje: ${portfolio?.certifications.join(', ') || ''}.`,
        date: 'STANDARDY',
        badgeText: 'STANDARDY JAKOŚCI'
      },
      ...newsList
    ];
  }, [vendor.id, vendor.name, newsList]);

  // Form states for posting announcements
  const [newNewsTitle, setNewNewsTitle] = useState('');
  const [newNewsType, setNewNewsType] = useState<'announcement' | 'offer' | 'info'>('announcement');
  const [newNewsContent, setNewNewsContent] = useState('');
  const [newNewsBadge, setNewNewsBadge] = useState('');

  // Catalog View Mode & Settings
  const [viewMode, setViewMode] = useState<'table' | 'tile' | 'list'>('tile');
  const [hidePrices, setHidePrices] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [activeQuickFilter, setActiveQuickFilter] = useState<'all' | 'ordered' | 'lowStock'>('all');

  // Catalog search state
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Checkout form state
  const [deliveryLocId, setDeliveryLocId] = useState(activeLocationId);
  const [deliveryDate, setDeliveryDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2); // default 2 days out
    return d.toISOString().split('T')[0];
  });
  const [poReference, setPoReference] = useState('');
  const [checkoutComments, setCheckoutComments] = useState('');
  const [isCheckoutSuccess, setIsCheckoutSuccess] = useState(false);

  // Filter other data specific to vendor
  const vendorOrders = useMemo(() => orders.filter(o => o.vendorId === vendor.id), [orders, vendor]);
  const vendorQuotations = useMemo(() => quotations.filter(q => q.vendorId === vendor.id), [quotations, vendor]);
  const vendorFlyers = useMemo(() => flyers.filter(f => f.vendorId === vendor.id), [flyers, vendor]);
  const vendorShowrooms = useMemo(() => showrooms.filter(s => s.vendorId === vendor.id), [showrooms, vendor]);
  const vendorProposals = useMemo(() => proposals.filter(p => p.vendorId === vendor.id && p.status === 'Oczekuje na zatwierdzenie'), [proposals, vendor]);

  // Set of products ordered in past
  const pastOrderedProductIds = useMemo(() => {
    const ids = new Set<string>();
    vendorOrders.forEach(o => {
      o.lines.forEach(l => {
        ids.add(l.productId);
      });
    });
    return ids;
  }, [vendorOrders]);

  // Filter vendor's specific products
  const vendorProducts = useMemo(() => {
    return products.filter(p => p.vendorId === vendor.id);
  }, [products, vendor]);

  const categories = useMemo(() => {
    const list = new Set(vendorProducts.map(p => p.category));
    return Array.from(list);
  }, [vendorProducts]);

  // Filter catalog
  const filteredProducts = useMemo(() => {
    return vendorProducts.filter(p => {
      if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
      if (catalogSearch.trim() !== '') {
        const q = catalogSearch.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !p.vendorSku.toLowerCase().includes(q)) {
          return false;
        }
      }
      
      // Quick filters implementation
      if (activeQuickFilter === 'ordered' && !pastOrderedProductIds.has(p.id)) return false;
      if (activeQuickFilter === 'lowStock' && (p.warehouseQty === undefined || p.warehouseQty > 15)) return false;
      
      return true;
    });
  }, [vendorProducts, selectedCategory, catalogSearch, activeQuickFilter, pastOrderedProductIds]);

  // Cart helper: Total value
  const cartTotalValue = useMemo(() => {
    return cart.reduce((acc, item) => acc + (item.price * item.requestedQty), 0);
  }, [cart]);

  // Accent color classes mapping (Updated for clean high-contrast light theme)
  const getAccentClass = (type: 'text' | 'bg' | '' | 'hoverBg') => {
    if (vendor.accentColor === 'blue') {
      if (type === 'text') return 'text-blue-700';
      if (type === 'bg') return 'bg-blue-700';
      if (type === '') return '';
      return 'hover:bg-blue-800';
    }
    if (vendor.accentColor === 'orange') {
      if (type === 'text') return 'text-orange-700';
      if (type === 'bg') return 'bg-orange-600';
      if (type === '') return '';
      return 'hover:bg-orange-700';
    }
    if (vendor.accentColor === 'green') {
      if (type === 'text') return 'text-emerald-700';
      if (type === 'bg') return 'bg-emerald-700';
      if (type === '') return '';
      return 'hover:bg-emerald-800';
    }
    // Red / others
    if (type === 'text') return 'text-red-700';
    if (type === 'bg') return 'bg-red-700';
    if (type === '') return '';
    return 'hover:bg-red-800';
  };

  const handleQtyChangeInCart = (productId: string, currentQty: number, change: number, packSize: number) => {
    const next = Math.max(0, currentQty + change);
    if (next === 0) {
      onRemoveFromCart(productId);
    } else {
      onUpdateCartQty(productId, next);
    }
  };

  const submitCartOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;
    
    onCheckout(deliveryLocId, deliveryDate, poReference, checkoutComments);
    setIsCheckoutSuccess(true);
    setTimeout(() => {
      setIsCheckoutSuccess(false);
      setActiveSubTab('overview');
      setPoReference('');
      setCheckoutComments('');
    }, 4000);
  };

  // Publisher Handler for posting custom news announcements
  const handleAddNews = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNewsTitle.trim() || !newNewsContent.trim()) {
      alert('Wpisz tytuł oraz treść ogłoszenia.');
      return;
    }
    const newAnn = {
      id: `news_${Date.now()}`,
      title: newNewsTitle.trim(),
      type: newNewsType,
      content: newNewsContent.trim(),
      date: new Date().toISOString().substring(0, 10),
      badgeText: newNewsBadge.trim() ? newNewsBadge.trim().toUpperCase() : undefined
    };
    setCustomNewsByVendor(prev => ({
      ...prev,
      [vendor.id]: [newAnn, ...(prev[vendor.id] || [])]
    }));
    setActiveNewsId(newAnn.id);
    
    // Clear inputs
    setNewNewsTitle('');
    setNewNewsContent('');
    setNewNewsBadge('');
  };

  return (
    <div className="space-y-6 text-[#1A1C1E] dark:text-white">
      
      {/* BRANDED HEADER */}
      <div className={cn(
        "p-5 rounded-2xl bg-white dark:bg-[#131A2E] shadow-sm relative overflow-hidden flex flex-col sm:flex-row justify-between gap-4"
      )}>
        <div className="flex gap-4 items-center">
          <button 
            onClick={onBack}
            className="p-2 rounded-xl bg-[#F0F2F5] dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors cursor-pointer shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={cn("w-2.5 h-2.5 rounded-full", getAccentClass('bg'))} />
              <h2 className="text-lg font-black text-[#1A1C1E] dark:text-white">{vendor.name}</h2>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-normal">
              Program partnerski VMI • Opiekun handlowy: <strong className="text-gray-700 dark:text-gray-300">{vendor.accountManager.name}</strong>
            </p>
          </div>
        </div>

        {/* Floating Cart Button inside Header */}
        <button
          onClick={() => setActiveSubTab('cart')}
          className={cn(
            "sm:self-center px-4 py-2.5 rounded-xl font-bold text-xs text-white flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm",
            cart.length > 0 ? getAccentClass('bg') : "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
          )}
        >
          <ShoppingCart className="h-4 w-4" />
          <span>Zamówienie ({cart.reduce((acc, i) => acc + i.requestedQty, 0)} szt.)</span>
          {cart.length > 0 && (
            <span className="bg-white/20 px-1.5 py-0.5 rounded font-mono text-[10px]">
              {cartTotalValue.toFixed(2)} zł
            </span>
          )}
        </button>
      </div>

      {/* SEGMENTED SUB-NAVIGATION */}
      <div className="flex overflow-x-auto pb-1 gap-1.5 scrollbar-thin">
        {[
          { id: 'overview', name: 'Przegląd', icon: Layers },
          { id: 'catalog', name: 'Katalog towarów', icon: Search },
          { id: 'promotions', name: 'Promocje i gazetki', icon: Tag },
          { id: 'quotations', name: 'Oferty cenowe', icon: FileText },
          { id: 'cart', name: 'Koszyk zamówienia', icon: ShoppingBag },
          { id: 'contact', name: 'O nas i Portfolio', icon: User }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => { setActiveSubTab(tab.id as any); setIsCheckoutSuccess(false); }}
              className={cn(
                "px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer whitespace-nowrap transition-all shrink-0",
                isActive 
                  ? "bg-[#2A3B4C] dark:bg-blue-600 text-white" 
                  : "bg-white dark:bg-[#131A2E] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              )}
            >
              <Icon className={cn("h-4 w-4", isActive ? "text-white" : "text-gray-500 dark:text-gray-400")} />
              <span>{tab.name}</span>
              {tab.id === 'cart' && cart.length > 0 && (
                <span className={cn("px-1.5 py-0.5 rounded-full text-[10px] text-white font-mono font-bold", getAccentClass('bg'))}>
                  {cart.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* SUB-TABS VIEWS */}
      <div className="min-h-[40vh]">
          {/* VIEW 1: OVERVIEW */}
        {activeSubTab === 'overview' && (
          <div className="space-y-5 w-full">
            {/* PORTFOLIO & ANNOUNCEMENTS SLIDER GALLERY */}
            {(() => {
              const portfolio = VENDOR_PORTFOLIOS[vendor.id];
              const slides = [
                {
                  id: 'slide-about',
                  type: 'portfolio_about',
                  title: `O nas: ${vendor.name}`,
                  badge: 'PORTFOLIO MARKI',
                  badgeText: portfolio ? `Partner od ${portfolio.since}` : undefined,
                  content: portfolio?.about || 'Wiodący dostawca w systemie VMI.',
                  ctaText: 'Szczegóły',
                  ctaAction: () => {
                    setActiveNewsId('slide-about');
                    setIsNewsOpen(true);
                  }
                },
                {
                  id: 'slide-specs',
                  type: 'portfolio_specialties',
                  title: 'Nasze specjalizacje i certyfikaty jakości',
                  badge: 'PORTFOLIO MARKI',
                  badgeText: 'STANDARDY JAKOŚCI',
                  content: `Główne obszary działania: ${portfolio?.specialties.join(', ') || ''}. Posiadane standardy i akredytacje: ${portfolio?.certifications.join(', ') || ''}.`,
                  ctaText: 'Szczegóły',
                  ctaAction: () => {
                    setActiveNewsId('slide-specs');
                    setIsNewsOpen(true);
                  }
                },
                ...newsList.map(item => ({
                  id: item.id,
                  type: item.type,
                  title: item.title,
                  badge: item.type === 'offer' ? 'OFERTA SPECJALNA' : item.type === 'announcement' ? 'OGŁOSZENIE' : 'KOMUNIKAT',
                  badgeText: item.badgeText,
                  content: item.content,
                  ctaText: 'Szczegóły',
                  ctaAction: () => {
                    setActiveNewsId(item.id);
                    setIsNewsOpen(true);
                  }
                }))
              ];

              const currentSlideIndex = slides.length > 0 ? (activeNewsIndex % slides.length) : 0;
              const currentSlide = slides[currentSlideIndex];

              return (
                <div 
                  onClick={() => currentSlide?.ctaAction()}
                  className="relative group w-full bg-gradient-to-br from-[#1E2B38] to-slate-900 rounded-2xl shadow-lg overflow-hidden h-[280px] sm:h-[220px] md:h-[200px] flex flex-col justify-between cursor-pointer transition-all hover:shadow-xl"
                >
                  {/* Decorative glowing background elements */}
                  <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/10 rounded-full translate-x-12 -translate-y-12 group-hover:scale-110 transition-transform duration-500 pointer-events-none" />
                  <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/5 rounded-full -translate-x-6 translate-y-6 pointer-events-none" />

                  {/* Left and Right Chevron Buttons (shown on hover) */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveNewsIndex(prev => (prev - 1 + slides.length) % slides.length);
                    }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer shadow-md opacity-0 group-hover:opacity-100 transition-all duration-300 z-20"
                    title="Poprzedni slajd"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveNewsIndex(prev => (prev + 1) % slides.length);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer shadow-md opacity-0 group-hover:opacity-100 transition-all duration-300 z-20"
                    title="Następny slajd"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>

                  {/* Active Slide Content */}
                  {currentSlide && (
                    <div className="p-4 sm:p-5 md:p-6 flex flex-col justify-between gap-3 relative z-10 flex-1">
                      <div className="space-y-1.5 sm:space-y-2 max-w-3xl text-left">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider text-white",
                            currentSlide.type === 'offer' ? "bg-red-500" :
                            currentSlide.type === 'announcement' ? "bg-orange-500" :
                            currentSlide.type.startsWith('portfolio') ? "bg-blue-600" : "bg-emerald-600"
                          )}>
                            {currentSlide.badge}
                          </span>
                          {currentSlide.badgeText && (
                            <span className="px-2 py-0.5 bg-white/10 text-gray-300 font-bold text-[8px] rounded uppercase font-mono tracking-wider">
                              {currentSlide.badgeText}
                            </span>
                          )}
                        </div>

                        <h3 className="text-xs sm:text-sm md:text-base font-black text-white leading-snug group-hover:text-blue-300 transition-colors line-clamp-1">
                          {currentSlide.title}
                        </h3>

                        <p className="text-[11px] sm:text-xs text-slate-300/90 leading-relaxed line-clamp-2">
                          {currentSlide.content}
                        </p>
                      </div>

                      {/* Interactive Action Button at bottom left */}
                      <div className="flex items-center justify-start shrink-0">
                        <div
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-550 text-white font-extrabold text-[10px] sm:text-xs rounded-xl transition-all active:scale-95 cursor-pointer shadow-md flex items-center justify-center gap-1.5"
                        >
                          <span>{currentSlide.ctaText}</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Centered Dot Navigation at the bottom */}
                  <div className="flex justify-center items-center gap-1.5 pb-3 relative z-10">
                    {slides.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveNewsIndex(idx);
                        }}
                        className={cn(
                          "w-2 h-2 rounded-full transition-all cursor-pointer",
                          idx === currentSlideIndex ? "bg-blue-500 w-4" : "bg-white/20 hover:bg-white/40"
                        )}
                        title={`Slajd ${idx + 1}`}
                      />
                    ))}
                  </div>
                </div>
              );
            })()}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              
              {/* Left box: account details */}
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-white dark:bg-[#131A2E] rounded-xl p-5 space-y-4 text-xs shadow-sm text-left">
                  <h4 className="font-bold text-sm text-[#1A1C1E] dark:text-white uppercase tracking-wider">Informacje o dostawcy</h4>
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-[#F0F2F5] dark:bg-gray-800 rounded-lg text-[#2A3B4C] dark:text-blue-400">
                        <User className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-gray-500 dark:text-gray-400 text-[10px]">Przedstawiciel handlowy</p>
                        <p className="font-bold text-[#1A1C1E] dark:text-white text-sm">{vendor.accountManager.name}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-[#F0F2F5] dark:bg-gray-800 rounded-lg text-[#2A3B4C] dark:text-blue-400">
                        <Phone className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-gray-500 dark:text-gray-400 text-[10px]">Telefon bezpośredni</p>
                        <p className="font-bold text-gray-700 dark:text-gray-300 font-mono">{vendor.accountManager.phone}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-[#F0F2F5] dark:bg-gray-800 rounded-lg text-[#2A3B4C] dark:text-blue-400">
                        <Mail className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-gray-500 dark:text-gray-400 text-[10px]">Email kontaktowy</p>
                        <p className="font-bold text-gray-700 dark:text-gray-300 font-mono">{vendor.accountManager.email}</p>
                      </div>
                    </div>
                  </div>

                  {/* Available Persons Online for Contact section */}
                  <div className="space-y-3 pt-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Opiekunowie i wsparcie online</p>
                    <div className="grid grid-cols-1 gap-2">
                      {(VENDOR_CONTACTS[vendor.id] || []).map((contact, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2.5 bg-[#F8F9FA] dark:bg-gray-900 rounded-xl">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "w-2 h-2 rounded-full shrink-0",
                              contact.status === 'online' ? "bg-emerald-500 animate-pulse" :
                              contact.status === 'busy' ? "bg-amber-500" : "bg-gray-400"
                            )} />
                            <div>
                              <p className="font-bold text-gray-900 dark:text-white">{contact.name}</p>
                              <p className="text-[9px] text-gray-400">{contact.role}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <a href={`tel:${contact.phone}`} className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-750 dark:text-gray-200 transition-colors">
                              <Phone className="h-3 w-3" />
                            </a>
                            <a href={`mailto:${contact.email}`} className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-750 dark:text-gray-200 transition-colors">
                              <Mail className="h-3 w-3" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 space-y-2">
                    <p className="text-gray-500 dark:text-gray-400 font-medium">Harmonogram dostaw VMI:</p>
                    <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg text-center font-bold text-blue-700 dark:text-blue-400">
                      Sugerowane dni dostaw: Poniedziałek i Czwartek
                    </div>
                  </div>
                </div>

              {/* Showroom list */}
              {vendorShowrooms.length > 0 && (
                <div className="bg-white dark:bg-[#131A2E] rounded-xl p-4 space-y-4 text-xs shadow-sm">
                  <h5 className="font-bold text-[#1A1C1E] dark:text-white uppercase tracking-wider">Nowości i Wystawka (Showroom)</h5>
                  {vendorShowrooms.map(showroom => {
                    const productIds = showroom.sections?.[0]?.productIds || [];
                    const showroomProducts = productIds
                      .map(id => products.find(p => p.id === id))
                      .filter((p): p is Product => p !== undefined)
                      .slice(0, 2);

                    return (
                      <div key={showroom.id} className="space-y-2">
                        <div className="pb-1">
                          <h6 className="font-bold text-[#2A3B4C] dark:text-blue-400">{showroom.title}</h6>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-1">{showroom.description}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {showroomProducts.map(prod => (
                            <div key={prod.id} className="bg-gray-50 dark:bg-gray-800/40 p-2 rounded-lg text-center flex flex-col justify-between">
                              <span className="px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 rounded text-[8px] font-bold uppercase tracking-wide block w-fit mx-auto mb-1 truncate">
                                {prod.category}
                              </span>
                              <p className="font-semibold text-[#1A1C1E] dark:text-white line-clamp-1 text-[11px]">{prod.name}</p>
                              <p className="text-[#2A3B4C] dark:text-blue-400 mt-1 font-mono font-bold text-[11px]">{(prod.promoPrice || prod.price).toFixed(2)} zł</p>
                              <button
                                onClick={() => onAddToCart(prod.id, 1)}
                                className="mt-1.5 w-full py-1 bg-[#2A3B4C] dark:bg-blue-600 hover:bg-[#1E2B38] dark:hover:bg-blue-550 text-white text-[9px] font-bold rounded cursor-pointer transition-colors"
                              >
                                Dodaj +1
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right box: statistics & proposals */}
            <div className="lg:col-span-7 space-y-4">
              {vendorProposals.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-950/20 rounded-xl p-4 space-y-3 text-xs text-blue-800 dark:text-blue-300 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    <h5 className="font-bold text-[#2A3B4C] dark:text-blue-400">Aktywna propozycja VMI</h5>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 leading-normal">
                    System wygenerował nową kalkulację dostawy dla Twojego oddziału. Przejdź do propozycji, aby zaakceptować lub zmienić zamówienie.
                  </p>
                  <button
                    onClick={() => setActiveSubTab('catalog')} // fallback routing helper
                    className="px-4 py-2 bg-[#2A3B4C] dark:bg-blue-600 hover:bg-[#1E2B38] dark:hover:bg-blue-555 font-bold text-white rounded-lg cursor-pointer transition-colors"
                  >
                    Otwórz panel propozycji VMI
                  </button>
                </div>
              )}

              <div className="bg-white dark:bg-[#131A2E] rounded-xl p-5 space-y-4 text-xs shadow-sm">
                <h4 className="font-bold text-sm text-[#1A1C1E] dark:text-white uppercase tracking-wider">Historia i statystyki</h4>
                
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="p-4 bg-[#F8F9FA] dark:bg-gray-800/40 rounded-xl">
                    <span className="text-gray-500 dark:text-gray-400 block">Złożone zamówienia</span>
                    <span className="text-2xl font-bold text-[#2A3B4C] dark:text-blue-400 font-mono">{vendorOrders.length}</span>
                  </div>

                  <div className="p-4 bg-[#F8F9FA] dark:bg-gray-800/40 rounded-xl">
                    <span className="text-gray-500 dark:text-gray-400 block">Aktywne wyceny (B2B)</span>
                    <span className="text-2xl font-bold text-[#2A3B4C] dark:text-blue-400 font-mono">{vendorQuotations.length}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <h5 className="font-semibold text-gray-500 dark:text-gray-400">Ostatnie zamówienie:</h5>
                  {vendorOrders.length === 0 ? (
                    <p className="text-gray-400 dark:text-gray-550 italic">Brak wcześniejszych zamówień.</p>
                  ) : (
                    <div className="p-3 bg-gray-50 dark:bg-gray-800/40 rounded-lg flex justify-between items-center">
                      <div>
                        <p className="font-bold text-[#1A1C1E] dark:text-white font-mono">{vendorOrders[0].orderNumber}</p>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500">{vendorOrders[0].date}</p>
                      </div>
                      <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">{vendorOrders[0].status}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
          </div>
        )}

        {/* VIEW 2: CATALOG WITH THREE VIEWS AND PRICE SETTING */}
        {activeSubTab === 'catalog' && (
          <div className="space-y-4">
            
            {/* 1. Quick Filters above search bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-[#131A2E] p-3 rounded-xl text-xs shadow-sm">
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-1 sm:pb-0">
                <span className="text-gray-400 font-black uppercase tracking-wider text-[8px] mr-2 flex items-center gap-1 shrink-0 font-mono">
                  <Filter className="h-3 w-3 text-gray-400" /> Szybki filtr:
                </span>
                {[
                  { id: 'all', name: 'Wszystkie produkty' },
                  { id: 'ordered', name: 'Zamawiane w przeszłości' },
                  { id: 'lowStock', name: 'Niski stan magazynowy (<15)' }
                ].map(f => {
                  const isActive = activeQuickFilter === f.id;
                  return (
                    <button
                      key={f.id}
                      onClick={() => setActiveQuickFilter(f.id as any)}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap cursor-pointer",
                        isActive 
                          ? "bg-gray-100 dark:bg-gray-800 text-[#1A1C1E] dark:text-white" 
                          : "text-gray-500 hover:text-gray-950 dark:hover:text-white"
                      )}
                    >
                      {f.name}
                    </button>
                  );
                })}
              </div>

              {/* View Switches & Setting trigger */}
              <div className="flex items-center justify-end gap-2 shrink-0">
                {/* Catalog Settings popover */}
                <div className="relative">
                  <button
                    onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                    className={cn(
                      "p-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-600 dark:text-gray-300 transition-colors cursor-pointer flex items-center gap-1",
                      isSettingsOpen ? "bg-gray-250 dark:bg-gray-700 text-gray-950" : ""
                    )}
                    title="Ustawienia widoku"
                  >
                    <Settings className="h-3.5 w-3.5" />
                    <span className="text-[10px] font-extrabold">Opcje</span>
                  </button>
                  {isSettingsOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsSettingsOpen(false)} />
                      <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#0E1321] rounded-xl shadow-xl p-3.5 z-50 space-y-2.5 text-xs">
                        <p className="font-bold text-[9px] uppercase tracking-wider text-gray-400 font-mono">Parametry katalogu</p>
                        <label className="flex items-center gap-2.5 cursor-pointer text-gray-700 dark:text-gray-300 hover:text-gray-950 dark:hover:text-white font-bold">
                          <input 
                            type="checkbox" 
                            checked={hidePrices} 
                            onChange={(e) => setHidePrices(e.target.checked)}
                            className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                          />
                          <span>Ukryj ceny netto</span>
                        </label>
                        <p className="text-[9px] text-gray-400 dark:text-gray-550 leading-normal pt-2">
                          Aktywuj tę funkcję, aby zasymulować prezentację oferty bezpośrednio u klienta bez zdradzania cen bazowych.
                        </p>
                      </div>
                    </>
                  )}
                </div>

                <div className="h-5 w-px bg-gray-200 dark:bg-gray-800" />

                {/* View Toggles */}
                <div className="flex bg-gray-50 dark:bg-gray-800 rounded-lg p-0.5">
                  {[
                    { id: 'tile', label: 'Małe kafelki', icon: Grid },
                    { id: 'list', label: 'Lista', icon: List },
                    { id: 'table', label: 'Tabela', icon: Table }
                  ].map(v => {
                    const Icon = v.icon;
                    const isActive = viewMode === v.id;
                    return (
                      <button
                        key={v.id}
                        onClick={() => setViewMode(v.id as any)}
                        className={cn(
                          "p-1.5 rounded-md transition-all cursor-pointer",
                          isActive 
                            ? "bg-white dark:bg-[#131A2E] text-[#2A3B4C] dark:text-blue-400 shadow-sm" 
                            : "text-gray-400 hover:text-gray-750 dark:hover:text-gray-300"
                        )}
                        title={v.label}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </button>
                    );
                  })}
                </div>

                {viewMode === 'tile' && (
                  <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 px-2.5 py-1.5 rounded-lg text-[10px]">
                    <span className="text-gray-450 dark:text-gray-450 font-mono font-bold">Kafle:</span>
                    <input 
                      type="range" 
                      min="120" 
                      max="300" 
                      value={tileSize} 
                      onChange={(e) => setTileSize(Number(e.target.value))}
                      className="w-16 sm:w-24 accent-blue-600 h-1 bg-gray-200 dark:bg-gray-750 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="font-mono text-gray-600 dark:text-gray-300 whitespace-nowrap font-bold">{tileSize}px</span>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Search, Filter bar */}
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500 dark:text-gray-400">
                  <Search className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  placeholder="Wyszukaj produkt po nazwie lub SKU..."
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white dark:bg-[#131A2E] rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#2A3B4C] dark:focus:ring-blue-600 text-[#1A1C1E] dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-white dark:bg-[#131A2E] text-[#1A1C1E] dark:text-white px-3 py-2 rounded-xl text-xs cursor-pointer focus:outline-none shrink-0"
              >
                <option value="all">Wszystkie kategorie</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* 3. Render Views dynamically based on selection */}
            {filteredProducts.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400 text-xs bg-white dark:bg-[#131A2E] rounded-xl">
                Brak produktów pasujących do filtrów w tym katalogu.
              </div>
            ) : (
              <>
                {/* Mode A: tile (Compact Tile View) */}
                {viewMode === 'tile' && (
                  <div 
                    className="grid gap-3"
                    style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${tileSize}px, 1fr))` }}
                  >
                    {filteredProducts.map(prod => {
                      const pack = prod.packSize || 1;
                      const itemInCart = cart.find(i => i.productId === prod.id);

                      return (
                        <div 
                          key={prod.id} 
                          className="bg-white dark:bg-[#131A2E] rounded-xl p-3 flex flex-col justify-between dark:hover:border-gray-750 transition-all text-xs shadow-sm"
                        >
                          <div>
                            <div className="w-full aspect-[4/3] bg-gray-50 dark:bg-gray-800/40 rounded-lg overflow-hidden relative shrink-0">
                              <img src={prod.imageUrl} alt={prod.name} className="w-full h-full object-cover" />
                            </div>
                            
                            <div className="mt-2.5 space-y-1">
                              <h5 className="font-extrabold text-[#1A1C1E] dark:text-white line-clamp-1 leading-tight text-[11px]" title={prod.name}>
                                {prod.name}
                              </h5>
                              <p className="text-[9px] text-gray-400 dark:text-gray-500 font-mono">SKU: {prod.vendorSku}</p>
                              
                              {/* Warehouse quantity */}
                              <div className="flex items-center justify-between text-[9px] text-gray-400 pt-1 mt-1.5">
                                <span>W magazynie:</span>
                                <span className={cn(
                                  "font-extrabold font-mono",
                                  prod.warehouseQty !== undefined && prod.warehouseQty <= 15 ? "text-amber-600 dark:text-amber-400 animate-pulse" : "text-emerald-600 dark:text-emerald-400"
                                )}>
                                  {prod.warehouseQty ?? 25} szt.
                                </span>
                              </div>

                              {/* Package size info */}
                              <div className="flex items-center justify-between text-[9px] text-gray-400 pt-1 mt-1">
                                <span>Opakowanie:</span>
                                <span className="font-extrabold font-mono text-blue-600 dark:text-blue-400">
                                  1 paczka = {pack} {prod.unitOfMeasure}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 pt-2.5 space-y-2">
                            {!hidePrices && (
                              <div className="flex items-baseline justify-between font-mono">
                                <span className="text-[9px] text-gray-400">Netto:</span>
                                <span className="text-xs font-black text-[#1A1C1E] dark:text-white">
                                  {`${prod.price.toFixed(2)} zł`}
                                </span>
                              </div>
                            )}

                            <div className="space-y-1">
                              <ProductCartControl
                                productId={prod.id}
                                packSize={pack}
                                unitOfMeasure={prod.unitOfMeasure}
                                itemInCart={itemInCart}
                                onAddToCart={onAddToCart}
                                onUpdateCartQty={onUpdateCartQty}
                                onRemoveFromCart={onRemoveFromCart}
                                accentBgClass={getAccentClass('bg')}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Mode B: list (Compact Row/List View) */}
                {viewMode === 'list' && (
                  <div className="flex flex-col gap-2">
                    {filteredProducts.map(prod => {
                      const pack = prod.packSize || 1;
                      const itemInCart = cart.find(i => i.productId === prod.id);

                      return (
                        <div 
                          key={prod.id} 
                          className="bg-white dark:bg-[#131A2E] rounded-xl p-3 flex items-center justify-between gap-4 dark:hover:border-gray-750 transition-all text-xs shadow-sm"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-12 h-12 bg-gray-50 dark:bg-gray-800/40 rounded-lg overflow-hidden shrink-0 relative">
                              <img src={prod.imageUrl} alt={prod.name} className="w-full h-full object-cover" />
                            </div>
                            
                            <div className="min-w-0 flex-1">
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-[#F0F2F5] dark:bg-gray-800 text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-0.5 inline-block font-mono">
                                {prod.category}
                              </span>
                              <h5 className="font-extrabold text-[#1A1C1E] dark:text-white truncate leading-tight">{prod.name}</h5>
                              <div className="flex flex-wrap items-center gap-x-3 text-[10px] text-gray-400 font-mono">
                                <span>SKU: {prod.vendorSku}</span>
                                <span>•</span>
                                <span className="text-blue-600 dark:text-blue-400 font-bold">1 paczka = {pack} {prod.unitOfMeasure}</span>
                                <span>•</span>
                                <span className={cn(
                                  "font-bold",
                                  prod.warehouseQty !== undefined && prod.warehouseQty <= 15 ? "text-amber-600 dark:text-amber-400 animate-pulse" : "text-emerald-600 dark:text-emerald-400"
                                )}>
                                  Magazyn: {prod.warehouseQty ?? 25} szt.
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 shrink-0">
                            {!hidePrices && (
                              <div className="text-right font-mono pr-1 shrink-0">
                                <p className="text-[9px] text-gray-400">Cena netto</p>
                                <p className="text-sm font-black text-gray-900 dark:text-white">
                                  {`${prod.price.toFixed(2)} zł`}
                                </p>
                              </div>
                            )}

                            <div className="w-44 shrink-0">
                              <ProductCartControl
                                productId={prod.id}
                                packSize={pack}
                                unitOfMeasure={prod.unitOfMeasure}
                                itemInCart={itemInCart}
                                onAddToCart={onAddToCart}
                                onUpdateCartQty={onUpdateCartQty}
                                onRemoveFromCart={onRemoveFromCart}
                                accentBgClass={getAccentClass('bg')}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Mode C: table (Table View) */}
                {viewMode === 'table' && (
                  <div className="bg-white dark:bg-[#131A2E] rounded-xl overflow-x-auto shadow-sm">
                    <table className="w-full border-collapse text-left text-xs text-gray-700 dark:text-gray-300">
                      <thead>
                        <tr className="bg-gray-50/50 dark:bg-gray-800/50 font-extrabold text-gray-400 uppercase tracking-widest text-[8px] font-mono">
                          <th className="p-3 pl-4">Foto</th>
                          <th className="p-3">Produkt i SKU</th>
                          <th className="p-3">Kategoria</th>
                          <th className="p-3 font-mono text-center">Stan Magazynu</th>
                          {!hidePrices && <th className="p-3 font-mono text-right">Cena Netto</th>}
                          <th className="p-3 font-mono text-center">Opakowanie</th>
                          <th className="p-3 text-right pr-4">Koszyk</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-150 dark:divide-gray-850">
                        {filteredProducts.map(prod => {
                          const pack = prod.packSize || 1;
                          const itemInCart = cart.find(i => i.productId === prod.id);

                          return (
                            <tr key={prod.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                              <td className="p-3 pl-4 shrink-0">
                                <div className="w-8 h-8 bg-gray-50 dark:bg-gray-850 rounded overflow-hidden">
                                  <img src={prod.imageUrl} alt="" className="w-full h-full object-cover" />
                                </div>
                              </td>
                              <td className="p-3 font-medium">
                                <p className="font-extrabold text-gray-900 dark:text-white leading-tight">{prod.name}</p>
                                <p className="text-[9px] text-gray-400 font-mono">SKU: {prod.vendorSku}</p>
                              </td>
                              <td className="p-3">
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-[#F0F2F5] dark:bg-gray-850 text-gray-500 dark:text-gray-400 uppercase font-mono">
                                  {prod.category}
                                </span>
                              </td>
                              <td className="p-3 text-center font-mono font-bold">
                                <span className={cn(
                                  "px-1.5 py-0.5 rounded text-[10px]",
                                  prod.warehouseQty !== undefined && prod.warehouseQty <= 15 ? "text-amber-700 bg-amber-50 dark:bg-amber-950/20" : "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/20"
                                )}>
                                  {prod.warehouseQty ?? 25} szt.
                                </span>
                              </td>
                              {!hidePrices && (
                                <td className="p-3 text-right font-mono font-bold">
                                  {`${prod.price.toFixed(2)} zł`}
                                </td>
                              )}
                              <td className="p-3 text-center font-mono text-[11px]">
                                <div className="font-extrabold text-blue-600 dark:text-blue-400">1 paczka</div>
                                <div className="text-[9px] text-gray-400">({pack} {prod.unitOfMeasure})</div>
                              </td>
                              <td className="p-3 text-right pr-4">
                                <div className="flex items-center justify-end w-44 ml-auto">
                                  <ProductCartControl
                                    productId={prod.id}
                                    packSize={pack}
                                    unitOfMeasure={prod.unitOfMeasure}
                                    itemInCart={itemInCart}
                                    onAddToCart={onAddToCart}
                                    onUpdateCartQty={onUpdateCartQty}
                                    onRemoveFromCart={onRemoveFromCart}
                                    accentBgClass={getAccentClass('bg')}
                                  />
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

          </div>
        )}

        {/* VIEW 3: PROMOTIONS */}
        {activeSubTab === 'promotions' && (
          <div className="space-y-4 text-xs">
            <h4 className="font-bold text-sm text-[#1A1C1E] uppercase tracking-wider">Gazetki i kampanie rabatowe</h4>

            {vendorFlyers.length === 0 ? (
              <p className="text-gray-505 italic">Brak aktywnych gazetek w tym momencie.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {vendorFlyers.map(flyer => (
                  <div 
                    key={flyer.id}
                    onClick={() => onOpenFlyer(flyer)}
                    className="bg-white p-5 rounded-xl cursor-pointer flex items-center justify-between gap-4 transition-all shadow-sm"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-orange-700 font-semibold uppercase tracking-wider text-[10px]">
                        <BookOpen className="h-3.5 w-3.5" />
                        <span>Gazetka interaktywna</span>
                      </div>
                      <h5 className="font-bold text-sm text-[#1A1C1E] leading-snug">{flyer.title}</h5>
                      <p className="text-[11px] text-gray-500">Oferta ważna od {flyer.validFrom} do {flyer.validTo}</p>
                    </div>

                    <div className="shrink-0 text-right">
                      <span className="text-[10px] bg-red-50 text-red-700 font-extrabold uppercase px-2.5 py-1 rounded font-mono tracking-wider animate-pulse">
                        ZOBACZ
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW 4: QUOTATIONS */}
        {activeSubTab === 'quotations' && (
          <div className="space-y-4 text-xs">
            <h4 className="font-bold text-sm text-[#1A1C1E] uppercase tracking-wider">Specjalne oferty cenowe (B2B)</h4>

            {vendorQuotations.length === 0 ? (
              <div className="p-8 text-center text-gray-500 bg-[#F8F9FA] rounded-xl">
                Brak przypisanych ofert cenowych dla tego dostawcy.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {vendorQuotations.map(quote => (
                  <div 
                    key={quote.id}
                    className="bg-white rounded-xl p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3 shadow-sm"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-[#1A1C1E] font-mono">{quote.quotationNumber}</span>
                        <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-bold uppercase">
                          {quote.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-600">Opis: <span className="text-[#1A1C1E] font-medium">BHP i odzież specjalna dla serwisu</span></p>
                      <p className="text-[10px] text-gray-500">Oferta ważna do: <strong className="text-gray-700 font-semibold">{quote.validTo}</strong></p>
                    </div>

                    <div className="flex sm:flex-col justify-between sm:justify-center items-center sm:items-end shrink-0 sm:border-t-0 pt-2 sm:pt-0">
                      <p className="text-sm font-black font-mono text-[#1A1C1E]">{quote.totalValue.toFixed(2)} zł</p>
                      <button 
                        onClick={() => onAskVendorQuestion(quote.id, `Pytanie o warunki oferty cenowej ${quote.quotationNumber}`)}
                        className="text-[10px] text-blue-700 hover:text-blue-850 font-bold transition-colors cursor-pointer flex items-center gap-1 hover:underline"
                      >
                        <MessageSquare className="h-3 w-3" />
                        <span>Negocjuj warunki</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW 5: CART */}
        {activeSubTab === 'cart' && (
          <div className="space-y-5 text-xs">
            {isCheckoutSuccess ? (
              <div className="p-8 text-center bg-emerald-50 rounded-xl text-emerald-800 space-y-2 shadow-sm">
                <Check className="h-10 w-10 mx-auto animate-bounce" />
                <h5 className="font-extrabold text-sm text-[#1A1C1E]">Zamówienie zostało pomyślnie złożone!</h5>
                <p className="text-xs text-gray-500">
                  Przekonwertowano koszyk na oficjalne zamówienie o statusie <strong className="text-emerald-700">Nadesłane</strong>. Szczegóły zobaczysz w zakładce Zamówienia.
                </p>
              </div>
            ) : cart.length === 0 ? (
              <div className="p-8 text-center bg-[#F8F9FA] rounded-xl text-gray-500 shadow-sm">
                <ShoppingBag className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                <p>Twój koszyk dla tego dostawcy jest pusty.</p>
                <button
                  onClick={() => setActiveSubTab('catalog')}
                  className="mt-2.5 text-xs text-blue-700 hover:text-blue-850 font-bold underline cursor-pointer"
                >
                  Przeglądaj katalog i dodaj produkty
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                
                {/* Left: Cart Items list (Span 7) */}
                <div className="lg:col-span-7 bg-white rounded-xl overflow-hidden h-fit shadow-sm">
                  <div className="px-4 py-3 bg-[#F8F9FA] flex justify-between items-center">
                    <span className="font-bold text-xs text-[#1A1C1E] uppercase tracking-wider">Pozycje w koszyku ({cart.length})</span>
                    <span className="text-[10px] text-gray-500">Dostawca: {vendor.name}</span>
                  </div>

                  <div className="divide-y divide-gray-100">
                    {cart.map(item => {
                      const prod = products.find(p => p.id === item.productId);
                      if (!prod) return null;

                      const pack = prod.packSize || 1;
                      const hasPackWarning = item.requestedQty % pack !== 0;

                      return (
                        <div key={item.productId} className="p-3.5 space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-bold text-[#1A1C1E]">{prod.name}</p>
                              <p className="text-[10px] text-gray-405 font-mono">SKU: {prod.vendorSku} • Paczka: {pack} {prod.unitOfMeasure}</p>
                            </div>
                            
                            <button
                              onClick={() => onRemoveFromCart(item.productId)}
                              className="p-1.5 text-gray-400 hover:text-red-700 bg-gray-100 hover:bg-red-50 rounded cursor-pointer transition-colors"
                              title="Usuń pozycję"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          {/* Packing warning multiplier constraint */}
                          {hasPackWarning && (
                            <div className="bg-amber-50 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 text-[10px] text-amber-850">
                              <Info className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                              <span>Zamawiana ilość ({item.requestedQty}) nie jest wielokrotnością paczki zbiorczej ({pack}). Skoryguj ilość!</span>
                            </div>
                          )}

                          <div className="flex items-center justify-between gap-2 pt-1">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleQtyChangeInCart(item.productId, item.requestedQty, -pack, pack)}
                                className="w-7 h-7 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-bold flex items-center justify-center cursor-pointer"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>
                              <div className="w-12 text-center font-bold font-mono text-[#1A1C1E] text-xs py-0.5 bg-white rounded">
                                {item.requestedQty}
                              </div>
                              <button
                                onClick={() => handleQtyChangeInCart(item.productId, item.requestedQty, pack, pack)}
                                className="w-7 h-7 bg-[#2A3B4C] hover:bg-[#1E2B38] text-white rounded font-bold flex items-center justify-center cursor-pointer"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                              <span className="text-[10px] text-gray-405 uppercase font-mono pl-1">{prod.unitOfMeasure}</span>
                            </div>

                            <p className="font-semibold text-[#1A1C1E] font-mono">{(item.price * item.requestedQty).toFixed(2)} zł</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Totals panel */}
                  <div className="p-4 bg-[#F8F9FA] flex justify-between items-center">
                    <span className="font-semibold text-gray-500">Wartość netto:</span>
                    <div className="text-right">
                      <p className="text-base font-black font-mono text-[#1A1C1E]">{cartTotalValue.toFixed(2)} zł</p>
                      <p className="text-[10px] text-gray-405">+23% VAT: {(cartTotalValue * 1.23).toFixed(2)} zł</p>
                    </div>
                  </div>
                </div>

                {/* Right: Checkout settings form (Span 5) */}
                <form onSubmit={submitCartOrder} className="lg:col-span-5 bg-white rounded-xl p-5 space-y-4 shadow-sm">
                  <h4 className="font-bold text-xs text-[#1A1C1E] uppercase tracking-wider block pb-2">Dane i warunki dostawy</h4>

                  {/* Location switcher */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-505 uppercase tracking-wide">Miejsce rozładunku</label>
                    <select
                      value={deliveryLocId}
                      onChange={(e) => setDeliveryLocId(e.target.value)}
                      className="w-full bg-white text-gray-900 py-2 px-2.5 rounded-lg text-xs cursor-pointer focus:outline-none"
                    >
                      {locations.map(loc => (
                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Delivery date */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-505 uppercase tracking-wide">Wnioskowana data dostawy</label>
                    <input
                      type="date"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                      className="w-full bg-white text-gray-900 py-2 px-2.5 rounded-lg text-xs focus:outline-none font-mono"
                    />
                  </div>

                  {/* PO reference */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-505 uppercase tracking-wide">Indeks referencyjny PO (Klienta)</label>
                    <input
                      type="text"
                      placeholder="Nieduży np. PO-2026-95"
                      value={poReference}
                      onChange={(e) => setPoReference(e.target.value)}
                      className="w-full bg-white text-gray-900 py-2 px-2.5 rounded-lg text-xs focus:outline-none"
                    />
                  </div>

                  {/* General remarks */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-505 uppercase tracking-wide">Dodatkowe uwagi do dostawy</label>
                    <textarea
                      placeholder="Np. dostawa tylko w godz. 8:00 - 14:00"
                      value={checkoutComments}
                      onChange={(e) => setCheckoutComments(e.target.value)}
                      className="w-full bg-white text-gray-900 py-2 px-2.5 rounded-lg text-xs focus:outline-none min-h-[50px]"
                    ></textarea>
                  </div>

                  <button
                    type="submit"
                    className={cn(
                      "w-full py-3 rounded-xl font-bold text-xs text-white cursor-pointer transition-all active:scale-[0.98] shadow-sm",
                      getAccentClass('bg')
                    )}
                  >
                    Prześlij zamówienie B2B do VMI
                  </button>
                </form>

              </div>
            )}
          </div>
        )}

        {/* VIEW 6: CONTACTS & BRAND PORTFOLIO */}
        {activeSubTab === 'contact' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs text-[#1A1C1E] dark:text-gray-250">
            {/* Left Col: Contact business cards */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-white dark:bg-[#131A2E] rounded-2xl p-5 shadow-sm space-y-4 text-left">
                <h4 className="font-extrabold text-sm uppercase tracking-wider text-gray-900 dark:text-white pb-2">
                  Kontakt i Wsparcie
                </h4>
                
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  Skontaktuj się bezpośrednio z opiekunami handlowymi i wsparciem technicznym przypisanym do Twojego oddziału.
                </p>

                <div className="space-y-3 pt-2">
                  {(VENDOR_CONTACTS[vendor.id] || []).map((contact, idx) => (
                    <div key={idx} className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900 flex flex-col gap-3 relative overflow-hidden">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "w-2.5 h-2.5 rounded-full shrink-0",
                            contact.status === 'online' ? "bg-emerald-500 animate-pulse" :
                            contact.status === 'busy' ? "bg-amber-500" : "bg-gray-405"
                          )} />
                          <div>
                            <h5 className="font-black text-gray-950 dark:text-white text-xs">{contact.name}</h5>
                            <p className="text-[9px] text-gray-400 font-mono">{contact.role}</p>
                          </div>
                        </div>
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[8px] font-black uppercase font-mono tracking-wider",
                          contact.status === 'online' ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400" :
                          contact.status === 'busy' ? "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400" :
                          "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                        )}>
                          {contact.status === 'online' ? 'Dostępny' : contact.status === 'busy' ? 'Zajęty' : 'Offline'}
                        </span>
                      </div>

                      <div className="space-y-1.5 text-[11px] font-mono pt-2.5">
                        <div className="flex items-center gap-2 text-gray-750 dark:text-gray-300">
                          <Phone className="h-3.5 w-3.5 text-gray-400" />
                          <a href={`tel:${contact.phone}`} className="hover:underline">{contact.phone}</a>
                        </div>
                        <div className="flex items-center gap-2 text-gray-750 dark:text-gray-300">
                          <Mail className="h-3.5 w-3.5 text-gray-400" />
                          <a href={`mailto:${contact.email}`} className="hover:underline break-all">{contact.email}</a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Col: About & Brand Portfolio */}
            <div className="lg:col-span-8 space-y-4">
              <div className="bg-white dark:bg-[#131A2E] rounded-2xl p-6 shadow-sm space-y-6 text-left">
                {(() => {
                  const portfolio = VENDOR_PORTFOLIOS[vendor.id];
                  if (!portfolio) {
                    return (
                      <p className="text-gray-400 italic">Brak danych portfolio marki dla tego dostawcy.</p>
                    );
                  }

                  return (
                    <>
                      {/* Hero Brand Section */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between font-bold">
                          <h3 className="font-black text-lg text-gray-950 dark:text-white tracking-tight">
                            {vendor.name}
                          </h3>
                          <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 font-bold rounded-lg">
                            Partner od {portfolio.since}
                          </span>
                        </div>
                        <p className="text-xs text-gray-650 dark:text-gray-300 leading-relaxed">
                          {portfolio.about}
                        </p>
                      </div>

                      {/* Brand Specialties & Certs */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-3">
                        <div className="space-y-2">
                          <h4 className="font-extrabold text-[10px] text-gray-400 uppercase tracking-wider font-mono">
                            Specjalizacje i Linie Produktowe
                          </h4>
                          <div className="flex flex-wrap gap-1.5">
                            {portfolio.specialties.map((spec, i) => (
                              <span key={i} className="px-2 py-1 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 rounded-lg text-[10px] font-bold">
                                {spec}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <h4 className="font-extrabold text-[10px] text-gray-400 uppercase tracking-wider font-mono">
                            Certyfikaty i Standardy
                          </h4>
                          <div className="flex flex-wrap gap-1.5">
                            {portfolio.certifications.map((cert, i) => (
                              <span key={i} className="px-2 py-1 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 rounded-lg text-[10px] font-bold">
                                {cert}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Corporate Details */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-900/40 p-4 rounded-xl">
                        <div className="space-y-1">
                          <p className="text-[9px] text-gray-400 uppercase tracking-wider font-mono">Siedziba główna</p>
                          <p className="font-bold text-gray-800 dark:text-white">{portfolio.headquarters}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[9px] text-gray-400 uppercase tracking-wider font-mono">Strona korporacyjna</p>
                          <a 
                            href={portfolio.website} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                          >
                            <span>{portfolio.website}</span>
                          </a>
                        </div>
                      </div>

                      {/* Photo Showcase Gallery */}
                      {portfolio.gallery && portfolio.gallery.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="font-extrabold text-[10px] text-gray-400 uppercase tracking-wider font-mono">
                            Galeria i Produkcja
                          </h4>
                          <div className="grid grid-cols-3 gap-2.5">
                            {portfolio.gallery.map((img, i) => (
                              <div key={i} className="aspect-video bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden relative group">
                                <img 
                                  src={img} 
                                  alt={`Product Showcase ${i + 1}`} 
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* 4. FULL-SCREEN NEWS GALLERY & PUBLISHER ANNOUNCEMENT BOARD */}
      {isNewsOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 md:p-6">
          
          {/* Main modal card */}
          <div className="bg-white dark:bg-[#0E1321] w-full max-w-5xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            
            {/* Header */}
            <div className="bg-gray-50 dark:bg-[#131A2E] px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-[9px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-none">Tablica Ogłoszeń</p>
                  <h3 className="text-base font-black text-[#1A1C1E] dark:text-white mt-1 leading-tight">{vendor.name}</h3>
                </div>
              </div>
              <button
                onClick={() => setIsNewsOpen(false)}
                className="px-3.5 py-1.5 text-xs font-bold bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl cursor-pointer transition-colors"
              >
                Zamknij tablicę [ESC]
              </button>
            </div>

            {/* Split content */}
            <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
              
              {/* Left pane: Active Announcement detail */}
              <div className="flex-1 p-6 md:p-8 flex flex-col justify-between overflow-y-auto bg-[#F8F9FA]/30 dark:bg-[#0E1321]">
                {(() => {
                  const activeNews = allAnnouncements.find(n => n.id === activeNewsId) || allAnnouncements[0];
                  if (!activeNews) return <div className="text-gray-400">Brak aktywnego ogłoszenia</div>;

                  return (
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider text-white",
                            activeNews.type === 'offer' ? "bg-red-500" :
                            activeNews.type === 'announcement' ? "bg-orange-500" :
                            activeNews.type.startsWith('portfolio') ? "bg-blue-600" : "bg-emerald-600"
                          )}>
                            {activeNews.type === 'offer' ? 'OFERTA SPECJALNA' :
                             activeNews.type === 'announcement' ? 'OGŁOSZENIE' :
                             activeNews.type === 'portfolio_about' ? 'O NAS' :
                             activeNews.type === 'portfolio_specialties' ? 'SPECJALIZACJE I NORMY' : 'KOMUNIKAT'}
                          </span>
                          {activeNews.badgeText && (
                            <span className="px-2 py-0.5 bg-gray-150 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-bold text-[8px] rounded uppercase font-mono tracking-wider">
                              {activeNews.badgeText}
                            </span>
                          )}
                        </div>

                        <h2 className="text-lg md:text-xl font-black text-gray-950 dark:text-white leading-snug">
                          {activeNews.title}
                        </h2>

                        <p className="text-[10px] text-gray-400 font-mono">
                          {activeNews.type.startsWith('portfolio') 
                            ? 'Profil marki dostawcy VMI' 
                            : `Opublikowano: ${activeNews.date} przez administratora VMI`}
                        </p>
                      </div>

                      <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed bg-white dark:bg-gray-850 p-5 rounded-2xl whitespace-pre-line shadow-sm">
                        {activeNews.content}
                      </p>

                      <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-widest">Zainteresowany?</p>
                          <p className="text-[11px] text-gray-550 dark:text-gray-400">Wyślij natychmiastowe zapytanie o szczegóły tej kampanii.</p>
                        </div>
                        <button
                          onClick={() => {
                            onAskVendorQuestion(activeNews.id, `Pytanie o ofertę: ${activeNews.title}`);
                            setIsNewsOpen(false);
                          }}
                          className="px-3.5 py-2 bg-blue-600 hover:bg-blue-550 text-white font-extrabold text-xs rounded-xl transition-transform active:scale-95 cursor-pointer shadow-sm flex items-center gap-1 shrink-0"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          <span>Wyślij zapytanie</span>
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Right pane: List of other news + Form to post news */}
              <div className="w-full md:w-80 md:border-t-0 md:border-l bg-gray-50/50 dark:bg-[#121729] flex flex-col justify-between overflow-hidden">
                
                {/* News list */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  <p className="text-[9px] font-black uppercase tracking-wider text-gray-400 px-1">Galeria ogłoszeń ({allAnnouncements.length})</p>
                  <div className="space-y-1.5">
                    {allAnnouncements.map(item => {
                      const isActive = item.id === activeNewsId;
                      return (
                        <div
                          key={item.id}
                          onClick={() => setActiveNewsId(item.id)}
                          className={cn(
                            "p-3 rounded-xl transition-all cursor-pointer text-left",
                            isActive 
                              ? "bg-white dark:bg-[#131A2E] shadow-sm" 
                              : "bg-[#F8F9FA]/40 dark:bg-transparent dark:hover:border-gray-800"
                          )}
                        >
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            <span className={cn(
                              "text-[8px] font-bold px-1 rounded text-white",
                              item.type === 'offer' ? "bg-red-500" :
                              item.type === 'announcement' ? "bg-orange-500" :
                              item.type.startsWith('portfolio') ? "bg-blue-600" : "bg-emerald-600"
                            )}>
                              {item.type === 'offer' ? 'Oferta' :
                               item.type === 'announcement' ? 'Ogł.' :
                               item.type === 'portfolio_about' ? 'O nas' :
                               item.type === 'portfolio_specialties' ? 'Specj.' : 'Info'}
                            </span>
                            <span className="text-[8px] font-mono text-gray-400">{item.date}</span>
                          </div>
                          <p className={cn("text-[11px] font-extrabold leading-snug line-clamp-2", isActive ? "text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-400")}>
                            {item.title}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
