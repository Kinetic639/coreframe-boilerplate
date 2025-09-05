"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supplierService } from "../api";
import {
  Supplier,
  SupplierInsert,
  SupplierContact,
  SupplierContactInsert,
  SupplierContactUpdate,
  SupplierWithContacts,
} from "../api";
import { Loader2, Building2, MapPin, Tag } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SupplierContactForm } from "./supplier-contact-form";
import { useAppStore } from "@/lib/stores/app-store";

interface NewSupplierFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier?: SupplierWithContacts;
  onSuccess?: () => void;
}

export function NewSupplierFormDialog({
  open,
  onOpenChange,
  supplier,
  onSuccess,
}: NewSupplierFormDialogProps) {
  const [loading, setLoading] = React.useState(false);
  const [formData, setFormData] = React.useState({
    name: "",
    company_registration_number: "",
    tax_number: "",
    website: "",
    address_line_1: "",
    address_line_2: "",
    city: "",
    state_province: "",
    postal_code: "",
    country: "Poland",
    payment_terms: "",
    delivery_terms: "",
    notes: "",
    is_active: true,
    tags: [] as string[],
  });
  const [contacts, setContacts] = React.useState<SupplierContact[]>([]);
  const [newTag, setNewTag] = React.useState("");
  const { activeOrgId } = useAppStore();

  const isEditing = !!supplier;

  // Reset form when dialog opens/closes or supplier changes
  React.useEffect(() => {
    if (open) {
      if (supplier) {
        setFormData({
          name: supplier.name || "",
          company_registration_number: supplier.company_registration_number || "",
          tax_number: supplier.tax_number || "",
          website: supplier.website || "",
          address_line_1: supplier.address_line_1 || "",
          address_line_2: supplier.address_line_2 || "",
          city: supplier.city || "",
          state_province: supplier.state_province || "",
          postal_code: supplier.postal_code || "",
          country: supplier.country || "Poland",
          payment_terms: supplier.payment_terms || "",
          delivery_terms: supplier.delivery_terms || "",
          notes: supplier.notes || "",
          is_active: supplier.is_active ?? true,
          tags: supplier.tags || [],
        });
        setContacts(supplier.supplier_contacts || []);
      } else {
        setFormData({
          name: "",
          company_registration_number: "",
          tax_number: "",
          website: "",
          address_line_1: "",
          address_line_2: "",
          city: "",
          state_province: "",
          postal_code: "",
          country: "Poland",
          payment_terms: "",
          delivery_terms: "",
          notes: "",
          is_active: true,
          tags: [],
        });
        setContacts([]);
      }
    }
  }, [open, supplier]);

  const handleInputChange = (field: string, value: string | boolean | string[]) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      handleInputChange("tags", [...formData.tags, newTag.trim()]);
      setNewTag("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    handleInputChange(
      "tags",
      formData.tags.filter((tag) => tag !== tagToRemove)
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Nazwa dostawcy jest wymagana");
      return;
    }

    if (!activeOrgId) {
      toast.error("Brak aktywnej organizacji");
      return;
    }

    setLoading(true);

    try {
      const supplierData: SupplierInsert = {
        name: formData.name.trim(),
        organization_id: activeOrgId,
        company_registration_number: formData.company_registration_number.trim() || null,
        tax_number: formData.tax_number.trim() || null,
        website: formData.website.trim() || null,
        address_line_1: formData.address_line_1.trim() || null,
        address_line_2: formData.address_line_2.trim() || null,
        city: formData.city.trim() || null,
        state_province: formData.state_province.trim() || null,
        postal_code: formData.postal_code.trim() || null,
        country: formData.country.trim() || null,
        payment_terms: formData.payment_terms.trim() || null,
        delivery_terms: formData.delivery_terms.trim() || null,
        notes: formData.notes.trim() || null,
        is_active: formData.is_active,
        tags: formData.tags.length > 0 ? formData.tags : null,
      };

      let savedSupplier: Supplier;

      if (isEditing && supplier) {
        savedSupplier = await supplierService.updateSupplier(supplier.id, supplierData);
        toast.success("Dostawca został zaktualizowany");
      } else {
        savedSupplier = await supplierService.createSupplier(supplierData);
        toast.success("Dostawca został dodany");
      }

      // Handle contacts for new suppliers
      if (!isEditing && contacts.length > 0) {
        for (const contact of contacts) {
          if (contact.id.startsWith("temp-")) {
            const contactData: SupplierContactInsert = {
              supplier_id: savedSupplier.id,
              first_name: contact.first_name,
              last_name: contact.last_name,
              email: contact.email,
              phone: contact.phone,
              mobile: contact.mobile,
              position: contact.position,
              department: contact.department,
              is_primary: contact.is_primary,
              is_active: contact.is_active,
              notes: contact.notes,
            };
            await supplierService.createSupplierContact(contactData);
          }
        }
      }

      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving supplier:", error);
      toast.error(
        isEditing ? "Błąd podczas aktualizacji dostawcy" : "Błąd podczas dodawania dostawcy"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAddContact = async (contact: SupplierContactInsert): Promise<SupplierContact> => {
    if (!supplier?.id) {
      throw new Error("Supplier ID is required");
    }
    return await supplierService.createSupplierContact(contact);
  };

  const handleUpdateContact = async (
    id: string,
    contact: SupplierContactUpdate
  ): Promise<SupplierContact> => {
    return await supplierService.updateSupplierContact(id, contact);
  };

  const handleDeleteContact = async (id: string): Promise<void> => {
    await supplierService.deleteSupplierContact(id);
  };

  const handleSetPrimary = async (id: string): Promise<SupplierContact> => {
    return await supplierService.setPrimaryContact(id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-[900px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edytuj dostawcę" : "Dodaj nowego dostawcę"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Zaktualizuj informacje o dostawcy."
              : "Wprowadź informacje o nowym dostawcy."}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <form onSubmit={handleSubmit} className="space-y-6">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Podstawowe
                </TabsTrigger>
                <TabsTrigger value="address" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Adres
                </TabsTrigger>
                <TabsTrigger value="contacts" className="flex items-center gap-2">
                  Kontakty
                </TabsTrigger>
              </TabsList>

              {/* Basic Information Tab */}
              <TabsContent value="basic" className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nazwa dostawcy *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                      placeholder="np. ABC Sp. z o.o."
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="website">Strona internetowa</Label>
                    <Input
                      id="website"
                      value={formData.website}
                      onChange={(e) => handleInputChange("website", e.target.value)}
                      placeholder="https://www.dostawca.pl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="company_registration_number">NIP/REGON</Label>
                    <Input
                      id="company_registration_number"
                      value={formData.company_registration_number}
                      onChange={(e) =>
                        handleInputChange("company_registration_number", e.target.value)
                      }
                      placeholder="1234567890"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tax_number">Numer VAT</Label>
                    <Input
                      id="tax_number"
                      value={formData.tax_number}
                      onChange={(e) => handleInputChange("tax_number", e.target.value)}
                      placeholder="PL1234567890"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="payment_terms">Warunki płatności</Label>
                    <Input
                      id="payment_terms"
                      value={formData.payment_terms}
                      onChange={(e) => handleInputChange("payment_terms", e.target.value)}
                      placeholder="np. 30 dni"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="delivery_terms">Warunki dostawy</Label>
                    <Input
                      id="delivery_terms"
                      value={formData.delivery_terms}
                      onChange={(e) => handleInputChange("delivery_terms", e.target.value)}
                      placeholder="np. FCA, DDP"
                    />
                  </div>
                </div>

                {/* Tags */}
                <div className="space-y-2">
                  <Label>Tagi</Label>
                  <div className="mb-2 flex flex-wrap gap-2">
                    {formData.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary" className="flex items-center gap-1">
                        <Tag className="h-3 w-3" />
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="ml-1 text-xs hover:text-destructive"
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      placeholder="Dodaj tag"
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
                    />
                    <Button type="button" onClick={handleAddTag} variant="outline" size="sm">
                      Dodaj
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notatki</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => handleInputChange("notes", e.target.value)}
                    placeholder="Dodatkowe informacje..."
                    rows={3}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) =>
                      handleInputChange("is_active", checked as boolean)
                    }
                  />
                  <Label htmlFor="is_active">Aktywny dostawca</Label>
                </div>
              </TabsContent>

              {/* Address Tab */}
              <TabsContent value="address" className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="address_line_1">Adres - linia 1</Label>
                    <Input
                      id="address_line_1"
                      value={formData.address_line_1}
                      onChange={(e) => handleInputChange("address_line_1", e.target.value)}
                      placeholder="ul. Przykładowa 123"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address_line_2">Adres - linia 2</Label>
                    <Input
                      id="address_line_2"
                      value={formData.address_line_2}
                      onChange={(e) => handleInputChange("address_line_2", e.target.value)}
                      placeholder="Budynek, apartament"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="city">Miasto</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => handleInputChange("city", e.target.value)}
                      placeholder="Warszawa"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="postal_code">Kod pocztowy</Label>
                    <Input
                      id="postal_code"
                      value={formData.postal_code}
                      onChange={(e) => handleInputChange("postal_code", e.target.value)}
                      placeholder="00-000"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="state_province">Województwo</Label>
                    <Input
                      id="state_province"
                      value={formData.state_province}
                      onChange={(e) => handleInputChange("state_province", e.target.value)}
                      placeholder="Mazowieckie"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="country">Kraj</Label>
                    <Input
                      id="country"
                      value={formData.country}
                      onChange={(e) => handleInputChange("country", e.target.value)}
                      placeholder="Polska"
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Contacts Tab */}
              <TabsContent value="contacts" className="space-y-4">
                <SupplierContactForm
                  supplierId={supplier?.id}
                  contacts={contacts}
                  onContactsChange={setContacts}
                  onAddContact={handleAddContact}
                  onUpdateContact={handleUpdateContact}
                  onDeleteContact={handleDeleteContact}
                  onSetPrimary={handleSetPrimary}
                  disabled={loading}
                />
              </TabsContent>
            </Tabs>

            {/* Actions */}
            <div className="flex justify-end space-x-2 border-t pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Anuluj
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? "Zaktualizuj" : "Dodaj dostawcę"}
              </Button>
            </div>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
