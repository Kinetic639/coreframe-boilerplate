# Next Steps for Contacts Module Implementation

## ✅ Completed (75%)

1. ✅ Database migration created and applied
2. ✅ TypeScript types updated with visibility scope
3. ✅ Backend service updated with scope filtering
4. ✅ Contacts store updated with user context
5. ✅ Module config created
6. ✅ Module registered in module registry
7. ✅ Contact form updated with visibility scope
8. ✅ Basic info tab updated with visibility scope selector
9. ✅ Clients list view updated with new service signature
10. ✅ English translations added (partial - visibility scope added)

## 🚧 Remaining Tasks (25%)

### 1. Complete Translations

**File**: `messages/pl.json`

- Add Polish translations for visibility scope
- Match the structure from `messages/en.json` lines 1852-2058

**Required Polish translations**:

```json
{
  "contacts": {
    "title": "Kontakty",
    "description": "Zarządzaj kontaktami osobistymi i organizacyjnymi",
    "types": {
      "contact": "Kontakt",
      "lead": "Potencjalny klient",
      "other": "Inny"
    },
    "visibilityScopes": {
      "private": "Prywatne",
      "branch": "Oddział",
      "organization": "Organizacja",
      "privateDesc": "Widoczne tylko dla Ciebie",
      "branchDesc": "Widoczne dla członków oddziału",
      "organizationDesc": "Widoczne dla wszystkich członków organizacji"
    },
    "form": {
      "fields": {
        "visibilityScope": "Zakres widoczności",
        "visibilityScopeHelp": "Kontroluj, kto może zobaczyć ten kontakt"
      }
    },
    "actions": {
      "newContact": "Nowy kontakt"
    },
    "filters": {
      "allScopes": "Wszystkie zakresy"
    },
    "scopes": {
      "private": "Prywatne",
      "branch": "Oddział",
      "organization": "Organizacja"
    }
  }
}
```

### 2. Create UI Components

#### A. ContactsListView Component

**File**: `src/modules/contacts/components/contacts-list-view.tsx`

```tsx
"use client";

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
import { ContactForm } from "./contact-form";
import { ContactsTable } from "./contacts-table";
import { Plus, Search } from "lucide-react";
import { VisibilityScope, EntityType, ContactFormData } from "../types";
import { contactsService } from "../api/contacts-service";
import { toast } from "react-toastify";

export function ContactsListView() {
  const t = useTranslations("contacts");
  const { activeOrgId } = useAppStore();
  const { contacts, isLoading, loadContacts, setFilters, total } = useContactsStore();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [scopeFilter, setScopeFilter] = useState<VisibilityScope | "all">("all");
  const [entityTypeFilter, setEntityTypeFilter] = useState<EntityType | "all">("all");

  useEffect(() => {
    if (activeOrgId) {
      setFilters({ contact_type: "contact" });
      loadContacts(activeOrgId);
    }
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

      const { activeBranch } = useAppStore.getState();
      const { addresses, persons, custom_fields, ...contactData } = data;

      await contactsService.createContact(
        activeOrgId,
        userData.user.id,
        activeBranch?.id || null,
        contactData,
        addresses,
        persons
      );

      await loadContacts(activeOrgId);
      setIsFormOpen(false);
      toast.success(t("messages.createSuccess"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("messages.error"));
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
              <SelectItem value="branch">{t("scopes.branch")}</SelectItem>
              <SelectItem value="organization">{t("scopes.organization")}</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={entityTypeFilter}
            onValueChange={(value) => setEntityTypeFilter(value as any)}
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
              setScopeFilter("all");
              setEntityTypeFilter("all");
            }}
          >
            {t("filters.clearAll")}
          </Button>
        </div>
      </Card>

      {/* Contacts Table */}
      <ContactsTable contacts={contacts} isLoading={isLoading} />

      {/* Total */}
      <div className="text-sm text-muted-foreground">
        {t("pagination.showing", {
          start: contacts.length > 0 ? 1 : 0,
          end: contacts.length,
          total,
        })}
      </div>

      {/* Create Contact Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <ContactForm
            contactType="contact"
            onSubmit={handleCreateContact}
            onCancel={() => setIsFormOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

#### B. ContactsTable Component

**File**: `src/modules/contacts/components/contacts-table.tsx`

```tsx
"use client";

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
}

export function ContactsTable({ contacts, isLoading }: ContactsTableProps) {
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
              <TableHead>{t("form.fields.type")}</TableHead>
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
                      onClick={() => router.push(`/dashboard/contacts/${contact.id}`)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
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
```

### 3. Create Page Routes

#### A. Contacts List Page

**File**: `src/app/[locale]/dashboard/contacts/page.tsx`

```tsx
import { ContactsListView } from "@/modules/contacts/components/contacts-list-view";

export default function ContactsPage() {
  return <ContactsListView />;
}
```

#### B. Contact Detail Page

**File**: `src/app/[locale]/dashboard/contacts/[id]/page.tsx`

```tsx
import { ContactDetailView } from "@/modules/contacts/components/contact-detail-view";

export default function ContactDetailPage({ params }: { params: { id: string } }) {
  return <ContactDetailView contactId={params.id} />;
}
```

### 4. Create ContactDetailView Component (Basic)

**File**: `src/modules/contacts/components/contact-detail-view.tsx`

```tsx
"use client";

import { useEffect } from "react";
import { useContactsStore } from "@/lib/stores/contacts-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Edit, Trash2, ArrowLeft } from "lucide-react";

interface ContactDetailViewProps {
  contactId: string;
}

export function ContactDetailView({ contactId }: ContactDetailViewProps) {
  const t = useTranslations("contacts");
  const router = useRouter();
  const { selectedContact, isLoadingContact, loadContactById } = useContactsStore();

  useEffect(() => {
    loadContactById(contactId);
  }, [contactId]);

  if (isLoadingContact) {
    return <div>Loading...</div>;
  }

  if (!selectedContact) {
    return <div>Contact not found</div>;
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
              <Badge variant="outline">{t(`entityTypes.${selectedContact.entity_type}`)}</Badge>
              <Badge>{t(`scopes.${selectedContact.visibility_scope}`)}</Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button variant="outline">
            <Trash2 className="h-4 w-4 mr-2 text-destructive" />
            Delete
          </Button>
        </div>
      </div>

      {/* Contact Info */}
      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Email</dt>
              <dd>{selectedContact.primary_email || "-"}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Work Phone</dt>
              <dd>{selectedContact.work_phone || "-"}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Mobile Phone</dt>
              <dd>{selectedContact.mobile_phone || "-"}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Website</dt>
              <dd>{selectedContact.website || "-"}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Addresses */}
      {selectedContact.addresses && selectedContact.addresses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Addresses</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedContact.addresses.map((address) => (
              <div key={address.id} className="mb-4">
                <p className="font-medium">{address.address_type}</p>
                <p className="text-sm text-muted-foreground">
                  {address.address_line_1}, {address.city}, {address.postal_code}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Contact Persons */}
      {selectedContact.persons && selectedContact.persons.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Contact Persons</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedContact.persons.map((person) => (
              <div key={person.id} className="mb-4">
                <p className="font-medium">
                  {person.first_name} {person.last_name}
                  {person.is_primary && <Badge className="ml-2">Primary</Badge>}
                </p>
                <p className="text-sm text-muted-foreground">{person.email}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

### 5. Update i18n Routing (if needed)

Check if the routing file needs to be updated at `src/i18n/routing.ts` or similar.

## Testing Checklist

- [ ] Create contact with private scope - verify only owner can see it
- [ ] Create contact with branch scope - verify branch members can see it
- [ ] Create contact with organization scope - verify all org members can see it
- [ ] Edit contact and change visibility scope
- [ ] Soft delete contact (deleted_at set, not removed from DB)
- [ ] Filter contacts by visibility scope
- [ ] Filter contacts by entity type
- [ ] Search contacts by name, email
- [ ] View contact details
- [ ] Add contact persons to contact
- [ ] Add addresses to contact

## Final Steps

1. Complete Polish translations
2. Create the 3 UI components listed above
3. Create the 2 page routes
4. Test all functionality
5. Verify contacts appear in sidebar menu
6. Verify contact creation works from /dashboard/contacts page

## Estimated Time: 2-3 hours
