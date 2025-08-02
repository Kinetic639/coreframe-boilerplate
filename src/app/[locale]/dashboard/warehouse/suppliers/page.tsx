"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SuppliersPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/warehouse/suppliers/list");
  }, [router]);

  return null;
}
