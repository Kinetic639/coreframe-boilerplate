# How to Add RLS for a New Table

**Purpose**: Step-by-step checklist for adding Row Level Security to new tables in the Permission System V2.

**Use this every time you introduce a new table.** It's written for the V2 model: `organization_members` + compiled `user_effective_permissions` + `is_org_member()` + `has_permission()`.

---

## Table of Contents

1. [Step 0: Decide the Data Model First](#0-decide-the-data-model-first)
2. [Step 1: Create Permissions (Only If Needed)](#1-create-permissions-only-if-needed)
3. [Step 2: Add Helper Functions If Needed](#2-add-helper-functions-if-your-table-needs-special-logic)
4. [Step 3: Enable RLS and Lock Down Defaults](#3-enable-rls-and-lock-down-defaults)
5. [Step 4: Write Policies Using the Correct Pattern](#4-write-policies-using-the-correct-pattern)
6. [Step 5: Prevent Privilege Escalation](#5-prevent-privilege-escalation-via-insertupdate)
7. [Step 6: Add Indexes for RLS Performance](#6-add-indexes-needed-for-rls-performance)
8. [Step 7: Test the RLS](#7-test-the-rls-real-tests-not-vibes)
9. [Step 8: Frontend Integration](#8-frontend-integration-checklist)
10. [Step 9: Final Pre-Merge Checklist](#9-final-pre-merge-checklist)
11. [Complete Example: Products Table](#complete-example-products-table)

---

## 0) Decide the Data Model First

Before writing any RLS policies, answer these questions about your table:

### Checklist

- [ ] **Is this table org-owned?** (most are)
  - If **yes** → add `organization_id UUID NOT NULL REFERENCES organizations(id)`

- [ ] **Is this table branch-scoped?** (only exists within a branch)
  - If **yes** → add `branch_id UUID NOT NULL REFERENCES branches(id)` (and ensure branch belongs to org)

- [ ] **Is this row user-owned/private sometimes?**
  - If **yes** → add `created_by UUID NOT NULL DEFAULT auth.uid()` and `is_private BOOLEAN DEFAULT false` (or similar)

- [ ] **Do you need soft delete?**
  - If **yes** → add `deleted_at TIMESTAMPTZ NULL` and make policies ignore deleted rows by default

### Example Table Structure

```sql
CREATE TABLE products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id       UUID REFERENCES branches(id) ON DELETE CASCADE,  -- Optional
  created_by      UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),

  -- Your business columns
  name            TEXT NOT NULL,
  sku             TEXT,
  price           DECIMAL(10,2),

  -- Metadata
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  deleted_at      TIMESTAMPTZ  -- Soft delete
);
```

---

## 1) Create Permissions (Only If Needed)

### Rule of Thumb

| Scenario                      | Need Permission?                                   |
| ----------------------------- | -------------------------------------------------- |
| Everyone in org can read      | ❌ No `*.read` permission (membership-only SELECT) |
| Only certain roles can read   | ✅ Yes, add `*.read` permission                    |
| Writes (create/update/delete) | ✅ Almost always require permissions               |
| Sensitive data reads          | ✅ Always require permissions                      |

### Checklist

- [ ] **Define the permission slugs** you'll need (use consistent naming):

  ```
  module.entity.read
  module.entity.create
  module.entity.update
  module.entity.delete
  module.entity.manage  (optional: admin super-permission)
  ```

- [ ] **Insert into `permissions` table**:

  ```sql
  INSERT INTO permissions (slug, category, action, description) VALUES
  ('warehouse.products.read', 'warehouse', 'read', 'View products'),
  ('warehouse.products.create', 'warehouse', 'create', 'Create products'),
  ('warehouse.products.update', 'warehouse', 'update', 'Update products'),
  ('warehouse.products.delete', 'warehouse', 'delete', 'Delete products');
  ```

- [ ] **Add to role bundles** via `role_permissions`:

  ```sql
  -- Give org_owner all permissions
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id
  FROM roles r, permissions p
  WHERE r.name = 'org_owner' AND p.slug LIKE 'warehouse.products.%';

  -- Give org_member read-only
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id
  FROM roles r, permissions p
  WHERE r.name = 'org_member' AND p.slug = 'warehouse.products.read';
  ```

- [ ] **Confirm recompilation triggers** exist and will run (the `role_permissions` trigger handles this automatically)

---

## 2) Add Helper Functions If Your Table Needs Special Logic

### Already Available Functions

You already have these (no need to create):

| Function                                                    | Purpose                               |
| ----------------------------------------------------------- | ------------------------------------- |
| `is_org_member(org_id)`                                     | Check if user is active member of org |
| `has_permission(org_id, permission_slug)`                   | Check if user has specific permission |
| `has_branch_permission(org_id, branch_id, permission_slug)` | (Future) Branch-level permissions     |

### Checklist

- [ ] If you need **"private vs public" logic**, decide the rule and express it in SQL inside RLS, not in app code.

- [ ] If you need **cross-table ownership checks** (e.g., branch belongs to org), write a helper:

```sql
CREATE OR REPLACE FUNCTION is_branch_in_org(p_branch_id UUID, p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.branches
    WHERE id = p_branch_id
      AND organization_id = p_org_id
      AND deleted_at IS NULL
  );
$$;
```

---

## 3) Enable RLS and Lock Down Defaults

### Checklist

- [ ] **Enable RLS**:

  ```sql
  ALTER TABLE products ENABLE ROW LEVEL SECURITY;
  ```

- [ ] **Force RLS even for table owner** (highly recommended in multi-tenant):

  ```sql
  ALTER TABLE products FORCE ROW LEVEL SECURITY;
  ```

- [ ] **Do NOT** add permissive "all authenticated can do X" policies by accident

- [ ] **Verify** there is no policy that implicitly grants access you didn't intend

### Why FORCE ROW LEVEL SECURITY?

Without `FORCE`, the table owner (usually the `postgres` role or your migration role) bypasses all RLS. In multi-tenant apps, this can lead to accidental data leaks if service-role queries aren't careful.

---

## 4) Write Policies Using the Correct Pattern

### Pattern A — Org-Readable, Permission-Written (Most Common)

**Use when**: All org members can read rows, but writes require specific permissions.

**Good for**: `branches`, `products`, `orders`, `settings`, most business tables.

#### SELECT Policy (Membership Boundary)

```sql
CREATE POLICY "products_select_member"
ON products
FOR SELECT
USING (is_org_member(organization_id));
```

#### INSERT Policy (Permission Required)

```sql
CREATE POLICY "products_insert_permission"
ON products
FOR INSERT
WITH CHECK (
  is_org_member(organization_id)
  AND has_permission(organization_id, 'warehouse.products.create')
);
```

#### UPDATE Policy

```sql
CREATE POLICY "products_update_permission"
ON products
FOR UPDATE
USING (
  is_org_member(organization_id)
  AND has_permission(organization_id, 'warehouse.products.update')
)
WITH CHECK (
  is_org_member(organization_id)
  AND has_permission(organization_id, 'warehouse.products.update')
);
```

#### DELETE Policy

```sql
CREATE POLICY "products_delete_permission"
ON products
FOR DELETE
USING (
  is_org_member(organization_id)
  AND has_permission(organization_id, 'warehouse.products.delete')
);
```

> **Note**: Use `USING` for "can target these rows", `WITH CHECK` for "can write this resulting row".

---

### Pattern B — Private Rows (Owner Manages Private; Admins Manage Public)

**Use when**: Rows can be private (only creator sees) or public (org-wide).

**Good for**: `contacts`, `drafts`, `notes`, `personal_configs`.

#### SELECT Policy

```sql
CREATE POLICY "contacts_select"
ON contacts
FOR SELECT
USING (
  is_org_member(organization_id)
  AND (
    is_private = false
    OR created_by = auth.uid()
  )
);
```

#### INSERT Policy

```sql
CREATE POLICY "contacts_insert"
ON contacts
FOR INSERT
WITH CHECK (
  is_org_member(organization_id)
  -- Optional: force new contacts to be private
  -- AND is_private = true
);
```

#### UPDATE Policy (Owner Edits Private; Admin Edits All)

```sql
CREATE POLICY "contacts_update"
ON contacts
FOR UPDATE
USING (
  is_org_member(organization_id)
  AND (
    (created_by = auth.uid() AND is_private = true)
    OR has_permission(organization_id, 'contacts.manage')
  )
)
WITH CHECK (
  is_org_member(organization_id)
  AND (
    has_permission(organization_id, 'contacts.manage')
    OR (created_by = auth.uid() AND is_private = true)
  )
);
```

#### DELETE Policy

```sql
CREATE POLICY "contacts_delete"
ON contacts
FOR DELETE
USING (
  has_permission(organization_id, 'contacts.manage')
);
```

#### Optional: Prevent Non-Admin from Flipping Private → Public

Add a trigger or enforce via `WITH CHECK` logic:

```sql
-- In WITH CHECK, prevent non-admins from making public
WITH CHECK (
  is_org_member(organization_id)
  AND (
    -- Admin can do anything
    has_permission(organization_id, 'contacts.manage')
    OR (
      -- Non-admin: can only edit if private AND stays private
      created_by = auth.uid()
      AND is_private = true
    )
  )
);
```

---

### Pattern C — Branch-Scoped Rows

**Use when**: Table has `branch_id` and data belongs to a specific branch.

**Good for**: `branch_settings`, `branch_inventory`, `branch_schedules`.

#### SELECT Policy

```sql
CREATE POLICY "branch_settings_select"
ON branch_settings
FOR SELECT
USING (
  is_org_member(organization_id)
  -- Optionally also check branch membership if you support it
);
```

#### Write Policies

```sql
CREATE POLICY "branch_settings_insert"
ON branch_settings
FOR INSERT
WITH CHECK (
  is_org_member(organization_id)
  AND has_permission(organization_id, 'branch_settings.create')
);
```

#### When You Add Branch-Scoped Compiled Permissions

Replace/extend with:

```sql
WITH CHECK (
  is_org_member(organization_id)
  AND has_branch_permission(organization_id, branch_id, 'branch_settings.create')
);
```

---

### Pattern D — Sensitive Data (Permission-Gated Reads)

**Use when**: Even reads require permission (not all members should see).

**Good for**: `billing_events`, `audit_logs`, `financial_reports`, `salaries`.

#### SELECT Policy

```sql
CREATE POLICY "billing_select_permission"
ON billing_events
FOR SELECT
USING (
  is_org_member(organization_id)
  AND has_permission(organization_id, 'billing.read')
);
```

---

## 5) Prevent Privilege Escalation via INSERT/UPDATE

**This is where most "looks fine" RLS systems get broken.**

### Checklist

- [ ] **Can a user set `organization_id` to an org they're not in?**
  - → Block with `is_org_member(organization_id)` in `WITH CHECK`

- [ ] **Can a user change `created_by`?**
  - → Block it! Best: `created_by DEFAULT auth.uid()` + trigger to forbid updates

- [ ] **Can a user change `organization_id` or `branch_id` on update?**
  - → Block it! Either disallow at app level AND enforce in DB with `WITH CHECK`

- [ ] **If table has `is_private`, can a non-admin make things public?**
  - → Decide explicitly and enforce

### Recommended: Immutable Columns Trigger

Add a trigger that prevents updates to immutable columns:

```sql
CREATE OR REPLACE FUNCTION prevent_immutable_column_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'Cannot change organization_id';
  END IF;

  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Cannot change created_by';
  END IF;

  -- Add more columns as needed
  -- IF NEW.branch_id IS DISTINCT FROM OLD.branch_id THEN
  --   RAISE EXCEPTION 'Cannot change branch_id';
  -- END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_products_immutable
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION prevent_immutable_column_update();
```

---

## 6) Add Indexes Needed for RLS Performance

RLS can become slow if the predicates can't use indexes.

### Checklist

- [ ] **Index `organization_id`** on the new table:

  ```sql
  CREATE INDEX idx_products_org ON products(organization_id);
  ```

- [ ] **If you filter often**, add compound index:

  ```sql
  CREATE INDEX idx_products_org_created ON products(organization_id, created_at);
  ```

- [ ] **If using private ownership checks**:

  ```sql
  CREATE INDEX idx_products_org_owner_private
  ON products(organization_id, created_by, is_private);
  ```

- [ ] **Verify** `user_effective_permissions` already has the needed index:
  ```sql
  -- Should already exist:
  -- (user_id, organization_id, permission_slug)
  ```

### Performance Note

RLS policies run on **every row**. Without proper indexes, a simple `SELECT * FROM products WHERE ...` could become a full table scan for permission checks.

---

## 7) Test the RLS (Real Tests, Not Vibes)

### Checklist

- [ ] **Create two users**: A and B

- [ ] **Put both in same org** as members

- [ ] **Verify**:
  - [ ] A can read allowed rows
  - [ ] A cannot read B's private rows (if applicable)
  - [ ] A cannot insert without permission (if required)
  - [ ] A cannot update/delete without permission

- [ ] **Put B in different org**

- [ ] **Verify complete isolation** (no rows leak between orgs)

- [ ] **Test with direct Supabase client** (simulate attacker frontend)

### Test Script Template

```typescript
// Test as User A (has permission)
const { data: products, error } = await supabaseAsUserA
  .from("products")
  .select("*")
  .eq("organization_id", orgId);

// Should return products
expect(products).not.toBeNull();
expect(error).toBeNull();

// Test as User B (different org)
const { data: leaked, error: leakError } = await supabaseAsUserB
  .from("products")
  .select("*")
  .eq("organization_id", orgId); // A's org

// Should return empty (not error, just no rows)
expect(leaked).toEqual([]);

// Test unauthorized write
const { error: writeError } = await supabaseAsUserA
  .from("products")
  .insert({ name: "Test", organization_id: differentOrgId });

// Should fail
expect(writeError).not.toBeNull();
```

---

## 8) Frontend Integration Checklist

### Checklist

- [ ] **UI uses `usePermissions().can('<slug>')` only for UX** (show/hide buttons)

- [ ] **Frontend handles RLS rejections gracefully**:
  - Show "Access denied" / "You don't have permission"
  - Don't crash on empty results

- [ ] **Never assume permission based on client state alone**

- [ ] **After role/override changes, refresh permissions snapshot**

### Example Component

```tsx
function ProductsPage() {
  const { can, cannot } = usePermissions();

  // UX: Show access denied page
  if (cannot("warehouse.products.read")) {
    return <AccessDenied message="You don't have access to products" />;
  }

  return (
    <div>
      <ProductList />

      {/* UX: Hide button if no permission */}
      {can("warehouse.products.create") && <Button onClick={handleCreate}>Add Product</Button>}
    </div>
  );
}
```

---

## 9) Final Pre-Merge Checklist

Copy/paste this into your PR description:

```markdown
## RLS Checklist for [Table Name]

### Data Model

- [ ] Table has `organization_id` (and `branch_id` if needed)
- [ ] Immutable columns protected (`organization_id`, `created_by`)

### RLS Configuration

- [ ] `ENABLE ROW LEVEL SECURITY` applied
- [ ] `FORCE ROW LEVEL SECURITY` applied (recommended)

### Policies

- [ ] SELECT policy defined (membership-only or permission-gated)
- [ ] INSERT policy requires membership + permission
- [ ] UPDATE policy requires membership + permission (USING + WITH CHECK)
- [ ] DELETE policy requires membership + permission

### Security

- [ ] No privilege escalation via `organization_id`, `created_by`, etc.
- [ ] Private/public logic enforced (if applicable)

### Performance

- [ ] Indexes added for RLS predicates

### Permissions

- [ ] Permission slugs added to `permissions` table
- [ ] Permissions assigned to roles
- [ ] Compilation trigger verified

### Testing

- [ ] Tested with 2 users in same org
- [ ] Tested with 2 users in different orgs (isolation)
- [ ] Tested unauthorized writes blocked
```

---

## Complete Example: Products Table

Here's a complete migration for a new `products` table with proper RLS:

```sql
-- ============================================
-- Migration: Add products table with RLS
-- ============================================

-- Step 1: Create the table
CREATE TABLE products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id       UUID REFERENCES branches(id) ON DELETE SET NULL,
  created_by      UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),

  name            TEXT NOT NULL,
  sku             TEXT,
  description     TEXT,
  price           DECIMAL(10,2),
  quantity        INTEGER DEFAULT 0,

  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

-- Step 2: Add indexes
CREATE INDEX idx_products_org ON products(organization_id);
CREATE INDEX idx_products_org_branch ON products(organization_id, branch_id);
CREATE INDEX idx_products_org_created ON products(organization_id, created_at DESC);

-- Step 3: Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE products FORCE ROW LEVEL SECURITY;

-- Step 4: Add permissions (if they don't exist)
INSERT INTO permissions (slug, category, action, description)
VALUES
  ('warehouse.products.read', 'warehouse', 'read', 'View products'),
  ('warehouse.products.create', 'warehouse', 'create', 'Create products'),
  ('warehouse.products.update', 'warehouse', 'update', 'Update products'),
  ('warehouse.products.delete', 'warehouse', 'delete', 'Delete products')
ON CONFLICT (slug) DO NOTHING;

-- Step 5: Assign to roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'org_owner'
  AND p.slug LIKE 'warehouse.products.%'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'org_member'
  AND p.slug = 'warehouse.products.read'
ON CONFLICT DO NOTHING;

-- Step 6: Create RLS policies

-- SELECT: All org members can read
CREATE POLICY "products_select_member"
ON products
FOR SELECT
USING (
  is_org_member(organization_id)
  AND deleted_at IS NULL
);

-- INSERT: Requires permission
CREATE POLICY "products_insert_permission"
ON products
FOR INSERT
WITH CHECK (
  is_org_member(organization_id)
  AND has_permission(organization_id, 'warehouse.products.create')
);

-- UPDATE: Requires permission
CREATE POLICY "products_update_permission"
ON products
FOR UPDATE
USING (
  is_org_member(organization_id)
  AND has_permission(organization_id, 'warehouse.products.update')
  AND deleted_at IS NULL
)
WITH CHECK (
  is_org_member(organization_id)
  AND has_permission(organization_id, 'warehouse.products.update')
);

-- DELETE (soft): Requires permission
CREATE POLICY "products_softdelete_permission"
ON products
FOR UPDATE
USING (
  is_org_member(organization_id)
  AND has_permission(organization_id, 'warehouse.products.delete')
  AND deleted_at IS NULL
)
WITH CHECK (
  deleted_at IS NOT NULL
);

-- Step 7: Prevent immutable column updates
CREATE OR REPLACE FUNCTION prevent_products_immutable_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'Cannot change organization_id';
  END IF;
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Cannot change created_by';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_products_immutable
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION prevent_products_immutable_update();

-- Step 8: Auto-update updated_at
CREATE OR REPLACE FUNCTION update_products_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_products_updated_at();
```

---

## Quick Reference Card

### Policy Patterns Summary

| Pattern              | SELECT                                | INSERT                               | UPDATE                               | DELETE                               |
| -------------------- | ------------------------------------- | ------------------------------------ | ------------------------------------ | ------------------------------------ |
| **A: Org-readable**  | `is_org_member()`                     | `is_org_member() + has_permission()` | `is_org_member() + has_permission()` | `is_org_member() + has_permission()` |
| **B: Private rows**  | `is_org_member() + (public OR owner)` | `is_org_member()`                    | `owner OR has_permission()`          | `has_permission()`                   |
| **C: Branch-scoped** | `is_org_member()`                     | `+ has_branch_permission()`          | `+ has_branch_permission()`          | `+ has_branch_permission()`          |
| **D: Sensitive**     | `is_org_member() + has_permission()`  | `+ has_permission()`                 | `+ has_permission()`                 | `+ has_permission()`                 |

### Permission Naming Convention

```
{module}.{entity}.{action}

Examples:
- warehouse.products.read
- warehouse.products.create
- warehouse.products.update
- warehouse.products.delete
- warehouse.products.manage  (optional super-permission)
```

### Standard Actions

| Action   | Meaning               |
| -------- | --------------------- |
| `read`   | View/list             |
| `create` | Create new            |
| `update` | Modify existing       |
| `delete` | Remove (soft or hard) |
| `manage` | Full control (admin)  |

---

**Document Version**: 1.0
**Created**: 2026-01-21
**Purpose**: Step-by-step guide for adding RLS to new tables
