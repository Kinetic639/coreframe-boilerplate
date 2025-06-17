"use client";

import { useEffect, useState } from "react";

export function usePersistentAccordionState(id: string, defaultOpen = false) {
  const key = `sidebar_menu_${id}`;
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    const stored = localStorage.getItem(key);
    if (stored !== null) {
      setOpen(stored === "true");
    } else {
      setOpen(defaultOpen);
    }
  }, [id]);

  useEffect(() => {
    localStorage.setItem(key, String(open));
  }, [open]);

  return [open, setOpen] as const;
}
