# Contacts Module Implementation Progress

## Status: In Progress (Backend Complete, UI Pending)

---

## ✅ Completed Tasks

### 1. Database Schema ✅

- **Migration created**: `20251106000000_add_contacts_visibility_scope.sql`
- **Applied to remote database**: ✅
- **Changes**:
  - Added `visibility_scope` column (private, branch, organization)
  - Added `owner_user_id` column for private contacts
  - Added `branch_id` column for branch-scoped contacts
  - Updated `contact_type` enum to: contact, lead, other (removed customer, vendor)
  - Added indexes for performance
  - Set default visibility to 'organization'

### 2. TypeScript Types ✅

- **File**: `src/modules/contacts/types/index.ts`
- **Updates**:
  - Added `VisibilityScope` type
  - Updated `ContactType` to: "contact" | "lead" | "other"
  - Added visibility fields to `ContactFormData`
  - Created `VISIBILITY_SCOPES` constant array
  - Updated `CONTACT_TYPES` to match new schema
  - Added `visibility_scope` to `ContactFilters`

### 3. Backend Service ✅

- **File**: `src/modules/contacts/api/contacts-service.ts`
- **Updates**:
  - Updated `getContacts()` to accept userId and userBranchId
  - Added visibility scope filtering logic
  - Updated `createContact()` to set owner_user_id and branch_id based on scope
  - Updated `searchContacts()` with scope filtering
  - Updated `getContactsByType()` with new parameters
  - Removed `getVendors()` and `getCustomers()` (they're separate entities)

### 4. State Management ✅

- **File**: `src/lib/stores/contacts-store.ts`
- **Updates**:
  - Updated `loadContacts()` to fetch user context (userId, branchId)
  - Passes user context to service methods
  - Integrated with app store for branch information

### 5. Module Configuration ✅

- **File Created**: `src/modules/contacts/config.ts`
- **Content**:
  - Module ID: "contacts"
  - Icon: Users
  - Color: #3b82f6 (blue)
  - Routes defined: /contacts, /contacts/[id]
  - Menu item configured
  - Permissions: user role with branch scope

### 6. Module Registration ✅

- **File**: `src/modules/index.ts`
- **Changes**:
  - Imported contactsModule
  - Added to allModulesConfig array
  - Set as free tier (always available)
  - Module will appear in sidebar automatically

---

## 🚧 Pending Tasks

### 7. Update Contact Form ⏳

- **File**: `src/modules/contacts/components/contact-form.tsx`
- **TODO**:
  - Add visibility_scope to default values
  - Update form submission to use new service signature (userId, branchId)

### 8. Update Basic Info Tab ⏳

- **File**: `src/modules/contacts/components/contact-form-tabs/basic-info-tab.tsx`
- **TODO**:
  - Add visibility scope Select field
  - Display description for each scope option
  - Set proper validation

### 9. Update Clients List View ⏳

- **File**: `src/modules/contacts/components/clients-list-view.tsx`
- **TODO**:
  - Update `handleCreateContact()` to pass userId and branchId
  - Fix service method calls

### 10. Create Contacts List View Component ⏳

- **File**: `src/modules/contacts/components/contacts-list-view.tsx`
- **TODO**:
  - Create main contacts list view
  - Add filters: search, visibility scope, entity type
  - Add create contact button
  - Use ContactsTable component
  - Handle pagination

### 11. Create Contacts Table Component ⏳

- **File**: `src/modules/contacts/components/contacts-table.tsx`
- **TODO**:
  - Display contacts in table format
  - Columns: Name, Type, Visibility Scope, Email, Phone, Actions
  - Add badges for scope and entity type
  - View/Edit/Delete actions per row

### 12. Create Contacts List Page ⏳

- **File**: `src/app/[locale]/dashboard/contacts/page.tsx`
- **TODO**:
  - Create Next.js page route
  - Import and render ContactsListView component

### 13. Create Contact Detail View Component ⏳

- **File**: `src/modules/contacts/components/contact-detail-view.tsx`
- **TODO**:
  - Display contact overview
  - Show visibility scope badge
  - Display addresses
  - Display contact persons
  - Display notes
  - Edit/Delete actions
  - Handle soft delete with confirmation

### 14. Create Contact Detail Page ⏳

- **File**: `src/app/[locale]/dashboard/contacts/[id]/page.tsx`
- **TODO**:
  - Create Next.js dynamic route
  - Import and render ContactDetailView component

### 15. Add Translations ⏳

- **Files**: `messages/en.json`, `messages/pl.json`
- **TODO**:
  - Add contacts module translations
  - Add visibility scope labels and descriptions
  - Add filter labels
  - Add action labels
  - Add message labels (success, error, confirmation)

### 16. Testing ⏳

- **TODO**:
  - Test create contact with each visibility scope
  - Test private contacts (only owner sees)
  - Test branch contacts (branch members see)
  - Test organization contacts (all members see)
  - Test edit contact
  - Test soft delete
  - Test filters and search
  - Test pagination
  - Test contact persons management
  - Test addresses management

---

## 📝 Implementation Notes

### Visibility Scope Logic

**Private Contacts**:

- `visibility_scope = 'private'`
- `owner_user_id` must be set to current user
- Only visible to the owner

**Branch Contacts**:

- `visibility_scope = 'branch'`
- `branch_id` must be set to user's active branch
- Visible to all members of that branch

**Organization Contacts**:

- `visibility_scope = 'organization'`
- No owner_user_id or branch_id needed
- Visible to all organization members

### Database Query Pattern

```typescript
// Visibility filtering in getContacts()
const visibilityClauses = [
  "visibility_scope.eq.organization", // Everyone sees org-wide
  `and(visibility_scope.eq.branch,branch_id.eq.${userBranchId})`, // Branch members see branch
  `and(visibility_scope.eq.private,owner_user_id.eq.${userId})`, // Owner sees private
];
query = query.or(visibilityClauses.join(","));
```

### Service Method Signatures

```typescript
// Old
getContacts(organizationId, filters, page, pageSize);

// New
getContacts(organizationId, userId, userBranchId, filters, page, pageSize);

// Old
createContact(organizationId, contactData, addresses, persons);

// New
createContact(organizationId, userId, branchId, contactData, addresses, persons);
```

### Contact Types

**Old** (removed):

- customer
- vendor
- employee

**New**:

- contact (default - general personal/professional contact)
- lead (potential client/lead)
- other (other contact types)

**Note**: Customers and Vendors are now separate entities (suppliers table, customers table to be created). Contacts are for general personal/professional network management.

---

## 🎯 Next Steps

1. **Update contact form components** (form.tsx and basic-info-tab.tsx)
2. **Create ContactsListView and ContactsTable components**
3. **Create page routes** (/dashboard/contacts, /dashboard/contacts/[id])
4. **Add translations**
5. **Test all functionality**

---

## 🔗 Related Files

### Backend

- `supabase/migrations/20251106000000_add_contacts_visibility_scope.sql`
- `src/modules/contacts/api/contacts-service.ts`
- `src/modules/contacts/types/index.ts`
- `src/lib/stores/contacts-store.ts`

### Configuration

- `src/modules/contacts/config.ts`
- `src/modules/index.ts`

### UI Components (to be created/updated)

- `src/modules/contacts/components/contact-form.tsx`
- `src/modules/contacts/components/contact-form-tabs/basic-info-tab.tsx`
- `src/modules/contacts/components/contacts-list-view.tsx` (new)
- `src/modules/contacts/components/contacts-table.tsx` (new)
- `src/modules/contacts/components/contact-detail-view.tsx` (new)
- `src/modules/contacts/components/clients-list-view.tsx`

### Routes (to be created)

- `src/app/[locale]/dashboard/contacts/page.tsx` (new)
- `src/app/[locale]/dashboard/contacts/[id]/page.tsx` (new)

### Translations

- `messages/en.json`
- `messages/pl.json`

---

## ⚠️ Important Notes

1. **DO NOT modify suppliers or clients implementations** - Focus only on contacts module
2. **Soft delete only** - All deletes use `deleted_at`, no cascade deletes
3. **Visibility scope is mandatory** - All contacts must have a visibility scope
4. **User context required** - All service methods need userId and branchId
5. **Contact types changed** - No more customer/vendor in contacts table

---

## 📊 Progress Summary

**Overall Progress**: 55% Complete

- ✅ Backend & Database: 100% Complete
- ✅ Module Configuration: 100% Complete
- ⏳ UI Components: 10% Complete
- ⏳ Page Routes: 0% Complete
- ⏳ Translations: 0% Complete
- ⏳ Testing: 0% Complete

**Estimated Time Remaining**: 4-6 hours
