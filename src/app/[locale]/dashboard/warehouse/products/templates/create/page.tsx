"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { TemplateBuilder } from "@/modules/warehouse/components/templates/TemplateBuilder";

export default function CreateTemplatePage() {
  const router = useRouter();

  const handleSave = (_template: any) => {
    router.push("/dashboard/warehouse/products/templates");
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <div className="container mx-auto p-6">
      <TemplateBuilder mode="create" onSave={handleSave} onCancel={handleCancel} />
    </div>
  );
}
