"use client";

// =============================================
// Contact Form - Simplified for Contact Book
// 5 Tabs: Info, Addresses, Linked Accounts, Custom Fields, Notes
// =============================================

import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContactFormData, ContactType } from "../types";
import { ContactBasicInfoTab } from "./contact-form-tabs/basic-info-tab";
import { ContactAddressTab } from "./contact-form-tabs/address-tab";
import { LinkedBusinessAccountsTab } from "./contact-form-tabs/linked-business-accounts-tab";
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
      visibility_scope: "organization",
      display_name: "",
      tags: [],
      addresses: [],
      custom_fields: {},
      ...initialData,
    },
  });

  const handleSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);

    try {
      await onSubmit(data);
      toast.success(isEditMode ? t("messages.updateSuccess") : t("messages.createSuccess"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("messages.error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <h2 className="text-2xl font-bold">
          {isEditMode ? `Edit ${t(`types.${contactType}`)}` : `New ${t(`types.${contactType}`)}`}
        </h2>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            {t("actions.cancel")}
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? t("actions.saving")
              : isEditMode
                ? t("actions.update")
                : t("actions.save")}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="basic-info">{t("form.tabs.info")}</TabsTrigger>
          <TabsTrigger value="address">{t("form.tabs.address")}</TabsTrigger>
          <TabsTrigger value="linked-accounts">{t("form.tabs.linkedAccounts")}</TabsTrigger>
          <TabsTrigger value="custom-fields">{t("form.tabs.customFields")}</TabsTrigger>
          <TabsTrigger value="remarks">{t("form.tabs.notes")}</TabsTrigger>
        </TabsList>

        <TabsContent value="basic-info" className="space-y-4 mt-6">
          <ContactBasicInfoTab form={form} contactType={contactType} />
        </TabsContent>

        <TabsContent value="address" className="space-y-4 mt-6">
          <ContactAddressTab form={form} />
        </TabsContent>

        <TabsContent value="linked-accounts" className="space-y-4 mt-6">
          <LinkedBusinessAccountsTab contactId={(initialData as any)?.id} />
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
