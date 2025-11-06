"use client";

// =============================================
// Contact Form - Zoho-style with Tabs
// =============================================

import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContactFormData, ContactType } from "../types";
import { ContactBasicInfoTab } from "./contact-form-tabs/basic-info-tab";
import { ContactOtherDetailsTab } from "./contact-form-tabs/other-details-tab";
import { ContactAddressTab } from "./contact-form-tabs/address-tab";
import { ContactPersonsTab } from "./contact-form-tabs/contact-persons-tab";
import { ContactCustomFieldsTab } from "./contact-form-tabs/custom-fields-tab";
import { ContactRemarksTab } from "./contact-form-tabs/remarks-tab";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";

interface ContactFormProps {
  initialData?: Partial<ContactFormData>;
  contactType: ContactType;
  onSubmit: (data: ContactFormData) => Promise<void>;
  onCancel: () => void;
  isEditMode?: boolean;
}

export function ContactForm({
  initialData,
  contactType,
  onSubmit,
  onCancel,
  isEditMode = false,
}: ContactFormProps) {
  const t = useTranslations("contacts");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("basic-info");

  const form = useForm<ContactFormData>({
    defaultValues: {
      contact_type: contactType,
      entity_type: "business",
      visibility_scope: "organization",
      display_name: "",
      addresses: [],
      persons: [],
      custom_fields: {},
      tax_exempt: false,
      portal_enabled: false,
      language_code: "en",
      currency_code: "PLN",
      ...initialData,
    },
  });

  const handleSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);

    try {
      await onSubmit(data);
      toast.success(
        isEditMode ? t("form.messages.updateSuccess") : t("form.messages.createSuccess")
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("form.messages.error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <h2 className="text-2xl font-bold">
          {isEditMode
            ? t("form.editTitle", { type: t(`types.${contactType}`) })
            : t("form.newTitle", { type: t(`types.${contactType}`) })}
        </h2>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            {t("form.cancel")}
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t("form.saving") : isEditMode ? t("form.update") : t("form.save")}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="basic-info">{t("form.tabs.basicInfo")}</TabsTrigger>
          <TabsTrigger value="other-details">{t("form.tabs.otherDetails")}</TabsTrigger>
          <TabsTrigger value="address">{t("form.tabs.address")}</TabsTrigger>
          <TabsTrigger value="contact-persons">{t("form.tabs.contactPersons")}</TabsTrigger>
          <TabsTrigger value="custom-fields">{t("form.tabs.customFields")}</TabsTrigger>
          <TabsTrigger value="remarks">{t("form.tabs.remarks")}</TabsTrigger>
        </TabsList>

        <TabsContent value="basic-info" className="space-y-4 mt-6">
          <ContactBasicInfoTab form={form} contactType={contactType} />
        </TabsContent>

        <TabsContent value="other-details" className="space-y-4 mt-6">
          <ContactOtherDetailsTab form={form} />
        </TabsContent>

        <TabsContent value="address" className="space-y-4 mt-6">
          <ContactAddressTab form={form} />
        </TabsContent>

        <TabsContent value="contact-persons" className="space-y-4 mt-6">
          <ContactPersonsTab form={form} />
        </TabsContent>

        <TabsContent value="custom-fields" className="space-y-4 mt-6">
          <ContactCustomFieldsTab form={form} />
        </TabsContent>

        <TabsContent value="remarks" className="space-y-4 mt-6">
          <ContactRemarksTab form={form} />
        </TabsContent>
      </Tabs>
    </form>
  );
}
