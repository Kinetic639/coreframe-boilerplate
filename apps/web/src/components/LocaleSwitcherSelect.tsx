"use client";

import clsx from "clsx";
import { ChangeEvent, ReactNode, useState } from "react";
import { useLocaleSwitch } from "@/i18n/use-locale-switch";

type Props = {
  children: ReactNode;
  defaultValue: string;
  label: string;
};

export default function LocaleSwitcherSelect({ children, defaultValue, label }: Props) {
  const switchLocale = useLocaleSwitch();
  const [isPending, setIsPending] = useState(false);

  function onSelectChange(event: ChangeEvent<HTMLSelectElement>) {
    setIsPending(true);
    switchLocale(event.target.value);
  }

  return (
    <label
      className={clsx(
        "relative text-gray-600",
        isPending && "transition-opacity [&:disabled]:opacity-30"
      )}
    >
      <p className="sr-only">{label}</p>
      <select
        className="inline-flex cursor-pointer appearance-none rounded-md bg-transparent py-2 pl-2 pr-8 transition-colors hover:text-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
        defaultValue={defaultValue}
        disabled={isPending}
        onChange={onSelectChange}
      >
        {children}
      </select>
      <span className="pointer-events-none absolute right-2 top-[8px]">⌄</span>
    </label>
  );
}
