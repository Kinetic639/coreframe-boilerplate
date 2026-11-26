"use client";

import { useState, useTransition } from "react";
import { Check, LogOut, Monitor, Moon, Palette, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@repo/ui/dropdown-menu";
import { signOutAction } from "@/app/actions/auth";
import { saveUiThemeAction } from "@/app/actions/ui";
import { cn } from "@/lib/utils";
import { applyUiTheme, COLOR_THEMES, type ThemeMode, type UiTheme } from "@/lib/ui-theme";

const MODE_ICON = { light: Sun, dark: Moon, system: Monitor } as const;

/**
 * Account menu: who is signed in, light/dark mode and the Ambra color theme (saved to the
 * account, so Ambra and the portal match), sign out.
 */
export function UserMenu({
  displayName,
  email,
  initials,
  avatarUrl,
  theme: saved,
}: {
  displayName: string;
  email: string;
  initials: string;
  avatarUrl: string | null;
  theme: UiTheme;
}) {
  const t = useTranslations();
  const [theme, setTheme] = useState(saved);
  const [, startTransition] = useTransition();

  const change = (patch: Partial<UiTheme>) => {
    const next = { ...theme, ...patch };
    setTheme(next);
    applyUiTheme(next);
    startTransition(async () => {
      const res = await saveUiThemeAction({ mode: patch.mode, colorTheme: patch.colorTheme });
      if (!res.ok) toast.error(t("portal.theme.saveFailed"));
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("portal.account", { name: displayName })}
        className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-xs font-semibold text-primary outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          initials
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate text-sm font-semibold">{displayName}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5">
          <p className="pb-1.5 text-xs font-medium text-muted-foreground">
            {t("portal.theme.mode")}
          </p>
          <div role="radiogroup" className="grid grid-cols-3 gap-1 rounded-md bg-muted p-1">
            {(["light", "dark", "system"] as ThemeMode[]).map((mode) => {
              const Icon = MODE_ICON[mode];
              const active = theme.mode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => change({ mode })}
                  className={cn(
                    "flex h-8 items-center justify-center gap-1.5 rounded-sm text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t(`portal.theme.${mode}`)}
                </button>
              );
            })}
          </div>
        </div>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2">
            <Palette className="h-4 w-4" />
            <span className="flex-1">{t("portal.theme.colors")}</span>
            <Swatch colors={COLOR_THEMES.find((c) => c.name === theme.colorTheme)!.colors} />
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-[min(420px,70vh)] w-52 overflow-y-auto">
            {COLOR_THEMES.map((c) => (
              <DropdownMenuItem
                key={c.name}
                onSelect={(e) => {
                  e.preventDefault();
                  change({ colorTheme: c.name });
                }}
                className="gap-2"
              >
                <Swatch colors={c.colors} />
                <span className="flex-1">{c.label}</span>
                {theme.colorTheme === c.name && <Check className="h-4 w-4" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOutAction()} className="gap-2">
          <LogOut className="h-4 w-4" />
          {t("auth.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Swatch({ colors }: { colors: readonly string[] }) {
  return (
    <span
      aria-hidden
      className="grid h-4 w-4 shrink-0 grid-cols-2 overflow-hidden rounded-full ring-1 ring-border"
    >
      {colors.map((c, i) => (
        <span key={i} style={{ background: c }} />
      ))}
    </span>
  );
}
