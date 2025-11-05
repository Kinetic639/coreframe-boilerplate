"use client";

// =============================================
// Contact Form - Basic Info Tab
// =============================================

import { UseFormReturn } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ContactFormData, ContactType, EntityType, SALUTATIONS, LANGUAGES } from "../../types";
import { useTranslations } from "next-intl";

interface BasicInfoTabProps {
  form: UseFormReturn<ContactFormData>;
  contactType: ContactType;
}

export function ContactBasicInfoTab({ form }: BasicInfoTabProps) {
  const t = useTranslations("contacts.form");
  const { register, watch, setValue } = form;

  const entityType = watch("entity_type");

  const handleEntityTypeChange = (value: EntityType) => {
    setValue("entity_type", value);
    // Clear fields based on entity type
    if (value === "business") {
      setValue("salutation", null);
      setValue("first_name", "");
      setValue("last_name", "");
    } else {
      setValue("company_name", "");
    }
  };

  return (
    <div className="space-y-6">
      {/* Customer Type Toggle */}
      <div className="space-y-2">
        <Label>{t("fields.customerType")}</Label>
        <RadioGroup
          value={entityType}
          onValueChange={handleEntityTypeChange}
          className="flex gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="business" id="business" />
            <Label htmlFor="business" className="font-normal cursor-pointer">
              {t("entityTypes.business")}
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="individual" id="individual" />
            <Label htmlFor="individual" className="font-normal cursor-pointer">
              {t("entityTypes.individual")}
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Primary Contact - Individual */}
      {entityType === "individual" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="salutation">{t("fields.salutation")}</Label>
            <Select
              value={watch("salutation") || undefined}
              onValueChange={(value) => setValue("salutation", value as any)}
            >
              <SelectTrigger id="salutation">
                <SelectValue placeholder={t("placeholders.salutation")} />
              </SelectTrigger>
              <SelectContent>
                {SALUTATIONS.map((sal) => (
                  <SelectItem key={sal.value} value={sal.value}>
                    {sal.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="first_name">
              {t("fields.firstName")} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="first_name"
              {...register("first_name", { required: entityType === "individual" })}
              placeholder={t("placeholders.firstName")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="last_name">
              {t("fields.lastName")} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="last_name"
              {...register("last_name", { required: entityType === "individual" })}
              placeholder={t("placeholders.lastName")}
            />
          </div>
        </div>
      )}

      {/* Company Name - Business */}
      {entityType === "business" && (
        <div className="space-y-2">
          <Label htmlFor="company_name">
            {t("fields.companyName")} <span className="text-red-500">*</span>
          </Label>
          <Input
            id="company_name"
            {...register("company_name", { required: entityType === "business" })}
            placeholder={t("placeholders.companyName")}
          />
        </div>
      )}

      {/* Display Name */}
      <div className="space-y-2">
        <Label htmlFor="display_name">
          {t("fields.displayName")} <span className="text-red-500">*</span>
        </Label>
        <Input
          id="display_name"
          {...register("display_name", { required: true })}
          placeholder={t("placeholders.displayName")}
        />
        <p className="text-sm text-muted-foreground">{t("fields.displayNameHelp")}</p>
      </div>

      {/* Contact Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="primary_email">{t("fields.primaryEmail")}</Label>
          <Input
            id="primary_email"
            type="email"
            {...register("primary_email")}
            placeholder={t("placeholders.email")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="work_phone">{t("fields.workPhone")}</Label>
          <Input
            id="work_phone"
            {...register("work_phone")}
            placeholder={t("placeholders.phone")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="mobile_phone">{t("fields.mobilePhone")}</Label>
          <Input
            id="mobile_phone"
            {...register("mobile_phone")}
            placeholder={t("placeholders.phone")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="website">{t("fields.website")}</Label>
          <Input
            id="website"
            type="url"
            {...register("website")}
            placeholder={t("placeholders.website")}
          />
        </div>
      </div>

      {/* Language */}
      <div className="space-y-2">
        <Label htmlFor="language_code">{t("fields.language")}</Label>
        <Select
          value={watch("language_code") || "en"}
          onValueChange={(value) => setValue("language_code", value)}
        >
          <SelectTrigger id="language_code">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((lang) => (
              <SelectItem key={lang.value} value={lang.value}>
                {lang.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
