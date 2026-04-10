"use client";

// =============================================
// Contact Detail View Component
// =============================================

import { useEffect, useState } from "react";
import { useContactsStore } from "@/lib/stores/contacts-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Edit, Trash2, ArrowLeft, Mail, Phone, Globe } from "lucide-react";
import { ContactForm } from "./contact-form";
import { contactsService } from "../api/contacts-service";
import { ContactFormData } from "../types";
import { useAppStore } from "@/lib/stores/app-store";
import { toast } from "react-toastify";

interface ContactDetailViewProps {
  contactId: string;
}

export function ContactDetailView({ contactId }: ContactDetailViewProps) {
  const t = useTranslations("contacts");
  const router = useRouter();
  const { activeOrgId } = useAppStore();
  const { selectedContact, isLoadingContact, loadContactById, error } = useContactsStore();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadContactById(contactId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId]);

  const handleUpdate = async (data: ContactFormData) => {
    if (!selectedContact) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { addresses, custom_fields, ...contactData } = data;
      await contactsService.updateContact(selectedContact.id, contactData);
      await loadContactById(contactId);
      setIsEditOpen(false);
      toast.success(t("messages.updateSuccess"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("messages.error"));
    }
  };

  const handleDelete = async () => {
    if (!selectedContact || !activeOrgId) return;

    setIsDeleting(true);
    try {
      await contactsService.deleteContact(selectedContact.id);
      toast.success(t("messages.deleteSuccess"));
      router.push("/dashboard-old/contacts");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("messages.error"));
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoadingContact) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">{t("messages.loading")}</p>
      </div>
    );
  }

  if (!selectedContact) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <p className="text-muted-foreground text-lg">{error || "Contact not found"}</p>
        <Button variant="outline" onClick={() => router.push("/dashboard-old/contacts")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t("actions.backToList")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{selectedContact.display_name}</h1>
            <div className="flex gap-2 mt-2">
              <Badge
                variant={selectedContact.visibility_scope === "private" ? "secondary" : "outline"}
              >
                {t(`scopes.${selectedContact.visibility_scope}`)}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsEditOpen(true)}>
            <Edit className="h-4 w-4 mr-2" />
            {t("actions.edit")}
          </Button>
          <Button variant="destructive" onClick={() => setIsDeleteOpen(true)}>
            <Trash2 className="h-4 w-4 mr-2" />
            {t("actions.delete")}
          </Button>
        </div>
      </div>

      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle>{t("form.tabs.basicInfo")}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {selectedContact.first_name && (
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  {t("form.fields.firstName")}
                </dt>
                <dd>{selectedContact.first_name}</dd>
              </div>
            )}
            {selectedContact.last_name && (
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  {t("form.fields.lastName")}
                </dt>
                <dd>{selectedContact.last_name}</dd>
              </div>
            )}

            {selectedContact.primary_email && (
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  {t("form.fields.primaryEmail")}
                </dt>
                <dd>
                  <a
                    href={`mailto:${selectedContact.primary_email}`}
                    className="flex items-center gap-1 text-primary hover:underline"
                  >
                    <Mail className="h-3 w-3" />
                    {selectedContact.primary_email}
                  </a>
                </dd>
              </div>
            )}

            {selectedContact.work_phone && (
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  {t("form.fields.workPhone")}
                </dt>
                <dd>
                  <a
                    href={`tel:${selectedContact.work_phone}`}
                    className="flex items-center gap-1 text-primary hover:underline"
                  >
                    <Phone className="h-3 w-3" />
                    {selectedContact.work_phone}
                  </a>
                </dd>
              </div>
            )}

            {selectedContact.mobile_phone && (
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  {t("form.fields.mobilePhone")}
                </dt>
                <dd>
                  <a
                    href={`tel:${selectedContact.mobile_phone}`}
                    className="flex items-center gap-1 text-primary hover:underline"
                  >
                    <Phone className="h-3 w-3" />
                    {selectedContact.mobile_phone}
                  </a>
                </dd>
              </div>
            )}

            {selectedContact.website && (
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  {t("form.fields.website")}
                </dt>
                <dd>
                  <a
                    href={selectedContact.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline"
                  >
                    <Globe className="h-3 w-3" />
                    {selectedContact.website}
                  </a>
                </dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Addresses */}
      {selectedContact.addresses && selectedContact.addresses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("form.tabs.address")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {selectedContact.addresses
                .filter((addr) => !addr.deleted_at)
                .map((address) => (
                  <div key={address.id} className="border-l-2 border-primary pl-4">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="font-medium capitalize">{address.address_type}</p>
                      {address.is_default && (
                        <Badge variant="secondary">{t("form.fields.defaultAddress")}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {address.address_line_1}
                      {address.address_line_2 && `, ${address.address_line_2}`}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {address.city}
                      {address.state_province && `, ${address.state_province}`}
                      {address.postal_code && ` ${address.postal_code}`}
                    </p>
                    {address.country && (
                      <p className="text-sm text-muted-foreground">{address.country}</p>
                    )}
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {selectedContact.notes && (
        <Card>
          <CardHeader>
            <CardTitle>{t("form.tabs.remarks")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{selectedContact.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <ContactForm
            contactType="contact"
            onSubmit={handleUpdate}
            onCancel={() => setIsEditOpen(false)}
            initialData={selectedContact as any}
            isEditMode={true}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("messages.confirmDeleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("messages.confirmDeleteText", { name: selectedContact.display_name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t("actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? t("actions.deleting") : t("actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
