"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import NProgress from "nprogress";

export function NProgressProvider() {
  const pathname = usePathname();

  useEffect(() => {
    NProgress.start();
    const timeout = setTimeout(() => NProgress.done(), 400); // fallback

    return () => {
      clearTimeout(timeout);
      NProgress.done();
    };
  }, [pathname]);

  return null;
}
