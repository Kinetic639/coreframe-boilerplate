"use client";

// =============================================
// Contact Form - Basic Info Tab (Simplified)
// All contacts are people - no entity type selector
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
import { ContactFormData, ContactType, SALUTATIONS, VisibilityScope } from "../../types";
import { TagsInput } from "../tags-input";
import { useTranslations } from "next-intl";

interface BasicInfoTabProps {
  form: UseFormReturn<ContactFormData>;
  contactType: ContactType;
}

export function ContactBasicInfoTab({ form }: BasicInfoTabProps) {
  const t = useTranslations("contacts.form");
  const tScopes = useTranslations("contacts.visibilityScopes");
  const { register, watch, setValue } = form;

  const visibilityScopes: { value: VisibilityScope; label: string; description: string }[] = [
    {
      value: "private",
      label: tScopes("private"),
      description: tScopes("privateDesc"),
    },
    {
      value: "branch",
      label: tScopes("branch"),
      description: tScopes("branchDesc"),
    },
    {
      value: "organization",
      label: tScopes("organization"),
      description: tScopes("organizationDesc"),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Visibility Scope */}
      <div className="space-y-2">
        <Label htmlFor="visibility_scope">
          {t("fields.visibilityScope")} <span className="text-red-500">*</span>
        </Label>
        <Select
          value={watch("visibility_scope")}
          onValueChange={(value) => setValue("visibility_scope", value as VisibilityScope)}
        >
          <SelectTrigger id="visibility_scope">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {visibilityScopes.map((scope) => (
              <SelectItem key={scope.value} value={scope.value}>
                <div className="flex flex-col">
                  <span className="font-medium">{scope.label}</span>
                  <span className="text-xs text-muted-foreground">{scope.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">{t("fields.visibilityScopeHelp")}</p>
      </div>

      {/* Person Fields - All contacts are people */}
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
                  {t(sal.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="first_name">{t("fields.firstName")}</Label>
          <Input
            id="first_name"
            {...register("first_name")}
            placeholder={t("placeholders.firstName")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="last_name">{t("fields.lastName")}</Label>
          <Input
            id="last_name"
            {...register("last_name")}
            placeholder={t("placeholders.lastName")}
          />
        </div>
      </div>

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
            placeholder={t("placeholders.primaryEmail")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="work_phone">{t("fields.workPhone")}</Label>
          <Input
            id="work_phone"
            type="tel"
            {...register("work_phone")}
            placeholder={t("placeholders.workPhone")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="mobile_phone">{t("fields.mobilePhone")}</Label>
          <Input
            id="mobile_phone"
            type="tel"
            {...register("mobile_phone")}
            placeholder={t("placeholders.mobilePhone")}
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

      {/* Tags */}
      <div className="space-y-2">
        <Label htmlFor="tags">{t("fields.tags")}</Label>
        <TagsInput
          value={watch("tags") || []}
          onChange={(tags) => setValue("tags", tags)}
          placeholder={t("placeholders.tags")}
          suggestions={["partner", "vendor-contact", "client-contact", "vip", "supplier"]}
        />
        <p className="text-sm text-muted-foreground">{t("fields.tagsHelp")}</p>
      </div>
    </div>
  );
}
