"use client";

import { useSearchParams } from "next/navigation";
import { WYSIWYGLabelCreator } from "@/modules/warehouse/components/labels/WYSIWYGLabelCreator";

export default function Page() {
  const searchParams = useSearchParams();
  const templateId = searchParams.get("templateId");

  return <WYSIWYGLabelCreator templateId={templateId || undefined} />;
}
