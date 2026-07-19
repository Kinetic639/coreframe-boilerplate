import Link from "next/link";
import { Search, ShoppingBag, Store } from "lucide-react";

interface PublicMarketplaceShellProps {
  children: React.ReactNode;
}

const links = [
  { href: "/", label: "Start" },
  { href: "/vendors", label: "Wyszukiwarka" },
  { href: "/products", label: "Produkty" }
];

export function PublicMarketplaceShell({ children }: PublicMarketplaceShellProps) {
  return (
    <div className="min-h-screen bg-[#f6f8fb] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1f3347] text-white shadow-sm">
              <Store className="h-5 w-5" />
            </span>
            <span>
              <span className="block font-display text-sm font-black text-[#1f3347]">
                Ambra VMI
              </span>
              <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                Marketplace B2B
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-100 hover:text-slate-950"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/vendors"
              className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm hover:bg-slate-50 sm:flex"
            >
              <Search className="h-4 w-4" />
              Szukaj
            </Link>
            <Link
              href="/sign-in"
              className="flex items-center gap-2 rounded-xl bg-[#1f3347] px-3 py-2 text-xs font-black text-white shadow-sm"
            >
              <ShoppingBag className="h-4 w-4" />
              Portal klienta
            </Link>
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer className="mb-14 mt-12 border-t border-slate-100 bg-white py-8 text-xs text-slate-400 lg:mb-0">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 text-center md:flex-row md:text-left">
          <div className="flex flex-col items-center gap-2 sm:flex-row">
            <span className="font-display font-extrabold uppercase text-[#2A3B4C]">
              Ambra VMI Marketplace
            </span>
            <span className="hidden sm:inline">•</span>
            <span>© 2026 Wszystkie prawa zastrzeżone</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/" className="hover:underline">
              Jak to działa
            </Link>
            <Link href="/vendors" className="hover:underline">
              Dla dostawców
            </Link>
            <Link href="/sign-in" className="font-bold text-blue-600 hover:underline">
              Portal partnerski
            </Link>

            <span className="hidden h-4 w-px bg-slate-200 sm:inline" />

            <Link
              href="/products"
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-bold text-slate-500 shadow-sm transition-colors hover:bg-slate-100"
            >
              Katalog produktów
            </Link>
          </div>
        </div>
      </footer>

      <nav className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-3 border-t border-slate-200 bg-white/95 px-2 py-2 backdrop-blur md:hidden">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-[10px] font-black uppercase tracking-wide text-slate-500 hover:text-blue-600"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
