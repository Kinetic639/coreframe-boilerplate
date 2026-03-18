"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Plus, Trash2, Star, StarOff, Phone, Mail, User, Building2, Loader2 } from "lucide-react";
import { SupplierContact, SupplierContactInsert, SupplierContactUpdate } from "../api";

interface ContactFormData {
  id?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  mobile: string;
  position: string;
  department: string;
  is_primary: boolean;
  is_active: boolean;
  notes: string;
}

interface SupplierContactFormProps {
  supplierId?: string;
  contacts: SupplierContact[];
  onContactsChange: (contacts: SupplierContact[]) => void;
  onAddContact: (contact: SupplierContactInsert) => Promise<SupplierContact>;
  onUpdateContact: (id: string, contact: SupplierContactUpdate) => Promise<SupplierContact>;
  onDeleteContact: (id: string) => Promise<void>;
  onSetPrimary: (id: string) => Promise<SupplierContact>;
  disabled?: boolean;
}

export function SupplierContactForm({
  supplierId,
  contacts,
  onContactsChange,
  onAddContact,
  onUpdateContact: _onUpdateContact,
  onDeleteContact,
  onSetPrimary,
  disabled = false,
}: SupplierContactFormProps) {
  const [newContact, setNewContact] = React.useState<ContactFormData>({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    mobile: "",
    position: "",
    department: "",
    is_primary: false,
    is_active: true,
    notes: "",
  });
  // const [editingContactId, setEditingContactId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState<string | null>(null);

  const resetNewContact = () => {
    setNewContact({
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      mobile: "",
      position: "",
      department: "",
      is_primary: contacts.length === 0, // First contact is primary by default
      is_active: true,
      notes: "",
    });
  };

  const handleAddContact = async () => {
    if (!newContact.first_name.trim() || !newContact.last_name.trim()) {
      toast.error("Imię i nazwisko są wymagane");
      return;
    }

    if (!supplierId) {
      // For new suppliers, just add to local state
      const tempContact: SupplierContact = {
        id: `temp-${Date.now()}`,
        supplier_id: "temp",
        first_name: newContact.first_name.trim(),
        last_name: newContact.last_name.trim(),
        email: newContact.email.trim() || null,
        phone: newContact.phone.trim() || null,
        mobile: newContact.mobile.trim() || null,
        position: newContact.position.trim() || null,
        department: newContact.department.trim() || null,
        is_primary: newContact.is_primary,
        is_active: newContact.is_active,
        notes: newContact.notes.trim() || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      // If this is primary, make others non-primary
      const updatedContacts = newContact.is_primary
        ? contacts.map((c) => ({ ...c, is_primary: false }))
        : contacts;

      onContactsChange([...updatedContacts, tempContact]);
      resetNewContact();
      return;
    }

    setLoading("add");
    try {
      const contactData: SupplierContactInsert = {
        supplier_id: supplierId,
        first_name: newContact.first_name.trim(),
        last_name: newContact.last_name.trim(),
        email: newContact.email.trim() || null,
        phone: newContact.phone.trim() || null,
        mobile: newContact.mobile.trim() || null,
        position: newContact.position.trim() || null,
        department: newContact.department.trim() || null,
        is_primary: newContact.is_primary,
        is_active: newContact.is_active,
        notes: newContact.notes.trim() || null,
      };

      const created = await onAddContact(contactData);

      // Update local state
      const updatedContacts = newContact.is_primary
        ? contacts.map((c) => ({ ...c, is_primary: false }))
        : contacts;

      onContactsChange([...updatedContacts, created]);
      resetNewContact();
      toast.success("Kontakt został dodany");
    } catch (error) {
      console.error("Error adding contact:", error);
      toast.error("Błąd podczas dodawania kontaktu");
    } finally {
      setLoading(null);
    }
  };

  const handleDeleteContact = async (contact: SupplierContact) => {
    if (!supplierId || contact.id.startsWith("temp-")) {
      // For temp contacts or new suppliers, just remove from local state
      onContactsChange(contacts.filter((c) => c.id !== contact.id));
      return;
    }

    setLoading(contact.id);
    try {
      await onDeleteContact(contact.id);
      onContactsChange(contacts.filter((c) => c.id !== contact.id));
      toast.success("Kontakt został usunięty");
    } catch (error) {
      console.error("Error deleting contact:", error);
      toast.error("Błąd podczas usuwania kontaktu");
    } finally {
      setLoading(null);
    }
  };

  const handleSetPrimary = async (contact: SupplierContact) => {
    if (!supplierId || contact.id.startsWith("temp-")) {
      // For temp contacts or new suppliers, just update local state
      const updatedContacts = contacts.map((c) => ({
        ...c,
        is_primary: c.id === contact.id,
        updated_at: new Date().toISOString(),
      }));
      onContactsChange(updatedContacts);
      return;
    }

    setLoading(contact.id);
    try {
      const updated = await onSetPrimary(contact.id);

      // Update local state
      const updatedContacts = contacts.map((c) => ({
        ...c,
        is_primary: c.id === contact.id,
        updated_at: c.id === contact.id ? updated.updated_at : c.updated_at,
      }));
      onContactsChange(updatedContacts);

      toast.success("Kontakt główny został ustawiony");
    } catch (error) {
      console.error("Error setting primary contact:", error);
      toast.error("Błąd podczas ustawiania kontaktu głównego");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Kontakty</h3>
        <p className="text-sm text-muted-foreground">Zarządzaj kontaktami dla tego dostawcy</p>
      </div>

      {/* Existing Contacts */}
      {contacts.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-sm font-medium">Istniejące kontakty</h4>
          {contacts.map((contact) => (
            <Card key={contact.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <User className="h-4 w-4" />
                    {contact.first_name} {contact.last_name}
                    {contact.is_primary && (
                      <Badge variant="default" className="text-xs">
                        <Star className="mr-1 h-3 w-3" />
                        Główny
                      </Badge>
                    )}
                    {!contact.is_active && (
                      <Badge variant="secondary" className="text-xs">
                        Nieaktywny
                      </Badge>
                    )}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {!contact.is_primary && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetPrimary(contact)}
                        disabled={disabled || loading === contact.id}
                        title="Ustaw jako kontakt główny"
                      >
                        {loading === contact.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <StarOff className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteContact(contact)}
                      disabled={disabled || loading === contact.id}
                      className="text-destructive hover:text-destructive"
                    >
                      {loading === contact.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
                  {contact.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{contact.email}</span>
                    </div>
                  )}
                  {contact.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{contact.phone}</span>
                    </div>
                  )}
                  {contact.mobile && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{contact.mobile} (mobile)</span>
                    </div>
                  )}
                  {contact.position && (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>{contact.position}</span>
                    </div>
                  )}
                  {contact.department && (
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span>{contact.department}</span>
                    </div>
                  )}
                </div>
                {contact.notes && (
                  <div className="mt-3 border-t pt-3">
                    <p className="text-sm text-muted-foreground">{contact.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Separator />

      {/* Add New Contact */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium">Dodaj nowy kontakt</h4>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="contact_first_name">Imię *</Label>
            <Input
              id="contact_first_name"
              value={newContact.first_name}
              onChange={(e) => setNewContact((prev) => ({ ...prev, first_name: e.target.value }))}
              placeholder="Jan"
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_last_name">Nazwisko *</Label>
            <Input
              id="contact_last_name"
              value={newContact.last_name}
              onChange={(e) => setNewContact((prev) => ({ ...prev, last_name: e.target.value }))}
              placeholder="Kowalski"
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_email">Email</Label>
            <Input
              id="contact_email"
              type="email"
              value={newContact.email}
              onChange={(e) => setNewContact((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="jan.kowalski@firma.pl"
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_phone">Telefon</Label>
            <Input
              id="contact_phone"
              value={newContact.phone}
              onChange={(e) => setNewContact((prev) => ({ ...prev, phone: e.target.value }))}
              placeholder="+48 123 456 789"
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_mobile">Telefon komórkowy</Label>
            <Input
              id="contact_mobile"
              value={newContact.mobile}
              onChange={(e) => setNewContact((prev) => ({ ...prev, mobile: e.target.value }))}
              placeholder="+48 987 654 321"
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_position">Stanowisko</Label>
            <Input
              id="contact_position"
              value={newContact.position}
              onChange={(e) => setNewContact((prev) => ({ ...prev, position: e.target.value }))}
              placeholder="Menedżer sprzedaży"
              disabled={disabled}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="contact_department">Dział</Label>
            <Input
              id="contact_department"
              value={newContact.department}
              onChange={(e) => setNewContact((prev) => ({ ...prev, department: e.target.value }))}
              placeholder="Sprzedaż"
              disabled={disabled}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="contact_notes">Notatki</Label>
            <Textarea
              id="contact_notes"
              value={newContact.notes}
              onChange={(e) => setNewContact((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Dodatkowe informacje o kontakcie..."
              rows={2}
              disabled={disabled}
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="contact_is_primary"
                checked={newContact.is_primary}
                onCheckedChange={(checked) =>
                  setNewContact((prev) => ({ ...prev, is_primary: checked as boolean }))
                }
                disabled={disabled}
              />
              <Label htmlFor="contact_is_primary">Kontakt główny</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="contact_is_active"
                checked={newContact.is_active}
                onCheckedChange={(checked) =>
                  setNewContact((prev) => ({ ...prev, is_active: checked as boolean }))
                }
                disabled={disabled}
              />
              <Label htmlFor="contact_is_active">Aktywny</Label>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleAddContact}
            disabled={
              disabled ||
              loading === "add" ||
              !newContact.first_name.trim() ||
              !newContact.last_name.trim()
            }
          >
            {loading === "add" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Plus className="mr-2 h-4 w-4" />
            Dodaj kontakt
          </Button>
        </div>
      </div>
    </div>
  );
}
