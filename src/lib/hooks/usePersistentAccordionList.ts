"use client";

import { useEffect, useState } from "react";

export function usePersistentAccordionList(key: string) {
  const storageKey = `accordion_state_${key}`;
  const [open, setOpen] = useState<string[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        setOpen(JSON.parse(stored));
      } catch {
        setOpen([]);
      }
    }
  }, [key]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(open));
  }, [open]);

  return [open, setOpen] as const;
}
