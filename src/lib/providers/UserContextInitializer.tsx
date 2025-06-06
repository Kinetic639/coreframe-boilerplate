"use client";

import { useUserStore } from "@/lib/stores/user-store";
import { useEffect } from "react";

export function UserContextInitializer({ context }: { context: any }) {
  const setContext = useUserStore((s) => s.setContext);

  useEffect(() => {
    if (context) setContext(context);
  }, [context, setContext]);

  return null;
}
