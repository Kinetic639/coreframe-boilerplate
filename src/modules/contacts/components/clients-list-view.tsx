"use client";

// =============================================
// Clients List View (Customers)
// =============================================

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useContactsStore } from "@/lib/stores/contacts-store";
import { useAppStore } from "@/lib/stores/app-store";
import { ContactForm } from "./contact-form";
import { ContactFormData, ContactWithRelations } from "../types";
// FIXME: import { contactsService } from "../api/contacts-service";
import { toast } from "react-toastify";
import { Plus, Search, Filter, Mail, Phone, User, Edit, Trash2 } from "lucide-react";
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

export function ClientsListView() {
  const t = useTranslations("contacts");
  const { activeOrgId } = useAppStore();
  const {
    contacts,
    isLoading,
    filters,
    currentPage,
    pageSize,
    total,
    loadContacts,
    setFilters,
    setPage,
    refreshContacts,
  } = useContactsStore();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactWithRelations | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<ContactWithRelations | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (activeOrgId) {
      // Load contacts (clients are managed via separate system now)
      setFilters({ contact_type: "contact" });
      loadContacts(activeOrgId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrgId]);

  useEffect(() => {
    if (activeOrgId) {
      const delaySearch = setTimeout(() => {
        setFilters({
          ...filters,
          contact_type: "contact",
          search: searchTerm || undefined,
        });
        loadContacts(activeOrgId);
      }, 300);

      return () => clearTimeout(delaySearch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  const handleCreateContact = async (data: ContactFormData) => {
    if (!activeOrgId) {
      throw new Error("Organization not selected");
    }

    // Get user context
    const { createClient } = await import("@/utils/supabase/client");
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      throw new Error("User not authenticated");
    }

    // Extract addresses and custom_fields from the form data
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { addresses, custom_fields, ...contactData } = data;

    await contactsService.createContact(activeOrgId, userData.user.id, contactData, addresses);

    await refreshContacts(activeOrgId);
    setIsFormOpen(false);
  };

  const handleUpdateContact = async (data: ContactFormData) => {
    if (!editingContact) return;

    // Extract addresses and custom_fields from the form data
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { addresses, custom_fields, ...contactData } = data;

    const { updateContact } = useContactsStore.getState();
    await updateContact(editingContact.id, contactData);

    await refreshContacts(activeOrgId);
    setEditingContact(null);
    setIsFormOpen(false);
  };

  const handleEditClick = (contact: ContactWithRelations) => {
    setEditingContact(contact);
    setIsFormOpen(true);
  };

  const handleDeleteClick = (contact: ContactWithRelations) => {
    setContactToDelete(contact);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!contactToDelete) return;

    try {
      const { deleteContact } = useContactsStore.getState();
      await deleteContact(contactToDelete.id);
      toast.success(t("messages.deleteSuccess"));
      setDeleteDialogOpen(false);
      setContactToDelete(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("messages.deleteError"));
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("clients.title")}</h1>
          <p className="text-muted-foreground">{t("clients.description")}</p>
        </div>
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t("actions.newClient")}
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            {t("filters.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("filters.searchPlaceholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm("");
                setFilters({ contact_type: "contact" });
                if (activeOrgId) loadContacts(activeOrgId);
              }}
            >
              {t("filters.clearAll")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Contacts List */}
      <Card>
        <CardHeader>
          <CardTitle>{t("clients.list")}</CardTitle>
          <CardDescription>{t("clients.totalCount", { count: total })}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">{t("messages.loading")}</div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">{t("messages.noContacts")}</div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("fields.displayName")}</TableHead>
                    <TableHead>{t("fields.type")}</TableHead>
                    <TableHead>{t("fields.email")}</TableHead>
                    <TableHead>{t("fields.phone")}</TableHead>
                    <TableHead>{t("fields.location")}</TableHead>
                    <TableHead className="text-right">{t("fields.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {contact.display_name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{t(`types.${contact.contact_type}`)}</Badge>
                      </TableCell>
                      <TableCell>
                        {contact.primary_email ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Mail className="h-3 w-3" />
                            {contact.primary_email}
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {contact.work_phone || contact.mobile_phone ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Phone className="h-3 w-3" />
                            {contact.work_phone || contact.mobile_phone}
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {contact.addresses && contact.addresses.length > 0
                          ? contact.addresses[0].city || "-"
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditClick(contact)}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            {t("actions.edit")}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(contact)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            {t("actions.delete")}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {t("pagination.showing", {
                      start: (currentPage - 1) * pageSize + 1,
                      end: Math.min(currentPage * pageSize, total),
                      total,
                    })}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === 1}
                      onClick={() => {
                        setPage(currentPage - 1);
                        if (activeOrgId) loadContacts(activeOrgId, currentPage - 1);
                      }}
                    >
                      {t("pagination.previous")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === totalPages}
                      onClick={() => {
                        setPage(currentPage + 1);
                        if (activeOrgId) loadContacts(activeOrgId, currentPage + 1);
                      }}
                    >
                      {t("pagination.next")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

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
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("actions.confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("messages.confirmDeleteText", { name: contactToDelete?.display_name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setContactToDelete(null)}>
              {t("actions.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
