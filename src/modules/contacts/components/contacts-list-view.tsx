"use client";

// =============================================
// Contacts List View - Main Contacts Page
// =============================================

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useContactsStore } from "@/lib/stores/contacts-store";
import { useAppStore } from "@/lib/stores/app-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ContactForm } from "./contact-form";
import { ContactsTable } from "./contacts-table";
import { Plus, Search } from "lucide-react";
import { VisibilityScope, ContactFormData, ContactWithRelations } from "../types";
import { contactsService } from "../api/contacts-service";
import { toast } from "react-toastify";

export function ContactsListView() {
  const t = useTranslations("contacts");
  const { activeOrgId } = useAppStore();
  const { contacts, isLoading, loadContacts, setFilters, total } = useContactsStore();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactWithRelations | null>(null);
  const [contactToDelete, setContactToDelete] = useState<ContactWithRelations | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [scopeFilter, setScopeFilter] = useState<VisibilityScope | "all">("all");

  useEffect(() => {
    if (activeOrgId) {
      setFilters({ contact_type: "contact" });
      loadContacts(activeOrgId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrgId]);

  useEffect(() => {
    if (activeOrgId) {
      const delaySearch = setTimeout(() => {
        setFilters({
          contact_type: "contact",
          visibility_scope: scopeFilter !== "all" ? scopeFilter : undefined,
          entity_type: entityTypeFilter !== "all" ? entityTypeFilter : undefined,
          search: searchTerm || undefined,
        });
        loadContacts(activeOrgId);
      }, 300);

      return () => clearTimeout(delaySearch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, scopeFilter, entityTypeFilter, activeOrgId]);

  const handleCreateContact = async (data: ContactFormData) => {
    if (!activeOrgId) return;

    try {
      const { createClient } = await import("@/utils/supabase/client");
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        toast.error("User not authenticated");
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { addresses, custom_fields, ...contactData } = data;

      await contactsService.createContact(activeOrgId, userData.user.id, contactData, addresses);

      await loadContacts(activeOrgId);
      setIsFormOpen(false);
      toast.success(t("messages.createSuccess"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("messages.error"));
    }
  };

  const handleUpdateContact = async (data: ContactFormData) => {
    if (!activeOrgId || !editingContact) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { addresses, custom_fields, ...contactData } = data;

      await contactsService.updateContact(editingContact.id, contactData);

      await loadContacts(activeOrgId);
      setIsFormOpen(false);
      setEditingContact(null);
      toast.success(t("messages.updateSuccess"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("messages.error"));
    }
  };

  const handleEdit = (contact: ContactWithRelations) => {
    setEditingContact(contact);
    setIsFormOpen(true);
  };

  const handleDelete = (contact: ContactWithRelations) => {
    setContactToDelete(contact);
  };

  const confirmDelete = async () => {
    if (!contactToDelete || !activeOrgId) return;

    setIsDeleting(true);
    try {
      await contactsService.deleteContact(contactToDelete.id);
      await loadContacts(activeOrgId);
      setContactToDelete(null);
      toast.success(t("messages.deleteSuccess"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("messages.error"));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t("actions.newContact")}
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("filters.searchPlaceholder")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={scopeFilter} onValueChange={(value) => setScopeFilter(value as any)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filters.allScopes")}</SelectItem>
              <SelectItem value="private">{t("scopes.private")}</SelectItem>
              <SelectItem value="organization">{t("scopes.organization")}</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            onClick={() => {
              setSearchTerm("");
              setScopeFilter("all");
            }}
          >
            {t("filters.clearAll")}
          </Button>
        </div>
      </Card>

      {/* Contacts Table */}
      <ContactsTable
        contacts={contacts}
        isLoading={isLoading}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {/* Total */}
      {total > 0 && (
        <div className="text-sm text-muted-foreground">
          {t("pagination.showing", {
            start: contacts.length > 0 ? 1 : 0,
            end: contacts.length,
            total,
          })}
        </div>
      )}

      {/* Create/Edit Contact Dialog */}
      <Dialog
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) setEditingContact(null);
        }}
      >
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <ContactForm
            contactType="contact"
            onSubmit={editingContact ? handleUpdateContact : handleCreateContact}
            onCancel={() => {
              setIsFormOpen(false);
              setEditingContact(null);
            }}
            initialData={(editingContact as any) || undefined}
            isEditMode={!!editingContact}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!contactToDelete}
        onOpenChange={(open) => !open && setContactToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("messages.confirmDeleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("messages.confirmDeleteText", { name: contactToDelete?.display_name || "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t("actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isDeleting}>
              {isDeleting ? t("actions.deleting") : t("actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
