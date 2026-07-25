"use client";

import * as React from "react";
import Link from "next/link";
import {
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Globe,
  Heart,
  Layers,
  Mail,
  MessageSquare,
  Phone,
  Search,
  X,
} from "lucide-react";
import type {
  VmiPortalMessageThreadDto,
  VmiPortalOrderDto,
  VmiPortalProposalDto,
  VmiPortalVendorDto,
} from "@/lib/vmi-portal/types";
import { vendorPortalPath } from "@/lib/vmi-portal/vendor-slugs";
import { cn } from "@/utils/cn";

type VendorsTab = "partner" | "favourite_products" | "favourite_vendors";
type AnnouncementSlide = ReturnType<typeof buildSlides>[number];

interface PortalVendorsExperienceProps {
  vendors: VmiPortalVendorDto[];
  proposals: VmiPortalProposalDto[];
  orders: VmiPortalOrderDto[];
  messageThreads: VmiPortalMessageThreadDto[];
}

const accentStyles = {
  blue: {
    header: "bg-gradient-to-r from-blue-500/10 to-blue-600/5 dark:from-blue-550/20 dark:to-blue-900/10",
    logo: "bg-gradient-to-br from-blue-600 to-indigo-700",
  },
  orange: {
    header: "bg-gradient-to-r from-amber-500/10 to-orange-600/5 dark:from-amber-550/20 dark:to-orange-900/10",
    logo: "bg-gradient-to-br from-amber-500 to-orange-600",
  },
  green: {
    header: "bg-gradient-to-r from-emerald-500/10 to-teal-600/5 dark:from-emerald-550/20 dark:to-teal-900/10",
    logo: "bg-gradient-to-br from-emerald-500 to-teal-600",
  },
  rose: {
    header: "bg-gradient-to-r from-rose-500/10 to-red-600/5 dark:from-rose-550/20 dark:to-red-900/10",
    logo: "bg-gradient-to-br from-rose-600 to-red-700",
  },
} satisfies Record<VmiPortalVendorDto["accentColor"], { header: string; logo: string }>;

function getInitials(name: string) {
  const prototypeInitials: Record<string, string> = {
    "AutoParts Pro": "AF",
    WerkTools: "EH",
    CleanChem: "PK",
    SafetyCore: "SC",
  };

  if (prototypeInitials[name]) return prototypeInitials[name];

  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function buildSlides(vendor: VmiPortalVendorDto) {
  return [
    {
      id: `${vendor.id}-about`,
      type: "portfolio_about",
      title: `O nas: ${vendor.name}`,
      badge: "PORTFOLIO MARKI",
      badgeText: `Partner od ${vendor.portfolio.since}`,
      content: vendor.portfolio.about,
      ctaText: "Szczegóły",
      date: "Profil marki dostawcy VMI",
    },
    {
      id: `${vendor.id}-specialties`,
      type: "portfolio_specialties",
      title: "Nasze specjalizacje i certyfikaty",
      badge: "PORTFOLIO MARKI",
      badgeText: "STANDARDY JAKOŚCI",
      content: `Specjalizacje: ${vendor.portfolio.specialties.join(", ")}. Standardy: ${vendor.portfolio.certifications.join(", ")}.`,
      ctaText: "Szczegóły",
      date: "Profil marki dostawcy VMI",
    },
    ...vendor.announcements.map((item) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      badge:
        item.type === "offer" ? "OFERTA SPECJALNA" : item.type === "announcement" ? "OGŁOSZENIE" : "KOMUNIKAT",
      badgeText: item.badgeText,
      content: item.content,
      ctaText: "Szczegóły",
      date: "2026-07-13",
    })),
  ];
}

function EmptySavedPanel({ label, href }: { label: string; href: string }) {
  return (
    <div className="space-y-3.5 rounded-2xl border border-gray-100 bg-white p-12 text-center text-xs dark:border-gray-850 dark:bg-[#0E1321]">
      <p className="italic text-gray-400">{label}</p>
      <Link
        href={href}
        className="inline-flex rounded-lg bg-blue-600 px-4 py-2 text-[10px] font-bold text-white shadow transition hover:bg-blue-500"
      >
        Przeglądaj Wyszukiwarkę B2B
      </Link>
    </div>
  );
}

export function PortalVendorsExperience({
  vendors,
  proposals,
  orders,
  messageThreads,
}: PortalVendorsExperienceProps) {
  const [activeTab, setActiveTab] = React.useState<VendorsTab>("partner");
  const [search, setSearch] = React.useState("");
  const [expandedVendorId, setExpandedVendorId] = React.useState<string | null>(null);
  const [activeSlides, setActiveSlides] = React.useState<Record<string, number>>({});
  const [announcementBoard, setAnnouncementBoard] = React.useState<{
    vendor: VmiPortalVendorDto;
    activeNewsId: string;
  } | null>(null);

  React.useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveSlides((current) => {
        const next = { ...current };
        for (const vendor of vendors) {
          const totalSlides = buildSlides(vendor).length;
          next[vendor.id] = ((current[vendor.id] ?? 0) + 1) % totalSlides;
        }
        return next;
      });
    }, 6000);

    return () => window.clearInterval(interval);
  }, [vendors]);

  React.useEffect(() => {
    if (!announcementBoard) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAnnouncementBoard(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [announcementBoard]);

  const filteredVendors = vendors.filter((vendor) => {
    if (!search.trim()) return true;
    const query = search.toLowerCase();
    return vendor.name.toLowerCase().includes(query) || vendor.industry.toLowerCase().includes(query);
  });

  const placeholder =
    activeTab === "partner"
      ? "Przeszukaj swoich certyfikowanych dostawców..."
      : activeTab === "favourite_products"
        ? "Przeszukaj ulubione produkty w bazie..."
        : "Przeszukaj ulubionych dostawców z rynku...";

  return (
    <section className="space-y-6 text-xs animate-fade-in">
      <div>
        <h1 className="font-display text-base font-bold text-gray-950 dark:text-white">
          Dostawcy i Baza Produktów
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          Zarządzaj certyfikowanymi partnerami VMI oraz zapisanymi ofertami i dostawcami z rynku B2B
        </p>
      </div>

      <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-850 dark:bg-[#0E1321] sm:flex-row">
        <div className="relative w-full flex-1">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400 dark:text-gray-500">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            placeholder={placeholder}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-10 text-xs text-gray-900 outline-none placeholder:text-gray-450 focus:ring-2 focus:ring-blue-500 dark:border-gray-800 dark:bg-[#0C101A] dark:text-white dark:placeholder:text-gray-500"
          />
          {search ? (
                          <button
                            type="button"
              onClick={() => setSearch("")}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-450 hover:text-gray-650 dark:hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <Link
          href="/vendors"
          className="flex w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-blue-150 bg-blue-50 px-4 py-2.5 text-xs font-extrabold text-blue-600 shadow-sm transition hover:bg-blue-100 dark:border-blue-900/40 dark:bg-blue-950/25 dark:text-blue-400 dark:hover:bg-blue-950/50 sm:w-auto"
        >
          <Globe className="h-4 w-4" />
          Przejdź do Wyszukiwarki B2B
        </Link>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-gray-100 pt-2 dark:border-gray-800/80">
        {[
          { id: "partner", label: `Partnerzy VMI (${filteredVendors.length})`, icon: Layers },
          { id: "favourite_products", label: "Ulubione produkty (0)", icon: Heart },
          { id: "favourite_vendors", label: "Ulubieni dostawcy (0)", icon: Building2 },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id as VendorsTab);
                setSearch("");
              }}
              className={cn(
                "-mb-px flex shrink-0 cursor-pointer items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-bold transition-all",
                isActive
                  ? "border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-400"
                  : "border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-white",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "partner" ? (
        <div className="grid grid-cols-1 gap-6 animate-fade-in">
          {filteredVendors.map((vendor) => {
            const styles = accentStyles[vendor.accentColor];
            const contacts = vendor.contacts;
            const onlineCount = contacts.filter((contact) => contact.status === "online").length;
            const busyCount = contacts.filter((contact) => contact.status === "busy").length;
            const totalAvailable = onlineCount + busyCount;
            const isExpanded = expandedVendorId === vendor.id;
            const vendorProposalsCount = proposals.filter(
              (proposal) => proposal.vendorId === vendor.id && proposal.status === "Oczekuje na zatwierdzenie",
            ).length;
            const pendingOrdersCount = orders.filter(
              (order) => order.vendorId === vendor.id && order.status !== "Dostarczone",
            ).length;
            const unreadMessages =
              messageThreads.find((thread) => thread.vendorId === vendor.id)?.unreadCount ?? 0;
            const slides = buildSlides(vendor);
            const currentSlideIndex = (activeSlides[vendor.id] ?? 0) % slides.length;
            const currentSlide = slides[currentSlideIndex] ?? slides[0]!;

            return (
              <article
                key={vendor.id}
                className="group grid grid-cols-1 overflow-hidden rounded-2xl bg-white shadow-md transition-all dark:bg-[#0E1321] dark:shadow-black/25 md:grid-cols-2"
              >
                <div className="flex flex-col justify-between border-r border-gray-100 dark:border-gray-850">
                  <div className={cn("relative flex h-20 items-center justify-between overflow-hidden px-5 py-3", styles.header)}>
                    <div className="pointer-events-none absolute inset-0 truncate p-2 font-mono text-[8px] uppercase leading-none tracking-tight opacity-[0.06] select-none dark:opacity-[0.1]">
                      {Array(15).fill("VMI CONNECT - CERTIFIED ").join(" ")}
                    </div>
                    <div className="z-10 flex items-center gap-3">
                      <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl text-sm font-black text-white shadow-sm", styles.logo)}>
                        {getInitials(vendor.name)}
                      </div>
                      <div>
                        <h2 className="text-xs font-black leading-tight text-gray-950 dark:text-white">
                          {vendor.name}
                        </h2>
                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                          {vendor.connectionStatus}
                        </span>
                      </div>
                    </div>
                    <span className="z-10 rounded bg-white/80 px-2 py-1 font-mono text-[8px] font-black uppercase tracking-widest text-gray-500 dark:bg-black/40 dark:text-gray-400">
                      {vendor.industry}
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col justify-between gap-4 p-5">
                    <div className="space-y-3">
                          <button
                            type="button"
                        onClick={() => setExpandedVendorId(isExpanded ? null : vendor.id)}
                        className="flex w-full cursor-pointer items-center justify-between rounded-xl bg-[#F8F9FA] p-3 text-left shadow-sm transition-all hover:bg-gray-100 dark:bg-[#121729] dark:hover:bg-[#181F38]"
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className={cn(
                              "relative h-2.5 w-2.5 shrink-0 rounded-full",
                              onlineCount > 0 ? "bg-emerald-500" : busyCount > 0 ? "bg-amber-500" : "bg-gray-400",
                            )}
                          >
                            {onlineCount > 0 ? (
                              <span className="absolute inset-0 rounded-full bg-emerald-500 opacity-75 animate-ping" />
                            ) : null}
                          </span>
                          <span>
                            <span className="block text-[10px] font-black text-gray-800 dark:text-gray-200">
                              {totalAvailable > 0 ? `Opiekunowie online: ${totalAvailable}` : "Opiekunowie offline"}
                            </span>
                            <span className="block text-[9px] text-gray-400">Kliknij, aby rozwinąć</span>
                          </span>
                        </span>
                        <span className="flex items-center gap-1 font-mono text-[10px] text-gray-500">
                          <span className="text-[9px] font-extrabold text-blue-600 dark:text-blue-400">
                            {contacts.length} {contacts.length === 1 ? "osoba" : "osoby"}
                          </span>
                          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </span>
                      </button>

                      {isExpanded ? (
                        <div className="space-y-1.5 pt-1 text-left">
                          {contacts.map((contact) => (
                            <div key={contact.email} className="flex items-center justify-between rounded-lg bg-white p-2 dark:bg-[#0A0D18]">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={cn(
                                    "h-1.5 w-1.5 shrink-0 rounded-full",
                                    contact.status === "online"
                                      ? "bg-emerald-500"
                                      : contact.status === "busy"
                                        ? "bg-amber-500"
                                        : "bg-gray-400",
                                  )}
                                />
                                <div>
                                  <p className="text-[10px] font-bold text-gray-900 dark:text-gray-200">{contact.name}</p>
                                  <p className="font-mono text-[8px] text-gray-400">{contact.role}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <a href={`tel:${contact.phone}`} className="rounded bg-gray-50 p-1 text-gray-650 hover:bg-gray-150 dark:bg-gray-800 dark:text-gray-300">
                                  <Phone className="h-3 w-3" />
                                </a>
                                <a href={`mailto:${contact.email}`} className="rounded bg-gray-50 p-1 text-gray-650 hover:bg-gray-150 dark:bg-gray-800 dark:text-gray-300">
                                  <Mail className="h-3 w-3" />
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      <div className="space-y-1.5">
                        {vendorProposalsCount > 0 ? (
                          <div className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1.5 text-left text-[10px] font-bold text-blue-700 dark:bg-blue-950/20 dark:text-blue-400">
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500 animate-ping" />
                            Czeka propozycja dostawy VMI ({vendorProposalsCount})
                          </div>
                        ) : null}
                        {unreadMessages > 0 ? (
                          <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-left text-[10px] font-bold text-amber-700 dark:bg-amber-950/20 dark:text-amber-400">
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500 animate-pulse" />
                            Masz nieprzeczytaną odpowiedź ({unreadMessages})
                          </div>
                        ) : null}
                        {pendingOrdersCount > 0 ? (
                          <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-left text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400">
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500 animate-pulse" />
                            Aktywne zamówienie w realizacji ({pendingOrdersCount})
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <Link
                      href={vendorPortalPath(vendor.id)}
                      className="w-full rounded-lg bg-gray-50 py-2.5 text-center text-xs font-bold text-gray-700 transition-colors hover:bg-gray-100 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-750"
                    >
                      Otwórz panel partnera
                    </Link>
                  </div>
                </div>

                <div className="relative flex min-h-[300px] flex-col justify-between overflow-hidden bg-[#1A2536] p-6 text-white dark:bg-[#090D16] md:min-h-full">
                  <div className="pointer-events-none absolute right-0 top-0 h-36 w-36 translate-x-10 -translate-y-10 rounded-full bg-blue-500/10 transition-transform duration-500 group-hover:scale-110" />
                  <div className="pointer-events-none absolute bottom-0 left-0 h-24 w-24 -translate-x-6 translate-y-6 rounded-full bg-indigo-500/5" />

                  <div className="relative z-10 flex h-full flex-col justify-between">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={cn(
                            "rounded px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-white",
                            currentSlide.type === "offer"
                              ? "bg-red-500"
                              : currentSlide.type === "announcement"
                                ? "bg-orange-500"
                                : currentSlide.type.startsWith("portfolio")
                                  ? "bg-blue-600"
                                  : "bg-emerald-600",
                          )}
                        >
                          {currentSlide.badge}
                        </span>
                        <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wider text-gray-300">
                          {currentSlide.badgeText}
                        </span>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setActiveSlides((current) => ({
                              ...current,
                              [vendor.id]: (currentSlideIndex - 1 + slides.length) % slides.length,
                            }))
                          }
                          className="rounded bg-white/5 p-1 text-white transition-colors hover:bg-white/10"
                          title="Poprzedni"
                        >
                          <ChevronLeft className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setActiveSlides((current) => ({
                              ...current,
                              [vendor.id]: (currentSlideIndex + 1) % slides.length,
                            }))
                          }
                          className="rounded bg-white/5 p-1 text-white transition-colors hover:bg-white/10"
                          title="Nastepny"
                        >
                          <ChevronRight className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    <div className="my-auto flex min-h-24 flex-col justify-center overflow-hidden py-4 text-left">
                      <div
                        key={currentSlide.id}
                        className="animate-fade-in motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-300"
                      >
                        <h3 className="mb-1.5 line-clamp-2 text-xs font-black leading-snug text-white sm:text-sm">
                          {currentSlide.title}
                        </h3>
                        <p className="line-clamp-3 text-[11px] leading-relaxed text-slate-300/95">
                          {currentSlide.content}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 pt-2">
                      <button
                        type="button"
                        onClick={() =>
                          setAnnouncementBoard({
                            vendor,
                            activeNewsId: currentSlide.id,
                          })
                        }
                        className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-[10px] font-extrabold text-white shadow-md transition-all hover:bg-blue-550"
                      >
                        {currentSlide.ctaText}
                        <ChevronRight className="h-3 w-3" />
                      </button>

                      <div className="flex items-center gap-1">
                        {slides.map((slide, index) => (
                          <button
                            key={slide.id}
                            type="button"
                            onClick={() => setActiveSlides((current) => ({ ...current, [vendor.id]: index }))}
                            className={cn(
                              "h-1.5 rounded-full transition-all",
                              index === currentSlideIndex ? "w-3 bg-blue-500" : "w-1.5 bg-white/20 hover:bg-white/40",
                            )}
                            aria-label={`Pokaz slajd ${index + 1}`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : activeTab === "favourite_products" ? (
        <EmptySavedPanel label="Brak zapisanych produktów w schowku spełniających kryteria." href="/vendors" />
      ) : (
        <EmptySavedPanel label="Brak dostawców zapisanych w Twoim schowku." href="/vendors" />
      )}

      {announcementBoard ? (
        <AnnouncementBoard
          vendor={announcementBoard.vendor}
          activeNewsId={announcementBoard.activeNewsId}
          onActiveNewsChange={(activeNewsId) =>
            setAnnouncementBoard((current) =>
              current ? { ...current, activeNewsId } : current,
            )
          }
          onClose={() => setAnnouncementBoard(null)}
        />
      ) : null}
    </section>
  );
}

function getNewsBadge(slide: AnnouncementSlide) {
  if (slide.type === "offer") return "OFERTA SPECJALNA";
  if (slide.type === "announcement") return "OGŁOSZENIE";
  if (slide.type === "portfolio_about") return "O NAS";
  if (slide.type === "portfolio_specialties") return "SPECJALIZACJE I NORMY";
  return "KOMUNIKAT";
}

function getNewsShortBadge(slide: AnnouncementSlide) {
  if (slide.type === "offer") return "Oferta";
  if (slide.type === "announcement") return "Ogł.";
  if (slide.type === "portfolio_about") return "O nas";
  if (slide.type === "portfolio_specialties") return "Specj.";
  return "Info";
}

function newsToneClass(slide: AnnouncementSlide) {
  if (slide.type === "offer") return "bg-red-500";
  if (slide.type === "announcement") return "bg-orange-500";
  if (slide.type.startsWith("portfolio")) return "bg-blue-600";
  return "bg-emerald-600";
}

function AnnouncementBoard({
  vendor,
  activeNewsId,
  onActiveNewsChange,
  onClose,
}: {
  vendor: VmiPortalVendorDto;
  activeNewsId: string;
  onActiveNewsChange: (activeNewsId: string) => void;
  onClose: () => void;
}) {
  const allAnnouncements = buildSlides(vendor);
  const activeNews =
    allAnnouncements.find((announcement) => announcement.id === activeNewsId) ?? allAnnouncements[0];

  if (!activeNews) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-md dark:bg-black/80 md:p-6">
      <div className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-[#0E1321]">
        <div className="flex items-center justify-between bg-gray-50 px-6 py-4 dark:bg-[#131A2E]">
          <div>
            <p className="text-[9px] font-extrabold uppercase leading-none tracking-widest text-gray-400 dark:text-gray-500">
              Tablica Ogłoszeń
            </p>
            <h2 className="mt-1 text-base font-black leading-tight text-[#1A1C1E] dark:text-white">
              {vendor.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-xl bg-gray-100 px-3.5 py-1.5 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Zamknij tablicę [ESC]
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
          <div className="flex-1 overflow-y-auto bg-[#F8F9FA]/30 p-6 dark:bg-[#0E1321] md:p-8">
            <div
              key={activeNews.id}
              className="space-y-6 animate-fade-in motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300"
            >
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "rounded px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-white",
                      newsToneClass(activeNews),
                    )}
                  >
                    {getNewsBadge(activeNews)}
                  </span>
                  <span className="rounded bg-gray-150 px-2 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wider text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    {activeNews.badgeText}
                  </span>
                </div>

                <h3 className="text-lg font-black leading-snug text-gray-950 dark:text-white md:text-xl">
                  {activeNews.title}
                </h3>

                <p className="font-mono text-[10px] text-gray-400">
                  {activeNews.type.startsWith("portfolio")
                    ? "Profil marki dostawcy VMI"
                    : `Opublikowano: ${activeNews.date} przez administratora VMI`}
                </p>
              </div>

              <p className="whitespace-pre-line rounded-2xl bg-white p-5 text-xs leading-relaxed text-gray-600 shadow-sm dark:bg-gray-850 dark:text-gray-300">
                {activeNews.content}
              </p>

              <div className="flex items-center justify-between rounded-xl bg-blue-50 p-4 dark:bg-blue-950/20">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-700 dark:text-blue-400">
                    Zainteresowany?
                  </p>
                  <p className="text-[11px] text-gray-550 dark:text-gray-400">
                    Wyślij natychmiastowe zapytanie o szczegóły tej kampanii.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex shrink-0 cursor-pointer items-center gap-1 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-extrabold text-white shadow-sm transition-transform hover:bg-blue-550 active:scale-95"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Wyślij zapytanie
                </button>
              </div>
            </div>
          </div>

          <div className="flex w-full flex-col justify-between overflow-hidden bg-gray-50/50 dark:bg-[#121729] md:w-80 md:border-l md:border-gray-200 md:dark:border-gray-800">
            <div className="flex-1 space-y-2 overflow-y-auto p-4">
              <p className="px-1 text-[9px] font-black uppercase tracking-wider text-gray-400">
                Galeria ogłoszeń ({allAnnouncements.length})
              </p>
              <div className="space-y-1.5">
                {allAnnouncements.map((item) => {
                  const isActive = item.id === activeNews.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onActiveNewsChange(item.id)}
                      className={cn(
                        "w-full cursor-pointer rounded-xl p-3 text-left transition-all",
                        isActive
                          ? "bg-white shadow-sm dark:bg-[#131A2E]"
                          : "bg-[#F8F9FA]/40 dark:bg-transparent dark:hover:bg-gray-900/40",
                      )}
                    >
                      <span className="mb-1 flex flex-wrap items-center gap-1.5">
                        <span
                          className={cn(
                            "rounded px-1 text-[8px] font-bold text-white",
                            newsToneClass(item),
                          )}
                        >
                          {getNewsShortBadge(item)}
                        </span>
                        <span className="font-mono text-[8px] text-gray-400">{item.date}</span>
                      </span>
                      <span
                        className={cn(
                          "line-clamp-2 text-[11px] font-extrabold leading-snug",
                          isActive ? "text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-400",
                        )}
                      >
                        {item.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
