"use client";

// =============================================
// Contact Form - Address Tab
// =============================================

import { UseFormReturn } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContactFormData, ContactAddressFormData, ADDRESS_TYPES, AddressType } from "../../types";
import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";

interface AddressTabProps {
  form: UseFormReturn<ContactFormData>;
}

export function ContactAddressTab({ form }: AddressTabProps) {
  const t = useTranslations("contacts.form");
  const { watch, setValue } = form;

  const addresses = watch("addresses") || [];

  const addAddress = (type: AddressType) => {
    const newAddress: ContactAddressFormData = {
      address_type: type,
      is_default: addresses.filter((a) => a.address_type === type).length === 0,
      attention_to: "",
      country: "",
      address_line_1: "",
      address_line_2: "",
      city: "",
      state_province: "",
      postal_code: "",
      phone: "",
      fax_number: "",
    };

    setValue("addresses", [...addresses, newAddress]);
  };

  const removeAddress = (index: number) => {
    const updated = addresses.filter((_, i) => i !== index);
    setValue("addresses", updated);
  };

  const updateAddress = (index: number, field: keyof ContactAddressFormData, value: any) => {
    const updated = [...addresses];
    updated[index] = { ...updated[index], [field]: value };
    setValue("addresses", updated);
  };

  const toggleDefault = (index: number) => {
    const addressType = addresses[index].address_type;
    const updated = addresses.map((addr, i) => {
      if (addr.address_type === addressType) {
        return { ...addr, is_default: i === index };
      }
      return addr;
    });
    setValue("addresses", updated);
  };

  const billingAddresses = addresses.filter(
    (a) => a.address_type === "billing" || a.address_type === "both"
  );
  const shippingAddresses = addresses.filter(
    (a) => a.address_type === "shipping" || a.address_type === "both"
  );

  return (
    <div className="space-y-6">
      {/* Billing Address */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{t("fields.billingAddress")}</h3>
          <Button type="button" variant="outline" size="sm" onClick={() => addAddress("billing")}>
            <Plus className="h-4 w-4 mr-2" />
            {t("actions.addBillingAddress")}
          </Button>
        </div>

        {billingAddresses.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("messages.noAddresses")}</p>
        ) : (
          <div className="space-y-4">
            {addresses.map(
              (address, index) =>
                (address.address_type === "billing" || address.address_type === "both") && (
                  <Card key={index}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                      <CardTitle className="text-sm font-medium">
                        {ADDRESS_TYPES.find((t) => t.value === address.address_type)?.label}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={address.is_default}
                          onCheckedChange={() => toggleDefault(index)}
                        />
                        <Label className="text-sm font-normal">{t("fields.defaultAddress")}</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeAddress(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>{t("fields.attentionTo")}</Label>
                          <Input
                            value={address.attention_to || ""}
                            onChange={(e) => updateAddress(index, "attention_to", e.target.value)}
                            placeholder={t("placeholders.attentionTo")}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>{t("fields.country")}</Label>
                          <Input
                            value={address.country || ""}
                            onChange={(e) => updateAddress(index, "country", e.target.value)}
                            placeholder={t("placeholders.country")}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>{t("fields.addressLine1")}</Label>
                        <Input
                          value={address.address_line_1 || ""}
                          onChange={(e) => updateAddress(index, "address_line_1", e.target.value)}
                          placeholder={t("placeholders.addressLine1")}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>{t("fields.addressLine2")}</Label>
                        <Input
                          value={address.address_line_2 || ""}
                          onChange={(e) => updateAddress(index, "address_line_2", e.target.value)}
                          placeholder={t("placeholders.addressLine2")}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>{t("fields.city")}</Label>
                          <Input
                            value={address.city || ""}
                            onChange={(e) => updateAddress(index, "city", e.target.value)}
                            placeholder={t("placeholders.city")}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>{t("fields.stateProvince")}</Label>
                          <Input
                            value={address.state_province || ""}
                            onChange={(e) => updateAddress(index, "state_province", e.target.value)}
                            placeholder={t("placeholders.stateProvince")}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>{t("fields.postalCode")}</Label>
                          <Input
                            value={address.postal_code || ""}
                            onChange={(e) => updateAddress(index, "postal_code", e.target.value)}
                            placeholder={t("placeholders.postalCode")}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>{t("fields.phone")}</Label>
                          <Input
                            value={address.phone || ""}
                            onChange={(e) => updateAddress(index, "phone", e.target.value)}
                            placeholder={t("placeholders.phone")}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>{t("fields.fax")}</Label>
                          <Input
                            value={address.fax_number || ""}
                            onChange={(e) => updateAddress(index, "fax_number", e.target.value)}
                            placeholder={t("placeholders.fax")}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
            )}
          </div>
        )}
      </div>

      {/* Shipping Address */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{t("fields.shippingAddress")}</h3>
          <Button type="button" variant="outline" size="sm" onClick={() => addAddress("shipping")}>
            <Plus className="h-4 w-4 mr-2" />
            {t("actions.addShippingAddress")}
          </Button>
        </div>

        {shippingAddresses.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("messages.noAddresses")}</p>
        ) : (
          <div className="space-y-4">
            {addresses.map(
              (address, index) =>
                (address.address_type === "shipping" || address.address_type === "both") && (
                  <Card key={index}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                      <CardTitle className="text-sm font-medium">
                        {ADDRESS_TYPES.find((t) => t.value === address.address_type)?.label}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={address.is_default}
                          onCheckedChange={() => toggleDefault(index)}
                        />
                        <Label className="text-sm font-normal">{t("fields.defaultAddress")}</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeAddress(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Same address fields as billing */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>{t("fields.attentionTo")}</Label>
                          <Input
                            value={address.attention_to || ""}
                            onChange={(e) => updateAddress(index, "attention_to", e.target.value)}
                            placeholder={t("placeholders.attentionTo")}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>{t("fields.country")}</Label>
                          <Input
                            value={address.country || ""}
                            onChange={(e) => updateAddress(index, "country", e.target.value)}
                            placeholder={t("placeholders.country")}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>{t("fields.addressLine1")}</Label>
                        <Input
                          value={address.address_line_1 || ""}
                          onChange={(e) => updateAddress(index, "address_line_1", e.target.value)}
                          placeholder={t("placeholders.addressLine1")}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>{t("fields.addressLine2")}</Label>
                        <Input
                          value={address.address_line_2 || ""}
                          onChange={(e) => updateAddress(index, "address_line_2", e.target.value)}
                          placeholder={t("placeholders.addressLine2")}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>{t("fields.city")}</Label>
                          <Input
                            value={address.city || ""}
                            onChange={(e) => updateAddress(index, "city", e.target.value)}
                            placeholder={t("placeholders.city")}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>{t("fields.stateProvince")}</Label>
                          <Input
                            value={address.state_province || ""}
                            onChange={(e) => updateAddress(index, "state_province", e.target.value)}
                            placeholder={t("placeholders.stateProvince")}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>{t("fields.postalCode")}</Label>
                          <Input
                            value={address.postal_code || ""}
                            onChange={(e) => updateAddress(index, "postal_code", e.target.value)}
                            placeholder={t("placeholders.postalCode")}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>{t("fields.phone")}</Label>
                          <Input
                            value={address.phone || ""}
                            onChange={(e) => updateAddress(index, "phone", e.target.value)}
                            placeholder={t("placeholders.phone")}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>{t("fields.fax")}</Label>
                          <Input
                            value={address.fax_number || ""}
                            onChange={(e) => updateAddress(index, "fax_number", e.target.value)}
                            placeholder={t("placeholders.fax")}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
