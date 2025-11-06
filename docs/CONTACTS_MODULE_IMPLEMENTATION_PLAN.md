# Contacts Module Implementation Plan

## Overview

Create a standalone **Contacts Module** for managing personal and organizational contacts with flexible visibility scopes (private, branch, organization). Keep **Suppliers** and **Clients** as separate entities that can optionally link to contacts for contact person management, but maintain their independence for product relationships and business logic.

## Core Architecture Principles

1. **Contacts** = Personal/professional contacts with visibility scopes
2. **Suppliers** = Business entities that supply products (link to contacts for contact persons)
3. **Clients/Customers** = Business entities that buy products (link to contacts for contact persons)
4. **Products** = Always linked to **Suppliers**, NEVER to contacts
5. **Soft Delete** = All entities use `deleted_at`, NO cascade deletes, NO hard deletes

---

## Phase 1: Contacts Module Foundation

### 1.1 Database Schema Updates

#### Migration: Add Visibility Scope to Contacts

**File**: `supabase/migrations/xxxxx_add_contacts_visibility_scope.sql`

```sql
-- Add visibility scope to contacts table
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS visibility_scope TEXT NOT NULL
  CHECK (visibility_scope IN ('private', 'branch', 'organization'))
  DEFAULT 'organization';

-- Add owner for private contacts
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add branch for branch-scoped contacts
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_contacts_visibility_scope ON contacts(visibility_scope) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_owner_user ON contacts(owner_user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_branch ON contacts(branch_id) WHERE deleted_at IS NULL;

-- Update trigger for updated_at
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON COLUMN contacts.visibility_scope IS 'Contact visibility: private (user only), branch (branch members), organization (all org members)';
COMMENT ON COLUMN contacts.owner_user_id IS 'User who created/owns the contact (required for private contacts)';
COMMENT ON COLUMN contacts.branch_id IS 'Branch for branch-scoped contacts';
```

#### Update Contact Types

Contact types should be for **general contacts only**:

- `contact` - General personal/professional contact (default)
- `lead` - Potential client/lead
- `other` - Other contact types

**Remove** `customer` and `vendor` from contact_type enum (they are separate entities in suppliers/customers tables)

### 1.2 Module Configuration

**File**: `src/modules/contacts/config.ts`

```typescript
import { ModuleConfig } from "../types";

export const contactsModule: ModuleConfig = {
  id: "contacts",
  name: "Contacts",
  description: "Manage personal and organizational contacts",
  icon: "Users",
  color: "#3b82f6", // blue
  routes: [
    {
      path: "/contacts",
      name: "All Contacts",
      allowedUsers: [{ role: "user", scope: "branch" }],
    },
    {
      path: "/contacts/[id]",
      name: "Contact Detail",
      allowedUsers: [{ role: "user", scope: "branch" }],
    },
  ],
  menuItems: [
    {
      label: "Contacts",
      path: "/contacts",
      icon: "Users",
      allowedUsers: [{ role: "user", scope: "branch" }],
    },
  ],
  widgets: [],
};
```

### 1.3 TypeScript Types Updates

**File**: `src/modules/contacts/types/index.ts`

Add visibility scope types:

```typescript
export type VisibilityScope = "private" | "branch" | "organization";

export interface ContactFormData {
  // ... existing fields

  // Add visibility scope
  visibility_scope: VisibilityScope;
  owner_user_id?: string;
  branch_id?: string;

  // ... rest of fields
}

export const VISIBILITY_SCOPES: {
  value: VisibilityScope;
  label: string;
  labelPl: string;
  description: string;
  descriptionPl: string;
}[] = [
  {
    value: "private",
    label: "Private",
    labelPl: "Prywatne",
    description: "Only visible to you",
    descriptionPl: "Widoczne tylko dla Ciebie",
  },
  {
    value: "branch",
    label: "Branch",
    labelPl: "Oddział",
    description: "Visible to branch members",
    descriptionPl: "Widoczne dla członków oddziału",
  },
  {
    value: "organization",
    label: "Organization",
    labelPl: "Organizacja",
    description: "Visible to all organization members",
    descriptionPl: "Widoczne dla wszystkich członków organizacji",
  },
];
```

---

## Phase 2: Backend Service Updates

### 2.1 Update Contacts Service

**File**: `src/modules/contacts/api/contacts-service.ts`

Add scope filtering logic:

```typescript
/**
 * Get contacts filtered by visibility scope
 */
async getContacts(
  organizationId: string,
  userId: string,
  userBranchId: string | null,
  filters?: ContactFilters,
  page: number = 1,
  pageSize: number = 50
): Promise<ContactsListResponse> {
  let query = this.supabase
    .from("contacts")
    .select(`...`, { count: "exact" })
    .eq("organization_id", organizationId)
    .is("deleted_at", null);

  // Apply visibility scope filtering
  query = query.or(`
    visibility_scope.eq.organization,
    and(visibility_scope.eq.branch,branch_id.eq.${userBranchId}),
    and(visibility_scope.eq.private,owner_user_id.eq.${userId})
  `);

  // Apply other filters...
  // ...existing filter logic

  const { data, error, count } = await query;
  // ... rest of implementation
}

/**
 * Create contact with visibility scope
 */
async createContact(
  organizationId: string,
  userId: string,
  branchId: string | null,
  contactData: Omit<ContactInsert, "organization_id">,
  addresses?: Omit<ContactAddressInsert, "contact_id">[],
  persons?: Omit<ContactPersonInsert, "contact_id">[]
): Promise<Contact> {
  // Set owner and branch based on visibility scope
  const dataToInsert = {
    ...contactData,
    organization_id: organizationId,
    owner_user_id: contactData.visibility_scope === "private" ? userId : null,
    branch_id: contactData.visibility_scope === "branch" ? branchId : null,
  };

  // ... rest of creation logic
}
```

### 2.2 Update Contacts Store

**File**: `src/lib/stores/contacts-store.ts`

Ensure it passes user context for filtering:

```typescript
loadContacts: async (orgId: string, page?: number) => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userBranchId = get().activeBranchId; // from app store

  const result = await contactsService.getContacts(
    orgId,
    user?.id || "",
    userBranchId,
    get().filters,
    page || get().currentPage,
    get().pageSize
  );
  // ... update state
};
```

---

## Phase 3: UI Components - Contact Form

### 3.1 Update Basic Info Tab

**File**: `src/modules/contacts/components/contact-form-tabs/basic-info-tab.tsx`

Add visibility scope field after entity type:

```tsx
<div className="space-y-2">
  <Label htmlFor="visibility_scope">
    {t("fields.visibilityScope")} <span className="text-red-500">*</span>
  </Label>
  <Select
    value={watch("visibility_scope")}
    onValueChange={(value) => setValue("visibility_scope", value as VisibilityScope)}
  >
    <SelectTrigger id="visibility_scope">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {VISIBILITY_SCOPES.map((scope) => (
        <SelectItem key={scope.value} value={scope.value}>
          <div>
            <p className="font-medium">{scope.label}</p>
            <p className="text-sm text-muted-foreground">{scope.description}</p>
          </div>
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

### 3.2 Update Contact Form Default Values

**File**: `src/modules/contacts/components/contact-form.tsx`

```typescript
const form = useForm<ContactFormData>({
  defaultValues: {
    contact_type: contactType,
    entity_type: "business",
    display_name: "",
    visibility_scope: "organization", // Default to organization
    addresses: [],
    persons: [],
    custom_fields: {},
    // ... rest of defaults
    ...initialData,
  },
});
```

---

## Phase 4: UI Components - Main Pages

### 4.1 Contacts List Page

**File**: `src/app/[locale]/dashboard/contacts/page.tsx`

```tsx
import { ContactsListView } from "@/modules/contacts/components/contacts-list-view";

export default function ContactsPage() {
  return <ContactsListView />;
}
```

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
import { Plus, Search, Filter } from "lucide-react";
import { ContactsTable } from "./contacts-table";
import { VisibilityScope, EntityType } from "../types";

export function ContactsListView() {
  const t = useTranslations("contacts");
  const { activeOrgId } = useAppStore();
  const { contacts, isLoading, loadContacts, setFilters } = useContactsStore();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [scopeFilter, setScopeFilter] = useState<VisibilityScope | "all">("all");
  const [entityTypeFilter, setEntityTypeFilter] = useState<EntityType | "all">("all");

  // Load contacts on mount
  useEffect(() => {
    if (activeOrgId) {
      setFilters({ contact_type: "contact" }); // Only show general contacts
      loadContacts(activeOrgId);
    }
  }, [activeOrgId]);

  // Search and filter
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
  }, [searchTerm, scopeFilter, entityTypeFilter]);

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
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("filters.searchPlaceholder")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Visibility Scope Filter */}
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

          {/* Entity Type Filter */}
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

          {/* Clear Filters */}
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

      {/* Create Contact Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <ContactForm
            contactType="contact"
            onSubmit={async (data) => {
              // Handle create
              setIsFormOpen(false);
            }}
            onCancel={() => setIsFormOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

### 4.2 Contacts Table Component

**File**: `src/modules/contacts/components/contacts-table.tsx`

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
              <TableHead>{t("fields.displayName")}</TableHead>
              <TableHead>{t("fields.type")}</TableHead>
              <TableHead>{t("fields.visibilityScope")}</TableHead>
              <TableHead>{t("fields.email")}</TableHead>
              <TableHead>{t("fields.phone")}</TableHead>
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        /* Handle edit */
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        /* Handle delete */
                      }}
                    >
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

### 4.3 Contact Detail Page

**File**: `src/app/[locale]/dashboard/contacts/[id]/page.tsx`

```tsx
import { ContactDetailView } from "@/modules/contacts/components/contact-detail-view";

export default function ContactDetailPage({ params }: { params: { id: string } }) {
  return <ContactDetailView contactId={params.id} />;
}
```

**File**: `src/modules/contacts/components/contact-detail-view.tsx`

(Full implementation with all sections: overview, addresses, contact persons, notes, etc.)

---

## Phase 5: Translations

### 5.1 English Translations

**File**: `messages/en.json`

Add to contacts section:

```json
{
  "contacts": {
    "title": "Contacts",
    "description": "Manage your personal and organizational contacts",
    "fields": {
      "visibilityScope": "Visibility Scope"
    },
    "scopes": {
      "private": "Private",
      "branch": "Branch",
      "organization": "Organization"
    },
    "filters": {
      "allScopes": "All Scopes"
    }
  }
}
```

### 5.2 Polish Translations

**File**: `messages/pl.json`

(Polish equivalents)

---

## Phase 6: Module Registration

### 6.1 Register Module

**File**: `src/modules/index.ts`

```typescript
import { contactsModule } from "./contacts/config";

export const getAllModules = (activeOrgId?: string) => {
  return [
    homeModule,
    warehouseModule,
    teamsModule,
    contactsModule, // ADD HERE
    organizationManagementModule,
    supportModule,
  ];
};
```

---

## Implementation Checklist

### Backend (Database & API)

- [ ] Create migration for visibility scope fields
- [ ] Update contact_type enum to remove customer/vendor
- [ ] Update ContactsService with scope filtering
- [ ] Update contacts store with user context
- [ ] Add soft delete enforcement
- [ ] Test API endpoints

### Module Configuration

- [ ] Create contacts module config.ts
- [ ] Register module in src/modules/index.ts
- [ ] Verify sidebar menu appears

### TypeScript Types

- [ ] Add VisibilityScope type
- [ ] Add VISIBILITY_SCOPES constants
- [ ] Update ContactFormData interface
- [ ] Update filter types

### UI Components - Forms

- [ ] Update basic-info-tab with visibility scope
- [ ] Update contact-form default values
- [ ] Test form validation
- [ ] Test form submission

### UI Components - Pages

- [ ] Create contacts list page route
- [ ] Create ContactsListView component
- [ ] Create ContactsTable component
- [ ] Add filters (search, scope, entity type)
- [ ] Add pagination
- [ ] Create contact detail page route
- [ ] Create ContactDetailView component
- [ ] Add edit functionality
- [ ] Add delete functionality (soft delete with confirmation)

### Contact Persons

- [ ] Verify contact persons tab works
- [ ] Test add/edit/delete contact persons
- [ ] Test primary contact setting
- [ ] Display contact persons in detail view

### Addresses

- [ ] Verify address tab works
- [ ] Test add/edit/delete addresses
- [ ] Display addresses in detail view

### Translations

- [ ] Add English translations
- [ ] Add Polish translations
- [ ] Test all translated strings

### Testing

- [ ] Test private contacts (only owner can see)
- [ ] Test branch contacts (branch members can see)
- [ ] Test organization contacts (all org members can see)
- [ ] Test soft delete
- [ ] Test create/edit/delete operations
- [ ] Test filters and search
- [ ] Test pagination
- [ ] Test with different user roles

---

## Future Enhancements (NOT IN SCOPE NOW)

- Custom fields implementation
- Document attachments
- Price lists integration
- Contact import/export
- Contact duplication detection
- Admin restore functionality for soft-deleted items
- Activity timeline/audit log
- Contact merge functionality
- Advanced search/filtering
- Bulk operations

---

## Notes

- **Suppliers and Clients**: NOT touched in this phase. They remain independent entities.
- **Products**: Continue linking to suppliers, NOT to contacts.
- **Contact Persons**: Linked to contacts table, can be associated with suppliers/clients via contact_id (future phase).
- **Soft Delete**: ALL deletes are soft deletes using `deleted_at`. No cascade deletes.
- **Visibility**: Private (user), Branch (branch members), Organization (all members).
