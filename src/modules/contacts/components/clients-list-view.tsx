"use client";

// =============================================
// Clients List View (Customers)
// =============================================

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { ContactFormData, EntityType } from "../types";
import { contactsService } from "../api/contacts-service";
import { toast } from "react-toastify";
import { Plus, Search, Filter, Mail, Phone, Building2, User } from "lucide-react";

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
  const [searchTerm, setSearchTerm] = useState("");
  const [entityTypeFilter, setEntityTypeFilter] = useState<EntityType | "all">("all");

  useEffect(() => {
    if (activeOrgId) {
      // Load customers only
      setFilters({ contact_type: "customer" });
      loadContacts(activeOrgId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrgId]);

  useEffect(() => {
    if (activeOrgId) {
      const delaySearch = setTimeout(() => {
        setFilters({
          ...filters,
          contact_type: "customer",
          entity_type: entityTypeFilter !== "all" ? entityTypeFilter : undefined,
          search: searchTerm || undefined,
        });
        loadContacts(activeOrgId);
      }, 300);

      return () => clearTimeout(delaySearch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, entityTypeFilter]);

  const handleCreateContact = async (data: ContactFormData) => {
    if (!activeOrgId) return;

    try {
      // Extract addresses, persons, and custom_fields from the form data
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { addresses, persons, custom_fields, ...contactData } = data;

      await contactsService.createContact(activeOrgId, contactData, addresses, persons);

      await refreshContacts(activeOrgId);
      setIsFormOpen(false);
      toast.success(t("messages.createSuccess"));
    } catch (error) {
      throw error; // Let ContactForm handle the error display
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

            <Select
              value={entityTypeFilter}
              onValueChange={(value) => setEntityTypeFilter(value as EntityType | "all")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("filters.allTypes")}</SelectItem>
                <SelectItem value="business">{t("entityTypes.business")}</SelectItem>
                <SelectItem value="individual">{t("entityTypes.individual")}</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm("");
                setEntityTypeFilter("all");
                setFilters({ contact_type: "customer" });
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            // TODO: Navigate to details page
                          }}
                        >
                          {t("actions.view")}
                        </Button>
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

      {/* Create Contact Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <ContactForm
            contactType="customer"
            onSubmit={handleCreateContact}
            onCancel={() => setIsFormOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
