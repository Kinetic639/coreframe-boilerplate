"use client";

import { useUserStore } from "@/lib/stores/user-store";
import { useEffect } from "react";
import { loadUserContextServer } from "@/lib/api/load-user-context-server";

export function UserContextInitializer({
  context,
}: {
  context: Awaited<ReturnType<typeof loadUserContextServer>>;
}) {
  const setContext = useUserStore((s) => s.setContext);

  useEffect(() => {
    if (context) setContext(context);
  }, [context, setContext]);

  return null;
}
