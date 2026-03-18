"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";

export default function SuppliersPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard-old/warehouse/suppliers/list");
  }, [router]);

  return null;
}
