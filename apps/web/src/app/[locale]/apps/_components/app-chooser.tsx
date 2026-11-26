"use client";

import { useState, useTransition } from "react";
import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import type { AmbraWorkApp } from "@repo/app-urls";
import { AMBRA_APP_LOOK } from "@repo/ui/app-switcher";
import { BrandLogoMarkHover } from "@repo/ui/branding";
import { signOutAction } from "@/app/[locale]/actions";
import { cn } from "@/lib/utils";
import { setOpenLastAppAction } from "../actions";
import { GreetingBackdrop } from "./greeting-backdrop";

export type AppChooserProps = {
  apps: { id: AmbraWorkApp; href: string }[];
  lastApp: AmbraWorkApp | null;
  openLast: boolean;
  firstName: string | null;
  email: string;
  organizationName: string | null;
  /** e.g. "Czwartek, 26 listopada", formatted on the server in Europe/Warsaw. */
  dateLabel: string;
  evening: boolean;
};

/** White "Ambra / SYSTEM" lockup for the dark panel; the mark animates on hover as on the site. */
function DarkLockup() {
  return (
    <div className="flex items-center gap-2.5 lg:gap-3">
      <BrandLogoMarkHover size="md" className="h-8 w-8 lg:h-10 lg:w-10" />
      <span className="flex flex-col leading-none">
        <span className="text-[22px] font-semibold tracking-[0.025em] text-white lg:text-[26px]">
          <span className="sr-only">Ambra</span>
          <span aria-hidden="true">
            <span className="text-amber-500">A</span>mbra
          </span>
        </span>
        <span className="-mt-px text-[8px] font-semibold uppercase tracking-[0.3em] text-stone-400 lg:-mt-0.5 lg:text-[9px]">
          System
        </span>
      </span>
    </div>
  );
}

export function AppChooser({
  apps,
  lastApp,
  openLast,
  firstName,
  email,
  organizationName,
  dateLabel,
  evening,
}: AppChooserProps) {
  const t = useTranslations("ambraApps");
  const [openLastChecked, setOpenLastChecked] = useState(openLast);
  const [, startTransition] = useTransition();

  const onOpenLastChange = (checked: boolean) => {
    setOpenLastChecked(checked);
    startTransition(async () => {
      const result = await setOpenLastAppAction(checked);
      if (!result.success) setOpenLastChecked(!checked);
    });
  };

  const greeting = (
    <div className="relative flex flex-col gap-2 lg:gap-3">
      <span className="text-[13px] font-semibold text-amber-400 lg:text-[15px]">{dateLabel}</span>
      <h1 className="m-0 text-[38px] font-extrabold leading-[1.05] tracking-[-0.02em] text-white lg:text-[64px] lg:leading-[1.02] lg:tracking-[-0.03em]">
        <span className="block text-[27px] font-bold leading-[1.15] tracking-[-0.01em] lg:text-[44px] lg:leading-[1.1] lg:tracking-[-0.02em]">
          {evening ? t("chooser.goodEvening") : t("chooser.goodMorning")}
        </span>
        {firstName ?? email}
      </h1>
      {organizationName ? (
        <p className="m-0 mt-0.5 text-[15px] font-semibold text-stone-200 lg:mt-1 lg:text-xl">
          {organizationName}
        </p>
      ) : null}
      <div className="text-[13px] text-stone-400 lg:text-sm">
        {email} ·{" "}
        <form action={signOutAction} className="inline">
          <button
            type="submit"
            className="cursor-pointer font-semibold text-amber-400 underline underline-offset-2 hover:text-amber-300"
          >
            {t("chooser.signOut")}
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh flex-col bg-white text-neutral-800 lg:items-center lg:justify-center lg:bg-gray-50 lg:p-8">
      <div className="flex flex-1 flex-col lg:grid lg:h-[600px] lg:w-full lg:max-w-[1040px] lg:flex-none lg:grid-cols-[460px_minmax(0,1fr)] lg:overflow-hidden lg:rounded-[14px] lg:border lg:border-gray-200 lg:bg-white lg:shadow-sm">
        {/* Greeting: a dark band on top on phones, the right-hand panel on wide screens */}
        <section className="relative flex min-h-[310px] shrink-0 flex-col justify-between gap-6 overflow-hidden bg-stone-900 px-5 py-6 text-white lg:order-2 lg:min-h-0 lg:px-12 lg:pb-12 lg:pt-10">
          <div className="absolute inset-0 lg:hidden">
            <GreetingBackdrop variant="band" />
          </div>
          <div className="absolute inset-0 hidden lg:block">
            <GreetingBackdrop variant="panel" />
          </div>
          <div className="relative">
            <DarkLockup />
          </div>
          {greeting}
        </section>

        {/* The choice */}
        <section className="flex flex-1 flex-col gap-4 p-5 lg:order-1 lg:justify-center lg:gap-7 lg:p-9">
          <h2 className="m-0 mt-1 text-[19px] font-bold leading-[1.3] tracking-[-0.01em] lg:mt-0 lg:-mb-2.5 lg:text-[22px]">
            {t("chooser.heading")}
          </h2>
          <ul className="m-0 flex list-none flex-col overflow-hidden rounded-[10px] border border-gray-200 p-0 lg:rounded-lg">
            {apps.map((app) => {
              const look = AMBRA_APP_LOOK[app.id];
              const Icon = look.icon;
              const isLast = app.id === lastApp;
              return (
                <li key={app.id} className="border-b border-gray-200 last:border-b-0">
                  <a
                    href={app.href}
                    className={cn(
                      "flex min-h-[68px] items-center gap-3.5 px-4 text-neutral-800 no-underline transition-colors hover:bg-amber-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500 lg:min-h-0 lg:py-3.5",
                      isLast && "bg-amber-50"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                        look.tile
                      )}
                    >
                      <Icon className="h-[22px] w-[22px]" strokeWidth={1.8} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-base font-semibold lg:text-[15px]">
                        {t(`names.${app.id}`)}
                        {isLast ? (
                          <span className="ml-1.5 hidden rounded-full bg-amber-200 px-[7px] py-0.5 text-[11px] font-semibold text-amber-900 lg:inline">
                            {t("chooser.lastUsed")}
                          </span>
                        ) : null}
                      </span>
                      {isLast ? (
                        <span className="text-[13px] text-amber-900 lg:hidden">
                          {t("chooser.lastUsedMobile")}
                        </span>
                      ) : null}
                      <span
                        className={cn("text-[13px] text-gray-600", isLast && "hidden lg:inline")}
                      >
                        {t(`descriptions.${app.id}`)}
                      </span>
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-gray-500 lg:h-[18px] lg:w-[18px]" />
                  </a>
                </li>
              );
            })}
          </ul>
          <label className="flex cursor-pointer items-start gap-2.5 text-sm leading-[1.45] text-gray-700 lg:items-center lg:gap-2 lg:text-[13px]">
            <input
              type="checkbox"
              checked={openLastChecked}
              onChange={(event) => onOpenLastChange(event.target.checked)}
              className="mt-px h-[18px] w-[18px] shrink-0 accent-amber-700 lg:mt-0 lg:h-4 lg:w-4"
            />
            {t("chooser.openLast")}
          </label>
        </section>
      </div>
    </div>
  );
}
