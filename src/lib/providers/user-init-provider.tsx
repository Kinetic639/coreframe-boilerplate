"use client";

import { useEffect } from "react";
import { useUserStore } from "@/lib/stores/user-store";
import { loadUserContextServer } from "@/lib/api/load-user-context-server";

export function UserInitProvider({
  context,
  children,
}: {
  context: Awaited<ReturnType<typeof loadUserContextServer>>;
  children: React.ReactNode;
}) {
  const setContext = useUserStore((s) => s.setContext);
  useEffect(() => {
    if (context) setContext(context);
  }, [context, setContext]);
  useEffect(() => {
    if (context) {
      setContext(context);
    }
  }, [context, setContext]);

  return <>{children}</>;
}
