"use client";

// =============================================
// Contact Form - Custom Fields Tab
// =============================================

import { UseFormReturn } from "react-hook-form";
import { ContactFormData } from "../../types";
import { useTranslations } from "next-intl";

interface CustomFieldsTabProps {
  form: UseFormReturn<ContactFormData>;
}

export function ContactCustomFieldsTab(_props: CustomFieldsTabProps) {
  const t = useTranslations("contacts.form");

  // TODO: Load custom field definitions from database
  // For now, we'll show a placeholder message

  return (
    <div className="space-y-4">
      <div className="text-center py-8">
        <p className="text-muted-foreground">{t("messages.customFieldsPlaceholder")}</p>
        <p className="text-sm text-muted-foreground mt-2">{t("messages.customFieldsInfo")}</p>
      </div>
    </div>
  );
}
