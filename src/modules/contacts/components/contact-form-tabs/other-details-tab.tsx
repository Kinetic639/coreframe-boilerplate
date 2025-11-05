"use client";

// =============================================
// Contact Form - Other Details Tab
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
import { Checkbox } from "@/components/ui/checkbox";
import { ContactFormData, CURRENCIES, PAYMENT_TERMS } from "../../types";
import { useTranslations } from "next-intl";

interface OtherDetailsTabProps {
  form: UseFormReturn<ContactFormData>;
}

export function ContactOtherDetailsTab({ form }: OtherDetailsTabProps) {
  const t = useTranslations("contacts.form");
  const { register, watch, setValue } = form;

  return (
    <div className="space-y-6">
      {/* Currency and Payment Terms */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="currency_code">{t("fields.currency")}</Label>
          <Select
            value={watch("currency_code") || "PLN"}
            onValueChange={(value) => setValue("currency_code", value)}
          >
            <SelectTrigger id="currency_code">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((currency) => (
                <SelectItem key={currency.value} value={currency.value}>
                  {currency.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="payment_terms">{t("fields.paymentTerms")}</Label>
          <Select
            value={watch("payment_terms") || undefined}
            onValueChange={(value) => setValue("payment_terms", value)}
          >
            <SelectTrigger id="payment_terms">
              <SelectValue placeholder={t("placeholders.paymentTerms")} />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_TERMS.map((term) => (
                <SelectItem key={term.value} value={term.value}>
                  {term.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tax Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="tax_registration_number">{t("fields.taxRegistrationNumber")}</Label>
          <Input
            id="tax_registration_number"
            {...register("tax_registration_number")}
            placeholder={t("placeholders.taxNumber")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="company_id_number">{t("fields.companyIdNumber")}</Label>
          <Input
            id="company_id_number"
            {...register("company_id_number")}
            placeholder={t("placeholders.companyId")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tax_rate">{t("fields.taxRate")}</Label>
          <Input
            id="tax_rate"
            type="number"
            step="0.01"
            {...register("tax_rate", { valueAsNumber: true })}
            placeholder={t("placeholders.taxRate")}
          />
        </div>

        <div className="flex items-center space-x-2 pt-8">
          <Checkbox
            id="tax_exempt"
            checked={watch("tax_exempt")}
            onCheckedChange={(checked) => setValue("tax_exempt", !!checked)}
          />
          <Label htmlFor="tax_exempt" className="font-normal cursor-pointer">
            {t("fields.taxExempt")}
          </Label>
        </div>
      </div>

      {/* Financial Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="credit_limit">{t("fields.creditLimit")}</Label>
          <Input
            id="credit_limit"
            type="number"
            step="0.01"
            {...register("credit_limit", { valueAsNumber: true })}
            placeholder={t("placeholders.creditLimit")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="opening_balance">{t("fields.openingBalance")}</Label>
          <Input
            id="opening_balance"
            type="number"
            step="0.01"
            {...register("opening_balance", { valueAsNumber: true })}
            placeholder={t("placeholders.openingBalance")}
          />
        </div>
      </div>

      {/* Portal Access */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="portal_enabled"
            checked={watch("portal_enabled")}
            onCheckedChange={(checked) => setValue("portal_enabled", !!checked)}
          />
          <Label htmlFor="portal_enabled" className="font-normal cursor-pointer">
            {t("fields.portalEnabled")}
          </Label>
        </div>

        {watch("portal_enabled") && (
          <div className="space-y-2 ml-6">
            <Label htmlFor="portal_language">{t("fields.portalLanguage")}</Label>
            <Select
              value={watch("portal_language") || "en"}
              onValueChange={(value) => setValue("portal_language", value)}
            >
              <SelectTrigger id="portal_language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="pl">Polski</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Additional Contact Info */}
      <div className="space-y-2">
        <Label htmlFor="fax">{t("fields.fax")}</Label>
        <Input id="fax" {...register("fax")} placeholder={t("placeholders.fax")} />
      </div>
    </div>
  );
}
