"use client";

// =============================================
// Contact Form - Remarks Tab
// =============================================

import { UseFormReturn } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ContactFormData } from "../../types";
import { useTranslations } from "next-intl";

interface RemarksTabProps {
  form: UseFormReturn<ContactFormData>;
}

export function ContactRemarksTab({ form }: RemarksTabProps) {
  const t = useTranslations("contacts.form");
  const { register } = form;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="notes">{t("fields.internalNotes")}</Label>
        <Textarea
          id="notes"
          {...register("notes")}
          placeholder={t("placeholders.notes")}
          rows={10}
          className="resize-none"
        />
        <p className="text-sm text-muted-foreground">{t("fields.internalNotesHelp")}</p>
      </div>
    </div>
  );
}
