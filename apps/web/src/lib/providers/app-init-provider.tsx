"use client";

import { useEffect } from "react";
import { useAppStore, type AppContext } from "@/lib/stores/app-store";

export function AppInitProvider({
  context,
  children,
}: {
  context: AppContext;
  children: React.ReactNode;
}) {
  const setContext = useAppStore((s) => s.setContext);

  useEffect(() => {
    if (context) {
      setContext(context);
    }
  }, [context, setContext]);

  return <>{children}</>;
}
