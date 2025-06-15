"use client";

import { useEffect } from "react";
import { useUserStore } from "@/lib/stores/user-store";

export function UserInitProvider({
  context,
  children,
}: {
  context: any;
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
