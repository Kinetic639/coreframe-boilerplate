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
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ContactFormData, ContactType, SALUTATIONS } from "../../types";
import { TagsInput } from "../tags-input";
import { useTranslations } from "next-intl";
import { Lock, Users, Info } from "lucide-react";

interface BasicInfoTabProps {
  form: UseFormReturn<ContactFormData>;
  contactType: ContactType;
  isEditMode?: boolean;
}

export function ContactBasicInfoTab({ form, isEditMode = false }: BasicInfoTabProps) {
  const t = useTranslations("contacts.form");
  const tScopes = useTranslations("contacts.scopes");
  const { register, watch, setValue } = form;

  const isOrganizationScope = watch("visibility_scope") === "organization";

  const handleVisibilityToggle = (checked: boolean) => {
    // In edit mode with organization scope, prevent changing back to private
    if (isEditMode && isOrganizationScope && !checked) {
      return;
    }

    // In create mode or when promoting private to organization, allow toggle
    setValue("visibility_scope", checked ? "organization" : "private");
  };

  return (
    <div className="space-y-6">
      {/* Visibility Scope Toggle */}
      <div className="space-y-3">
        <Label>
          {t("fields.contactVisibility")} <span className="text-red-500">*</span>
        </Label>

        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-start gap-3 flex-1">
            {isOrganizationScope ? (
              <Users className="h-5 w-5 text-primary mt-0.5" />
            ) : (
              <Lock className="h-5 w-5 text-muted-foreground mt-0.5" />
            )}
            <div className="flex-1">
              <div className="font-medium">
                {isOrganizationScope ? tScopes("organization") : tScopes("private")}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {isOrganizationScope
                  ? t("fields.organizationVisibilityDesc")
                  : t("fields.privateVisibilityDesc")}
              </div>
            </div>
          </div>
          <Switch
            checked={isOrganizationScope}
            onCheckedChange={handleVisibilityToggle}
            disabled={isEditMode && isOrganizationScope} // In edit mode, can't switch back from organization to private
          />
        </div>

        {isEditMode && isOrganizationScope && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>{t("fields.organizationVisibilityLocked")}</AlertDescription>
          </Alert>
        )}

        {!isEditMode && isOrganizationScope && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>{t("fields.organizationVisibilityInfo")}</AlertDescription>
          </Alert>
        )}

        {!isOrganizationScope && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>{t("fields.privateVisibilityInfo")}</AlertDescription>
          </Alert>
        )}
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
