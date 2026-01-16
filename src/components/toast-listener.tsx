"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "react-toastify";
import { TOASTS } from "@/lib/toasts";

export function ToastListener() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const key = searchParams.get("toast");
    if (!key || !(key in TOASTS)) return;

    const { type, message } = TOASTS[key as keyof typeof TOASTS];

    toast[type](message);

    // Remove param so it doesn't show again on refresh
    const params = new URLSearchParams(searchParams.toString());
    params.delete("toast");

    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
    router.replace(newUrl, { scroll: false });
  }, [searchParams, router]);

  return null;
}
