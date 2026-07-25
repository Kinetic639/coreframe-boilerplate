"use client";

import * as React from "react";
import { Globe, LogOut, Moon, Sun, User, Wifi, WifiOff } from "lucide-react";
import { useTheme } from "next-themes";
import type { VmiPortalUserDto } from "@/lib/vmi-portal/types";
import { cn } from "@/utils/cn";

interface SettingsExperienceProps {
  user: VmiPortalUserDto;
}

type NotificationItem = {
  id: string;
  title: string;
  content: string;
  date: string;
  isRead: boolean;
};

const defaultNotifications: NotificationItem[] = [
  {
    id: "notif-001",
    title: "Nowa propozycja uzupełnienia VMI",
    content: "AutoParts Pro przesłał propozycję PROP-VMI-2026-001 dla oddziału Komorniki.",
    date: "2026-07-20",
    isRead: false,
  },
  {
    id: "notif-002",
    title: "Wiadomość od CleanChem",
    content: "Karolina Nowak zasugerowała korektę progów minimalnych dla rękawic GripPro XL.",
    date: "2026-07-20",
    isRead: false,
  },
  {
    id: "notif-003",
    title: "Szkic inwentaryzacji zapisany lokalnie",
    content: "Niedokończone spisy możesz zsynchronizować po powrocie do trybu online.",
    date: "2026-07-19",
    isRead: true,
  },
];

export function SettingsExperience({ user }: SettingsExperienceProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [isOnline, setIsOnline] = React.useState(true);
  const [notifications, setNotifications] = React.useState(defaultNotifications);
  const [offlineDraftsCount, setOfflineDraftsCount] = React.useState(0);

  const currentTheme = mounted ? theme === "system" ? resolvedTheme : theme : "light";
  const unreadNotificationsCount = notifications.filter((notification) => !notification.isRead).length;

  React.useEffect(() => {
    setMounted(true);
    refreshDraftCount();
  }, []);

  const refreshDraftCount = () => {
    if (typeof window === "undefined") return;
    let count = 0;
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith("vmi_draft_")) count += 1;
    }
    setOfflineDraftsCount(count);
  };

  const syncOfflineDrafts = () => {
    if (!isOnline) return;
    const keys: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith("vmi_draft_")) keys.push(key);
    }
    for (const key of keys) window.localStorage.removeItem(key);
    setOfflineDraftsCount(0);
    setNotifications((current) => [
      {
        id: `notif-sync-${Date.now()}`,
        title: "Zsynchronizowano szkice",
        content: `Wysłano ${keys.length} lokalnych spisów do systemu VMI.`,
        date: new Date().toLocaleDateString("pl-PL"),
        isRead: false,
      },
      ...current,
    ]);
  };

  const clearDemoCache = () => {
    const preservedTheme = window.localStorage.getItem("theme");
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith("vmi_") || key.startsWith("ambra-marketplace-")) {
        window.localStorage.removeItem(key);
      }
    }
    if (preservedTheme) window.localStorage.setItem("theme", preservedTheme);
    refreshDraftCount();
    setNotifications(defaultNotifications);
  };

  return (
    <section className="space-y-6 text-xs text-gray-600 dark:text-gray-300">
      <div className="pb-2">
        <h1 className="font-display text-base font-bold text-gray-950 dark:text-white">
          Ustawienia Systemowe i Piaskownica
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Konfiguracja profilu, symulacja warunków sieciowych oraz historia powiadomień
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-4">
          <div className="space-y-3.5 rounded-xl bg-white p-5 shadow-sm dark:bg-[#0E1321]">
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-gray-950 dark:text-white">
              Twój Profil Klienta
            </h2>
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-blue-600/10 p-3 text-blue-500 dark:text-blue-400">
                <User className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-950 dark:text-white">{user.name}</h3>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">{user.organization}</p>
              </div>
            </div>

            <div className="space-y-1.5 pt-3 text-[11px]">
              <ProfileRow label="Rola w oddziale:" value={user.role} tone="blue" />
              <ProfileRow label="Uprawnienia:" value="Zatwierdzający B2B" tone="emerald" />
              <ProfileRow label="Klucz szyfrowania:" value="AMBRA-7821-X" mono />
            </div>
          </div>

          <div className="space-y-3 rounded-xl bg-white p-5 text-xs shadow-sm dark:bg-[#0E1321]">
            <h2 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-950 dark:text-white">
              {currentTheme === "light" ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-blue-400" />}
              Motyw graficzny (Wygląd)
            </h2>
            <p className="text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
              Dopasuj jasność interfejsu do warunków pracy w Twoim warsztacie lub biurze:
            </p>
            <div className="flex gap-2 pt-1">
              <ThemeButton active={currentTheme === "light"} onClick={() => setTheme("light")} icon={Sun}>
                Jasny motyw
              </ThemeButton>
              <ThemeButton active={currentTheme === "dark"} onClick={() => setTheme("dark")} icon={Moon}>
                Ciemny motyw
              </ThemeButton>
            </div>
          </div>

          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-50 py-3 text-center font-bold text-red-600 transition-colors hover:bg-red-100 hover:text-red-700 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-950/40 dark:hover:text-red-300"
          >
            <LogOut className="h-4 w-4" />
            Wyloguj się z sesji VMI
          </button>
        </div>

        <div className="space-y-4 lg:col-span-8">
          <div className="space-y-3 rounded-xl bg-white p-5 shadow-sm dark:bg-[#0E1321]">
            <h2 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-950 dark:text-white">
              <Globe className="h-4 w-4 text-[#2A3B4C] dark:text-blue-400" />
              Tryb deweloperski (VMI Sandbox)
            </h2>

            <p className="text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
              Zasymuluj brak sieci komórkowej, aby przetestować lokalny bufor inwentaryzacji offline i automatyczną ponowną synchronizację:
            </p>

            <div className="flex flex-col gap-2 pt-1 sm:flex-row">
              <NetworkButton active={isOnline} onClick={() => setIsOnline(true)} icon={Wifi} tone="emerald">
                Sieć aktywna (Online)
              </NetworkButton>
              <NetworkButton active={!isOnline} onClick={() => setIsOnline(false)} icon={WifiOff} tone="amber">
                Brak sieci (Offline)
              </NetworkButton>
            </div>

            {offlineDraftsCount > 0 ? (
              <div className="space-y-2 rounded-xl bg-amber-50 p-3 text-amber-700 dark:bg-amber-950/15 dark:text-amber-300">
                <p className="text-[10px] font-semibold">
                  Masz {offlineDraftsCount} spisów oczekujących na wysyłkę.
                </p>
                <button
                  type="button"
                  onClick={syncOfflineDrafts}
                  disabled={!isOnline}
                  className="w-full rounded bg-amber-500 py-1.5 text-[10px] font-bold text-gray-950 hover:bg-amber-400 disabled:opacity-40"
                >
                  Synchronizuj teraz
                </button>
              </div>
            ) : null}

            <button
              type="button"
              onClick={clearDemoCache}
              className="w-full rounded-lg bg-gray-100 py-2.5 text-center text-[10px] font-bold text-gray-500 transition-all hover:bg-gray-200 hover:text-gray-800 dark:bg-gray-850 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
            >
              Resetuj całe demo (Wyczyść Cache i przeładuj)
            </button>
          </div>

          <div className="space-y-3.5 rounded-xl bg-white p-5 shadow-sm dark:bg-[#0E1321]">
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-bold uppercase tracking-wider text-gray-950 dark:text-white">
                Archiwum Powiadomień Systemowych ({unreadNotificationsCount})
              </h2>
              {unreadNotificationsCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setNotifications((current) => current.map((notification) => ({ ...notification, isRead: true })))}
                  className="text-[10px] font-bold text-blue-600 hover:underline dark:text-blue-400"
                >
                  Oznacz wszystkie jako przeczytane
                </button>
              ) : null}
            </div>

            <div className="max-h-56 space-y-2 divide-y divide-gray-100 overflow-y-auto pr-1 dark:divide-gray-850/60">
              {notifications.length === 0 ? (
                <p className="py-4 text-center italic text-gray-400">Brak nowych powiadomień w historii.</p>
              ) : (
                notifications.map((notification) => (
                  <div key={notification.id} className="space-y-0.5 pt-2.5 first:pt-0">
                    <div className="flex items-center justify-between">
                      <p className={cn("text-xs font-bold", !notification.isRead ? "text-blue-600 dark:text-blue-400" : "text-gray-700 dark:text-gray-300")}>
                        {notification.title}
                      </p>
                      <span className="font-mono text-[9px] text-gray-400">{notification.date}</span>
                    </div>
                    <p className="text-[10px] leading-normal text-gray-500 dark:text-gray-400">{notification.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProfileRow({
  label,
  value,
  tone,
  mono,
}: {
  label: string;
  value: string;
  tone?: "blue" | "emerald";
  mono?: boolean;
}) {
  return (
    <p className="flex justify-between gap-3">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span
        className={cn(
          "text-right font-bold",
          tone === "blue" && "text-blue-600 dark:text-blue-400",
          tone === "emerald" && "text-emerald-600 dark:text-emerald-400",
          mono && "font-mono text-gray-500 dark:text-gray-600",
        )}
      >
        {value}
      </span>
    </p>
  );
}

function ThemeButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Sun;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-center font-bold transition-all",
        active
          ? "bg-[#2A3B4C] text-white shadow-sm dark:bg-blue-600"
          : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-850 dark:hover:bg-gray-800",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}

function NetworkButton({
  active,
  onClick,
  icon: Icon,
  tone,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Wifi;
  tone: "emerald" | "amber";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-center font-bold transition-all",
        active
          ? tone === "emerald"
            ? "bg-emerald-600 text-white shadow-sm"
            : "bg-amber-600 text-white shadow-sm"
          : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-850",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}
