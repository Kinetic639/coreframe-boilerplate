import {
  Smartphone,
  QrCode,
  Bell,
  Barcode,
  Settings as GearIcon,
  BarChart,
  Archive,
  Building,
  Factory,
  GraduationCap,
  Hospital,
  Wrench,
  Truck,
  Hammer,
  BookOpen,
  FileText,
  RefreshCw,
  KanbanSquare,
} from "lucide-react";

export const features = [
  {
    icon: Smartphone,
    title: "Aplikacja mobilna",
    description: "Śledź inwentarz z dowolnego miejsca",
    href: "/features#mobile",
  },
  {
    icon: QrCode,
    title: "Kodowanie QR",
    description: "Skanowanie i etykietowanie kodów QR",
    href: "/features#qr",
  },
  {
    icon: Bell,
    title: "Alerty",
    description: "Alerty o niskim stanie, przeterminowaniu",
    href: "/features#alerts",
  },
  {
    icon: Barcode,
    title: "Kodowanie kreskowe",
    description: "Etykietowanie i skanowanie kodów",
    href: "/features#barcode",
  },
  {
    icon: GearIcon,
    title: "Integracje",
    description: "Połączenie z innymi systemami",
    href: "/features#integrations",
  },
  {
    icon: BarChart,
    title: "Raportowanie",
    description: "Statystyki i analizy danych",
    href: "/features#reporting",
  },
];

export const solutionsMenuItems = [
  {
    category: "Zastosowania",
    items: [
      {
        icon: Archive,
        title: "Zarządzanie magazynem",
        description: "Zarządzaj, organizuj i monitoruj cały inwentarz swojej firmy",
        href: "/solutions/magazynowanie",
      },
      {
        icon: Truck,
        title: "Śledzenie dostaw",
        description: "Śledź materiały, surowce i części wykorzystywane w Twojej firmie",
        href: "/solutions/dostawy",
      },
      {
        icon: Hammer,
        title: "Śledzenie aktywów",
        description: "Śledź narzędzia, sprzęt i inne wartościowe aktywa z łatwością",
        href: "/solutions/aktywa",
      },
    ],
  },
  {
    category: "Branże",
    items: [
      {
        icon: Building,
        title: "Budownictwo",
        description: "Zarządzaj inwentarzem budowlanym i narzędziami na wszystkich placach budowy",
        href: "/solutions/budownictwo",
      },
      {
        icon: Hospital,
        title: "Placówki medyczne",
        description: "Bezproblemowo zarządzaj materiałami medycznymi i sprzętem w podróży",
        href: "/solutions/medycyna",
      },
      {
        icon: Factory,
        title: "Produkcja",
        description:
          "Uproszczenie operacji magazynowych dzięki inteligentniejszemu śledzeniu zapasów",
        href: "/solutions/produkcja",
      },
      {
        icon: GraduationCap,
        title: "Edukacja",
        description: "Łatwo zarządzaj inwentarzem szkolnym i materiałami",
        href: "/solutions/edukacja",
      },
      {
        icon: Wrench,
        title: "Serwis i naprawy",
        description:
          "Zwiększ efektywność organizacji non-profit dzięki kontroli zapasów w czasie rzeczywistym",
        href: "/solutions/serwis",
      },
    ],
  },
];

export const educationalMenuItems = [
  {
    category: "Materiały",
    items: [
      {
        icon: FileText,
        title: "Blog",
        description: "Artykuły i porady dotyczące zarządzania magazynem",
        href: "/blog",
      },
      {
        icon: BookOpen,
        title: "Baza wiedzy",
        description: "Kompleksowe poradniki i instrukcje",
        href: "/knowledge-base",
      },
      {
        icon: RefreshCw,
        title: "Aktualizacje",
        description: "Najnowsze aktualizacje i funkcje produktu",
        href: "/updates",
      },
      {
        icon: KanbanSquare,
        title: "Roadmapa",
        description: "Zobacz co planujemy na przyszłość",
        href: "/roadmap",
      },
    ],
  },
];
