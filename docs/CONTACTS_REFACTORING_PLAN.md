# Contacts Module Refactoring Plan

## Executive Summary

The contacts module has critical security flaws and architectural issues that need immediate attention. This document outlines a phased approach to fix security vulnerabilities, improve data consistency, and implement proper visibility scope handling.

**Critical Issues Identified:**

1. **Security**: RLS policies allow all authenticated users to access all contacts across organizations
2. **Business Logic**: Private contacts can be linked to organization-wide business accounts, creating orphaned relationships
3. **Data Model**: UI references fields that were removed from the database schema
4. **Architecture**: No visibility scope inheritance between contacts and business accounts

---

## Phase 1: Emergency Security Fixes (IMMEDIATE - Week 1)

### Priority: CRITICAL

These fixes address active security vulnerabilities that could lead to cross-organization data leakage.

### 1.1 Fix Contacts RLS Policies

**Current Issue**: All authenticated users can view/modify ALL contacts
**File**: `supabase/migrations/20251107000000_add_contacts_rls_policies.sql`

**Required Changes**:

```sql
-- Drop overly permissive policies
DROP POLICY IF EXISTS "contacts_select_policy" ON contacts;
DROP POLICY IF EXISTS "contacts_insert_policy" ON contacts;
DROP POLICY IF EXISTS "contacts_update_policy" ON contacts;
DROP POLICY IF EXISTS "contacts_delete_policy" ON contacts;

-- Create organization-scoped policies with visibility filtering
CREATE POLICY "contacts_select_policy" ON contacts
  FOR SELECT TO authenticated
  USING (
    -- Must be in user's organization
    organization_id IN (
      SELECT org_id FROM public.get_user_organizations(auth.uid())
    )
  );
```

**Note**: Application-level visibility filtering (private/branch/organization) will remain in service layer since database doesn't have user_branches table.

### 1.2 Add Business Accounts RLS Policies

**Current Issue**: No RLS policies exist - any user can access any business account
**File**: Create new migration `20251107100000_add_business_accounts_rls.sql`

**Required Changes**:

```sql
-- Enable RLS
ALTER TABLE business_accounts ENABLE ROW LEVEL SECURITY;

-- Organization isolation
CREATE POLICY "business_accounts_org_isolation" ON business_accounts
  FOR ALL TO authenticated
  USING (
    organization_id IN (
      SELECT org_id FROM public.get_user_organizations(auth.uid())
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT org_id FROM public.get_user_organizations(auth.uid())
    )
  );
```

### 1.3 Add Visibility Filtering to getContactById()

**Current Issue**: Method fetches any contact by ID without checking user permissions
**File**: `src/modules/contacts/api/contacts-service.ts` (lines 104-135)

**Required Changes**:

```typescript
async getContactById(
  contactId: string,
  userId: string,
  organizationId: string,
  userBranchId: string | null
): Promise<ContactWithRelations | null> {
  let query = this.supabase
    .from("contacts")
    .select(`
      *,
      addresses:contact_addresses(*),
      custom_field_values:contact_custom_field_values(
        *,
        field_definition:contact_custom_field_definitions(*)
      )
    `)
    .eq("id", contactId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null);

  // Apply visibility scope filtering
  const visibilityClauses: string[] = ["visibility_scope.eq.organization"];

  if (userBranchId) {
    visibilityClauses.push(
      `and(visibility_scope.eq.branch,branch_id.eq.${userBranchId})`
    );
  }

  visibilityClauses.push(
    `and(visibility_scope.eq.private,owner_user_id.eq.${userId})`
  );

  query = query.or(visibilityClauses.join(","));

  const { data, error } = await query.single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to fetch contact: ${error.message}`);
  }

  // Load linked business accounts
  const linkedBusinessAccounts = await this.getLinkedBusinessAccounts(contactId);

  return {
    ...data,
    linked_business_accounts: linkedBusinessAccounts,
  } as ContactWithRelations;
}
```

**Impact**: Prevents unauthorized access to contacts via direct URL manipulation.

---

## Phase 2: Data Model Fixes (Week 1-2)

### Priority: HIGH

These fixes address UI breaking issues and data inconsistencies.

### 2.1 Remove entity_type References from Contacts UI

**Current Issue**: UI code references `entity_type` field that was removed from contacts table
**Files to Fix**:

- `src/modules/contacts/components/contact-detail-view.tsx` (lines 108, 142, 151)
- `src/modules/contacts/components/contacts-list-view.tsx` (line 66)
- `src/modules/contacts/types/index.ts` (ContactFilters interface)

**Changes**:

```typescript
// Remove from ContactFilters
export interface ContactFilters {
  contact_type?: ContactType | ContactType[];
  visibility_scope?: VisibilityScope;
  search?: string;
  tags?: string[];
  // entity_type?: EntityType;  // ❌ REMOVE THIS
}
```

### 2.2 Fix Contact Detail View

**File**: `src/modules/contacts/components/contact-detail-view.tsx`

**Remove lines**:

- 108: Conditional rendering based on entity_type
- 142-170: Business vs individual field display logic
- Update to show all contacts as people (first_name, last_name, display_name)

### 2.3 Update Contact Store to Call getContactById with User Context

**File**: `src/lib/stores/contacts-store.ts`

**Current**:

```typescript
loadContactById: async (contactId: string) => {
  const contact = await contactsService.getContactById(contactId);
};
```

**Updated**:

```typescript
loadContactById: async (contactId: string) => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const appStore = (await import("./app-store")).useAppStore;
  const { activeOrg, activeBranch } = appStore.getState();
  if (!activeOrg) throw new Error("No organization selected");

  const contact = await contactsService.getContactById(
    contactId,
    user.id,
    activeOrg.id,
    activeBranch?.id || null
  );

  set({ selectedContact: contact, isLoadingContact: false });
};
```

---

## Phase 3: Visibility Scope Architecture Decision (Week 2-3)

### Priority: HIGH

Choose one approach and implement consistently.

### Option A: Remove Visibility Scope from Contacts (RECOMMENDED)

**Rationale**:

- Contacts exist to be linked to business accounts
- Business accounts are organization-scoped
- Simpler model, fewer edge cases
- Matches real-world usage patterns

**Implementation**:

#### 3.A.1 Database Migration

```sql
-- Migration: 20251108000000_remove_contact_visibility_scope.sql
ALTER TABLE contacts
  DROP COLUMN visibility_scope,
  DROP COLUMN owner_user_id,
  DROP COLUMN branch_id;

-- All contacts are now organization-scoped
-- Access control via business_accounts
```

#### 3.A.2 Update Service Layer

- Remove visibility filtering from `getContacts()`
- Simplify `getContactById()` to only check organization
- Remove owner_user_id from `createContact()`

#### 3.A.3 Update UI

- Remove visibility scope selector from contact form
- Update contacts list to show all org contacts
- Simplify filtering logic

**Pros**:

- ✅ Eliminates orphaned relationships
- ✅ Simpler codebase
- ✅ Matches business logic (contacts belong to companies)
- ✅ No visibility conflicts

**Cons**:

- ❌ Loses "private contact book" feature
- ❌ All contacts visible to organization
- ❌ Can't have personal contacts separate from business

---

### Option B: Enforce Visibility Compatibility with Validation (ALTERNATIVE)

**Rationale**:

- Keep private contacts feature
- Add strict validation to prevent incompatible linking
- Clear error messages guide users

**Implementation**:

#### 3.B.1 Database Constraint

```sql
-- Migration: 20251108000000_validate_contact_business_account_visibility.sql

CREATE FUNCTION validate_contact_visibility_for_linking()
RETURNS TRIGGER AS $$
DECLARE
  contact_visibility TEXT;
BEGIN
  -- Get contact's visibility scope
  SELECT visibility_scope INTO contact_visibility
  FROM contacts
  WHERE id = NEW.contact_id;

  -- Business accounts are always organization-scoped
  -- So only organization-scoped contacts can be linked
  IF contact_visibility != 'organization' THEN
    RAISE EXCEPTION
      'Cannot link % contact to business account. Only organization-wide contacts can be linked to business accounts.',
      contact_visibility
    USING HINT = 'Change contact visibility to "organization" before linking';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_contact_visibility_on_link
  BEFORE INSERT OR UPDATE OF contact_id
  ON business_accounts
  FOR EACH ROW
  WHEN (NEW.contact_id IS NOT NULL)
  EXECUTE FUNCTION validate_contact_visibility_for_linking();
```

#### 3.B.2 UI Validation

```typescript
// In linked-business-accounts-tab.tsx
const handleLinkAccount = async (accountId: string) => {
  if (!contactId) return;

  try {
    // Check contact visibility before linking
    const contact = await contactsService.getContactById(contactId, ...);

    if (contact.visibility_scope !== 'organization') {
      toast.error(
        `Cannot link ${contact.visibility_scope} contact to business account. ` +
        `Please change contact visibility to "Organization" first.`
      );
      return;
    }

    // Proceed with linking...
  }
}
```

#### 3.B.3 Data Cleanup Migration

```sql
-- Find and fix incompatible links
UPDATE contacts
SET visibility_scope = 'organization'
WHERE id IN (
  SELECT DISTINCT contact_id
  FROM business_accounts
  WHERE contact_id IS NOT NULL
)
AND visibility_scope != 'organization';
```

**Pros**:

- ✅ Keeps private contacts feature
- ✅ Prevents future issues
- ✅ Clear error messages
- ✅ Database-level enforcement

**Cons**:

- ❌ More complex logic
- ❌ Users must manually change visibility before linking
- ❌ Doesn't solve "what if I want private contact linked to supplier?"
- ❌ Requires data cleanup migration

---

### Option C: Visibility Inheritance (MOST COMPLEX)

**NOT RECOMMENDED** - Adds significant complexity for marginal benefit.

---

## Phase 4: Multiple Contacts per Business Account (Week 3-4)

### Priority: MEDIUM

**Current Issue**: `business_accounts.contact_id` only allows ONE contact per business
**Real Need**: Companies have multiple contacts (CEO, Sales, Support, etc.)

### Solution A: Junction Table (RECOMMENDED)

#### 4.A.1 Database Schema

```sql
-- Migration: 20251109000000_add_business_account_contacts_junction.sql

CREATE TABLE business_account_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_account_id UUID NOT NULL REFERENCES business_accounts(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,

  role TEXT,  -- "primary", "billing", "technical", etc.
  is_primary BOOLEAN DEFAULT false,
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  UNIQUE(business_account_id, contact_id)
);

CREATE INDEX idx_biz_acct_contacts_business ON business_account_contacts(business_account_id);
CREATE INDEX idx_biz_acct_contacts_contact ON business_account_contacts(contact_id);

-- Enable RLS
ALTER TABLE business_account_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "business_account_contacts_access" ON business_account_contacts
  FOR ALL TO authenticated
  USING (
    business_account_id IN (
      SELECT id FROM business_accounts
      WHERE organization_id IN (
        SELECT org_id FROM public.get_user_organizations(auth.uid())
      )
    )
  );

-- Migrate existing data
INSERT INTO business_account_contacts (business_account_id, contact_id, is_primary)
SELECT id, contact_id, true
FROM business_accounts
WHERE contact_id IS NOT NULL;

-- Drop old column
ALTER TABLE business_accounts DROP COLUMN contact_id;
```

#### 4.A.2 Update Types

```typescript
export interface BusinessAccountContact {
  id: string;
  business_account_id: string;
  contact_id: string;
  role?: string;
  is_primary: boolean;
  notes?: string;
  contact?: Contact; // Joined data
}

export interface BusinessAccountWithContacts extends BusinessAccount {
  contacts?: BusinessAccountContact[];
}
```

#### 4.A.3 Update Service

```typescript
async getBusinessAccountById(accountId: string): Promise<BusinessAccountWithContacts | null> {
  const { data, error } = await this.supabase
    .from("business_accounts")
    .select(`
      *,
      contacts:business_account_contacts(
        *,
        contact:contacts(*)
      )
    `)
    .eq("id", accountId)
    .single();

  return data;
}
```

#### 4.A.4 Update UI

- Show list of contacts per business account
- Mark primary contact
- Add/remove contacts from business account
- Assign roles to contacts

---

## Phase 5: Enhanced Features (Week 4+)

### Priority: LOW

### 5.1 Audit Trail

- Track who linked/unlinked contacts
- Log visibility scope changes
- Record contact modifications

### 5.2 Bulk Operations

- Bulk update contact visibility
- Bulk link contacts to business accounts
- Export contacts with their linked accounts

### 5.3 Contact Deduplication

- Find duplicate contacts by email/phone
- Merge duplicate contacts
- Consolidate business account links

---

## Implementation Timeline

| Phase       | Duration | Deliverables                           |
| ----------- | -------- | -------------------------------------- |
| **Phase 1** | 2-3 days | Security fixes, RLS policies           |
| **Phase 2** | 3-4 days | UI fixes, remove entity_type refs      |
| **Phase 3** | 5-7 days | Choose & implement visibility approach |
| **Phase 4** | 5-7 days | Multiple contacts per business account |
| **Phase 5** | Ongoing  | Enhanced features                      |

**Total Estimated Time**: 3-4 weeks for Phases 1-4

---

## Testing Requirements

### Phase 1 Tests

- [ ] User cannot access contacts from other organizations
- [ ] Private contacts only visible to owner
- [ ] Branch contacts only visible to branch members
- [ ] Organization contacts visible to all org members
- [ ] Direct URL access to contact respects visibility

### Phase 2 Tests

- [ ] Contact detail page displays without errors
- [ ] Contact list filters work correctly
- [ ] No console errors about missing fields

### Phase 3 Tests (Option A)

- [ ] All org contacts visible to all org users
- [ ] Contacts linked to business accounts display correctly
- [ ] No orphaned relationships

### Phase 3 Tests (Option B)

- [ ] Cannot link private contact to business account
- [ ] Clear error message shown
- [ ] Can link after changing to organization scope

### Phase 4 Tests

- [ ] Can add multiple contacts to business account
- [ ] Can mark primary contact
- [ ] Can assign roles
- [ ] Can remove contacts

---

## Migration Path

### For Existing Data

1. **Audit Current State**

```sql
-- Count contacts by visibility scope
SELECT visibility_scope, COUNT(*)
FROM contacts
WHERE deleted_at IS NULL
GROUP BY visibility_scope;

-- Find contacts linked to business accounts
SELECT c.visibility_scope, COUNT(DISTINCT ba.id) as linked_business_accounts
FROM contacts c
JOIN business_accounts ba ON ba.contact_id = c.id
WHERE c.deleted_at IS NULL AND ba.deleted_at IS NULL
GROUP BY c.visibility_scope;
```

2. **If Choosing Option A (Remove Visibility)**

```sql
-- No data migration needed, just drop columns
-- All existing contacts become organization-scoped
```

3. **If Choosing Option B (Enforce Compatibility)**

```sql
-- Upgrade all linked contacts to organization scope
UPDATE contacts
SET
  visibility_scope = 'organization',
  owner_user_id = NULL,
  branch_id = NULL
WHERE id IN (
  SELECT DISTINCT contact_id
  FROM business_accounts
  WHERE contact_id IS NOT NULL AND deleted_at IS NULL
);
```

---

## Rollback Plans

### Phase 1 Rollback

```sql
-- Revert to permissive policies (NOT RECOMMENDED)
DROP POLICY contacts_select_policy ON contacts;
CREATE POLICY contacts_select_policy ON contacts
  FOR SELECT TO authenticated USING (true);
```

### Phase 3 Rollback (If Option A)

```sql
-- Restore visibility columns
ALTER TABLE contacts
  ADD COLUMN visibility_scope TEXT DEFAULT 'organization',
  ADD COLUMN owner_user_id UUID REFERENCES auth.users(id),
  ADD COLUMN branch_id UUID REFERENCES branches(id);
```

---

## Recommendation

**I STRONGLY RECOMMEND Option A (Remove Visibility Scope)**

**Reasons**:

1. **Simplicity**: Fewer edge cases, easier to understand
2. **Business Logic**: Contacts are meant for businesses, not personal use
3. **No Orphaned Relationships**: Can't create incompatible links
4. **Maintainability**: Less code, fewer bugs
5. **Performance**: Simpler queries, better performance

**If personal contacts are needed**, create a SEPARATE feature:

- `personal_contacts` table (user_id, name, email, phone, notes)
- Completely separate from business contacts
- No linking to business accounts
- Simple user-scoped access

This separation makes the purpose and access control crystal clear.

---

## Next Steps

1. **Review this plan** with team/stakeholders
2. **Choose visibility approach** (Option A vs B)
3. **Create tracking issues** for each phase
4. **Implement Phase 1** (security fixes) immediately
5. **Implement Phase 2** (UI fixes) concurrently
6. **Schedule Phase 3** implementation
7. **Plan Phase 4** based on Phase 3 outcome

---

## Questions to Answer Before Proceeding

1. **Do users need private contacts that can't be seen by organization?**
   - If YES → Option B
   - If NO → Option A

2. **Should multiple people manage the same contact?**
   - Affects ownership model

3. **Do branches need isolated contact lists?**
   - Affects branch-level visibility

4. **Is there a use case for linking private contact to public business?**
   - If YES, need inheritance model (complex)
   - If NO, validation model works (Option B)

---

**Document Version**: 1.0
**Last Updated**: 2025-11-07
**Author**: Claude (AI Assistant)
**Status**: DRAFT - Pending Review
