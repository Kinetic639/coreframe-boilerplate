"use client";

// =============================================
// Contacts Table Component
// =============================================

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, User, Mail, Phone, Eye, Edit, Trash2 } from "lucide-react";
import { ContactWithRelations } from "../types";

interface ContactsTableProps {
  contacts: ContactWithRelations[];
  isLoading: boolean;
  onEdit?: (contact: ContactWithRelations) => void;
  onDelete?: (contact: ContactWithRelations) => void;
}

export function ContactsTable({ contacts, isLoading, onEdit, onDelete }: ContactsTableProps) {
  const t = useTranslations("contacts");
  const router = useRouter();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">{t("messages.loading")}</CardContent>
      </Card>
    );
  }

  if (contacts.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">{t("messages.noContacts")}</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("form.fields.displayName")}</TableHead>
              <TableHead>{t("form.fields.customerType")}</TableHead>
              <TableHead>{t("form.fields.visibilityScope")}</TableHead>
              <TableHead>{t("form.fields.email")}</TableHead>
              <TableHead>{t("form.fields.phone")}</TableHead>
              <TableHead className="text-right">{t("form.fields.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((contact) => (
              <TableRow key={contact.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {contact.entity_type === "business" ? (
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <User className="h-4 w-4 text-muted-foreground" />
                    )}
                    {contact.display_name}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{t(`entityTypes.${contact.entity_type}`)}</Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      contact.visibility_scope === "private"
                        ? "secondary"
                        : contact.visibility_scope === "branch"
                          ? "default"
                          : "outline"
                    }
                  >
                    {t(`scopes.${contact.visibility_scope}`)}
                  </Badge>
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
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/dashboard/contacts/${contact.id}` as any)}
                      title={t("actions.view")}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {onEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(contact)}
                        title={t("actions.edit")}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(contact)}
                        title={t("actions.delete")}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
