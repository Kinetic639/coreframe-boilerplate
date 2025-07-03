// MobileMenu.tsx
"use client";
import React from "react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import {
  Smartphone,
  QrCode,
  Bell,
  Barcode,
  Settings as GearIcon,
  BarChart,
  Archive,
  Truck,
  Hammer,
  Building,
  Hospital,
  Factory,
  GraduationCap,
  Wrench,
  FileText,
  BookOpen,
  RefreshCw,
  KanbanSquare,
  ChevronDown,
} from "lucide-react";

const features = [
  { icon: Smartphone, title: "Aplikacja mobilna", href: "/features#mobile" },
  { icon: QrCode, title: "Kodowanie QR", href: "/features#qr" },
  { icon: Bell, title: "Alerty", href: "/features#alerts" },
  { icon: Barcode, title: "Kodowanie kreskowe", href: "/features#barcode" },
  { icon: GearIcon, title: "Integracje", href: "/features#integrations" },
  { icon: BarChart, title: "Raportowanie", href: "/features#reporting" },
];

const solutions = [
  { icon: Archive, title: "Zarządzanie magazynem", href: "/solutions/magazynowanie" },
  { icon: Truck, title: "Śledzenie dostaw", href: "/solutions/dostawy" },
  { icon: Hammer, title: "Śledzenie aktywów", href: "/solutions/aktywa" },
  { icon: Building, title: "Budownictwo", href: "/solutions/budownictwo" },
  { icon: Hospital, title: "Placówki medyczne", href: "/solutions/medycyna" },
  { icon: Factory, title: "Produkcja", href: "/solutions/produkcja" },
  { icon: GraduationCap, title: "Edukacja", href: "/solutions/edukacja" },
  { icon: Wrench, title: "Serwis i naprawy", href: "/solutions/serwis" },
];

const materials = [
  { icon: FileText, title: "Blog", href: "/blog" },
  { icon: BookOpen, title: "Baza wiedzy", href: "/knowledge-base" },
  { icon: RefreshCw, title: "Aktualizacje", href: "/updates" },
  { icon: KanbanSquare, title: "Roadmapa", href: "/roadmap" },
];

const MobileMenu = () => {
  return (
    <div className="border-t bg-background md:hidden">
      <div className="container space-y-4 py-4">
        <Dropdown title="Funkcje" items={features} />
        <Dropdown title="Rozwiązania" items={solutions} />
        <Dropdown title="Materiały edukacyjne" items={materials} />

        <Button variant="ghost" className="w-full justify-start" asChild>
          <Link href="/">Cennik</Link>
        </Button>

        <div className="flex flex-col gap-2 pt-4">
          <Button variant="outline" className="w-full" asChild>
            <Link href="/sign-in">Zaloguj się</Link>
          </Button>
          <Button className="w-full" asChild>
            <Link href="/sign-up">Rozpocznij za darmo</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

const Dropdown = ({
  title,
  items,
}: {
  title: string;
  items: { icon: React.ElementType; title: string; href: string }[];
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" className="w-full justify-between">
        {title}
        <ChevronDown className="ml-2 h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent className="w-full">
      <DropdownMenuItem asChild>
        <Link href="/" className="w-full">
          Wszystkie {title.toLowerCase()}
        </Link>
      </DropdownMenuItem>
      {items.map((item) => (
        <DropdownMenuItem key={item.title} asChild>
          <Link href={"/"} className="flex items-center gap-2">
            <item.icon className="h-4 w-4 text-primary" />
            <span>{item.title}</span>
          </Link>
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
);

export default MobileMenu;
