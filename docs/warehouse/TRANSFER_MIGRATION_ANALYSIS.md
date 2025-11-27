# Transfer Migrations Analysis

**Date:** November 27, 2025
**Status:** CRITICAL ISSUES FOUND - DO NOT APPLY OLD MIGRATIONS

---

## Executive Summary

The existing transfer migration files (dated July 2025) are **OUTDATED and INCOMPATIBLE** with the current system requirements. They must be rewritten before implementation.

### Critical Issues Found:

1. ❌ **Wrong Status Values** - Uses outdated status workflow
2. ❌ **Missing Required Fields** - Lacks essential columns for modern workflow
3. ❌ **Wrong References** - Uses `product_variant_id` instead of current structure
4. ❌ **Missing Foreign Keys** - No proper relationships with required tables
5. ❌ **Incompatible with Reservations System** - Cannot integrate with current reservations
6. ❌ **No Integration with Movement Types** - Missing movement_type_code field

---

## Analysis Details

### 1. Current Database State (What EXISTS)

**transfer_requests table** (already exists):

```
- id (uuid, PK)
- organization_id (uuid, NOT NULL)
- from_branch_id (uuid, NOT NULL)
- to_branch_id (uuid, NOT NULL)
- status (text, NOT NULL) - CHECK: 'pending', 'accepted', 'rejected', 'cancelled', 'completed'
- requires_confirmation (boolean, NOT NULL, default true)
- requested_by (uuid, nullable)
- reviewed_by (uuid, nullable)
- reviewed_at (timestamptz, nullable)
- comment (text, nullable)
- created_at (timestamptz, default now())
```

**transfer_request_items table** (already exists):

```
- id (uuid, PK)
- transfer_request_id (uuid, NOT NULL, FK to transfer_requests)
- product_variant_id (uuid, NOT NULL) ❌ PROBLEM
- quantity (numeric, NOT NULL)
- unit_id (uuid, NOT NULL) ❌ PROBLEM
- from_location_id (uuid, nullable)
- to_location_id (uuid, nullable)
- comment (text, nullable)
- created_at (timestamptz, default now())
```

**stock_movements table**:

- ❌ **Missing** `transfer_request_id` column

---

### 2. What Specification Requires (Modern System)

According to [WAREHOUSE_IMPLEMENTATION_STATUS_AND_NEXT_STEPS.md](WAREHOUSE_IMPLEMENTATION_STATUS_AND_NEXT_STEPS.md) and [REMAINING_MOVEMENTS_IMPLEMENTATION_PLAN.md](REMAINING_MOVEMENTS_IMPLEMENTATION_PLAN.md):

**Required Workflow States:**

```
draft → pending → approved → in_transit → completed
```

**Current Schema Has:**

```
pending, accepted, rejected, cancelled, completed
```

❌ **MISMATCH**: Missing `draft`, `approved`, `in_transit` states

**Required Fields (missing):**

- `transfer_number` - Document number (TR/YYYY/MM/NNNN)
- `priority` - normal/high/urgent
- `expected_date` - Expected delivery date
- `shipped_at` - Timestamp when shipped
- `received_at` - Timestamp when received
- `shipping_method` - How it's being shipped
- `carrier` - Shipping carrier
- `tracking_number` - Tracking info
- `approved_by` - Who approved (currently `reviewed_by`)
- `approved_at` - When approved (currently `reviewed_at`)
- `shipped_by` - Who marked as shipped
- `received_by` - Who received
- `notes` - General notes (currently `comment`)
- `metadata` - JSONB for extensibility

---

### 3. Schema Compatibility Issues

#### Issue #1: Product Reference Structure ❌

**Current Migration Uses:**

```sql
product_variant_id uuid NOT NULL
```

**Current System Structure:**

- `products` table exists
- `product_variants` table exists
- But system should reference `product_id` + optional `variant_id` (nullable)

**Movements system pattern:**

```typescript
// From stock_movements table
product_id: uuid NOT NULL
variant_id: uuid NULL
```

#### Issue #2: Unit Reference ❌

**Current Migration:**

```sql
unit_id uuid NOT NULL references units(id)
```

**Problem:** Units are stored on products, not as separate IDs in movements.

**Correct Pattern:**

- Reference product to get unit
- Unit stored in `products.unit` field (text)
- No separate `unit_id` in movement items

#### Issue #3: Foreign Key Constraints ❌

**Missing Constraints:**

- No FK for `organization_id` → `organizations(id)`
- No FK for `from_branch_id` → `branches(id)`
- No FK for `to_branch_id` → `branches(id)`
- No FK for `requested_by` → `users(id)`
- No FK for `from_location_id` → `locations(id)`
- No FK for `to_location_id` → `locations(id)`
- No FK for `product_variant_id` → `product_variants(id)` (wrong anyway)

#### Issue #4: Reservation Integration ❌

**Missing Integration:**

- No way to link transfers with stock reservations
- Current reservations system uses:
  - `stock_reservations` table
  - `stock_movements` with codes 501-502
- Transfer should create reservation on approval

**Required Fields:**

- `reservation_id` or relationship tracking
- Integration with movement types 501-502

#### Issue #5: Movement Type Integration ❌

**Missing:**

- No `movement_type_code` field
- Transfers should automatically create movements:
  - **301**: Transfer Out (source)
  - **302**: Transfer In (destination)
  - **303**: Intra-Location Move
  - **311**: Inter-Branch Out
  - **312**: Inter-Branch In

**Current:** No connection to movement types system

---

## Recommended Action Plan

### Phase 1: Create New Migration (DO NOT use old ones)

**File:** `supabase/migrations/[timestamp]_enhance_transfer_system.sql`

```sql
-- 1. Add missing columns to transfer_requests
ALTER TABLE transfer_requests
  ADD COLUMN IF NOT EXISTS transfer_number TEXT,
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal' CHECK (priority IN ('normal', 'high', 'urgent')),
  ADD COLUMN IF NOT EXISTS expected_date DATE,
  ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shipping_method TEXT,
  ADD COLUMN IF NOT EXISTS carrier TEXT,
  ADD COLUMN IF NOT EXISTS tracking_number TEXT,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shipped_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS received_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 2. Update status check constraint to include modern workflow
ALTER TABLE transfer_requests
  DROP CONSTRAINT IF EXISTS transfer_requests_status_check;

ALTER TABLE transfer_requests
  ADD CONSTRAINT transfer_requests_status_check
  CHECK (status IN ('draft', 'pending', 'approved', 'in_transit', 'completed', 'cancelled', 'rejected'));

-- 3. Add missing foreign keys
ALTER TABLE transfer_requests
  ADD CONSTRAINT transfer_requests_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  ADD CONSTRAINT transfer_requests_from_branch_id_fkey
    FOREIGN KEY (from_branch_id) REFERENCES branches(id) ON DELETE RESTRICT,
  ADD CONSTRAINT transfer_requests_to_branch_id_fkey
    FOREIGN KEY (to_branch_id) REFERENCES branches(id) ON DELETE RESTRICT,
  ADD CONSTRAINT transfer_requests_requested_by_fkey
    FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL,
  ADD CONSTRAINT transfer_requests_reviewed_by_fkey
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL;

-- 4. Fix transfer_request_items structure
ALTER TABLE transfer_request_items
  DROP COLUMN IF EXISTS product_variant_id,
  DROP COLUMN IF EXISTS unit_id,
  ADD COLUMN IF NOT EXISTS product_id UUID NOT NULL REFERENCES products(id),
  ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES product_variants(id),
  ADD COLUMN IF NOT EXISTS received_quantity NUMERIC DEFAULT 0 CHECK (received_quantity >= 0),
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_transit', 'completed')),
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- 5. Add foreign keys for locations
ALTER TABLE transfer_request_items
  ADD CONSTRAINT transfer_request_items_from_location_id_fkey
    FOREIGN KEY (from_location_id) REFERENCES locations(id) ON DELETE RESTRICT,
  ADD CONSTRAINT transfer_request_items_to_location_id_fkey
    FOREIGN KEY (to_location_id) REFERENCES locations(id) ON DELETE RESTRICT;

-- 6. Add transfer_request_id to stock_movements
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS transfer_request_id UUID REFERENCES transfer_requests(id) ON DELETE SET NULL;

-- 7. Create unique constraint for transfer numbers
ALTER TABLE transfer_requests
  ADD CONSTRAINT transfer_requests_transfer_number_unique
  UNIQUE (organization_id, branch_id, transfer_number);

-- 8. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_transfer_requests_org_branch
  ON transfer_requests(organization_id, from_branch_id);

CREATE INDEX IF NOT EXISTS idx_transfer_requests_status
  ON transfer_requests(status);

CREATE INDEX IF NOT EXISTS idx_transfer_requests_expected_date
  ON transfer_requests(expected_date);

CREATE INDEX IF NOT EXISTS idx_transfer_request_items_product
  ON transfer_request_items(product_id, variant_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_transfer
  ON stock_movements(transfer_request_id) WHERE transfer_request_id IS NOT NULL;

-- 9. Create function to auto-generate transfer numbers
CREATE OR REPLACE FUNCTION generate_transfer_number(
  p_org_id UUID,
  p_branch_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
) RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_year TEXT;
  v_seq_name TEXT;
  v_next_num INTEGER;
BEGIN
  v_year := TO_CHAR(p_date, 'YYYY');
  v_seq_name := format('seq_transfer_%s_%s', v_year, REPLACE(p_branch_id::TEXT, '-', '_'));

  EXECUTE format('CREATE SEQUENCE IF NOT EXISTS %I', v_seq_name);
  EXECUTE format('SELECT nextval(%L)', v_seq_name) INTO v_next_num;

  RETURN format('TR-%s-%s', v_year, LPAD(v_next_num::TEXT, 6, '0'));
END;
$$;

-- 10. Create trigger to auto-generate transfer number
CREATE OR REPLACE FUNCTION auto_generate_transfer_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.transfer_number IS NULL OR NEW.transfer_number = '' THEN
    NEW.transfer_number := generate_transfer_number(
      NEW.organization_id,
      NEW.from_branch_id,
      COALESCE(NEW.created_at::DATE, CURRENT_DATE)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER before_insert_transfer_request
  BEFORE INSERT ON transfer_requests
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_transfer_number();
```

### Phase 2: Data Migration (if needed)

If there's existing data in the tables:

```sql
-- Migrate old status values to new workflow
UPDATE transfer_requests
SET status = CASE
  WHEN status = 'accepted' THEN 'approved'
  WHEN status = 'pending' THEN 'pending'
  WHEN status = 'rejected' THEN 'rejected'
  WHEN status = 'cancelled' THEN 'cancelled'
  WHEN status = 'completed' THEN 'completed'
  ELSE 'pending'
END
WHERE status IN ('accepted', 'pending', 'rejected', 'cancelled', 'completed');

-- Copy reviewed_by to approved_by
UPDATE transfer_requests
SET approved_by = reviewed_by,
    approved_at = reviewed_at
WHERE reviewed_by IS NOT NULL;

-- Copy comment to notes
UPDATE transfer_requests
SET notes = comment
WHERE comment IS NOT NULL;
```

---

## Conclusion

**DO NOT APPLY** the old migration files. They are fundamentally incompatible with:

1. Current workflow requirements (draft → pending → approved → in_transit → completed)
2. Current product/variant structure
3. Current reservations system
4. Current movement types system (301-312)
5. Required audit fields and tracking

**MUST CREATE NEW MIGRATION** that:

- ✅ Enhances existing tables (don't recreate)
- ✅ Uses correct status workflow
- ✅ Properly references products (product_id + variant_id)
- ✅ Removes unit_id (use product's unit)
- ✅ Adds all required fields for modern workflow
- ✅ Integrates with movement types
- ✅ Supports reservations
- ✅ Has proper foreign keys and constraints

---

**Next Steps:**

1. Review and approve this new migration approach
2. Create new migration file with enhancements
3. Test on development database
4. Verify all FK constraints work
5. Proceed with transfer service implementation

**Estimated Time:** 1 day for migration + testing
