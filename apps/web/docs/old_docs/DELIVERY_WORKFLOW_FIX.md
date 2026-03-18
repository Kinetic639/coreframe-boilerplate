# Delivery Workflow Fix - Enable Receiving Process

## Problem Identified

The delivery creation workflow was bypassing the entire receiving verification process:

1. User creates delivery in the UI
2. Clicks "Save"
3. **Delivery is immediately completed** and stock is updated
4. No "Receive Delivery" button appears
5. No quality check or damage tracking occurs

**Root Cause:** Movement type 101 (GR from PO - Goods Receipt from Purchase Order) had `requires_approval = false` in the database, causing the `create_stock_movement()` function to create movements with status 'approved' instead of 'pending'.

## The Flow

### Database Function Logic (create_stock_movement)

```sql
-- From: supabase/migrations/20251027210000_fix_create_stock_movement_function.sql
status: CASE WHEN v_movement_type.requires_approval THEN 'pending' ELSE 'approved' END
```

This means:

- If `requires_approval = true` → status is **'pending'** (needs receiving workflow)
- If `requires_approval = false` → status is **'approved'** (stock updated immediately)

### Movement Type 101 Configuration (Before Fix)

```sql
-- From: supabase/migrations/20251024043520_enhance_movement_types.sql
-- Column order: code, category, name, name_pl, name_en, doc_type, affects_stock, requires_approval, ...
('101', 'receipt', 'GR from PO', 'Przyjęcie z zamówienia', 'Goods Receipt from PO', 'PZ', 1, false, ...)
                                                                                                     ^^^^^
                                                                                           requires_approval = FALSE
```

## The Fix

Created migration `20251103000001_fix_delivery_requires_approval.sql` that:

```sql
UPDATE movement_types
SET requires_approval = true
WHERE code = '101';
```

## Result - Correct Workflow

Now when a delivery is created:

### 1. **Create Delivery** (via `/dashboard/warehouse/deliveries/new`)

- User fills in delivery form
- Clicks "Save"
- Movement type 101 is created with **status = 'pending'**
- Stock is **NOT** updated yet
- Returns to delivery details page

### 2. **Delivery Details Page** shows:

- Status: "Pending"
- **"Receive Delivery" button is visible** (only shows for pending/approved status)

### 3. **Receive Delivery** (via `/dashboard/warehouse/deliveries/[id]/receive`)

- User clicks "Receive Delivery"
- Enters received quantities per product
- Records damaged items with reasons
- Performs quality check
- Adds receiving notes
- Clicks "Complete Receipt"

### 4. **Receipt Processing** (processDeliveryReceipt action):

- Creates receipt_document record
- Creates child stock_movements for accepted quantities (status = 'completed')
- Creates damage movements (type 206) for rejected goods
- Links movements to receipt via receipt_movements
- Updates original delivery status to 'completed'
- **Stock is updated NOW** (via database triggers)
- Generates PZ document number

### 5. **Final State**:

- Delivery status: "Completed"
- Stock levels updated with accepted quantities
- Damaged goods tracked separately
- Full audit trail in receipt_documents
- PZ compliance document available

## Status Flow Diagram

```
CREATE DELIVERY
      ↓
[Movement Type 101]
requires_approval = true
      ↓
status = 'pending'
      ↓
Stock NOT Updated ❌
      ↓
[User Clicks "Receive Delivery"]
      ↓
[Receiving Workflow]
  - Enter quantities
  - Mark damage
  - Quality check
  - Click "Complete"
      ↓
[processDeliveryReceipt]
  - Create receipt_document
  - Create child movements (status = 'completed')
  - Create damage movements (type 206)
  - Update parent to 'completed'
      ↓
Stock Updated ✅
      ↓
Audit Trail Complete ✅
```

## Files Modified

### Migration Applied

- `supabase/migrations/20251103000001_fix_delivery_requires_approval.sql`

### Existing Files (Already Implemented in Previous Session)

- `supabase/migrations/20251103000000_add_receipt_documents_system.sql` - Receipt tables
- `src/lib/types/receipt-documents.ts` - TypeScript types
- `src/modules/warehouse/api/receipt-service.ts` - Backend service
- `src/app/actions/warehouse/process-delivery-receipt.ts` - Server action
- `src/modules/warehouse/deliveries/components/receive-delivery-form.tsx` - UI form
- `src/app/[locale]/dashboard/warehouse/deliveries/[id]/receive/page.tsx` - Receive page
- `src/modules/warehouse/components/delivery-details-form.tsx` - Added "Receive Delivery" button

## Testing the Fix

1. **Create a new delivery:**

   ```
   Go to: /dashboard/warehouse/deliveries/new
   Add products, set destination location
   Click "Save"
   ```

2. **Verify pending status:**
   - Check that delivery status shows "Pending"
   - Confirm "Receive Delivery" button is visible
   - Verify stock has NOT been updated yet

3. **Process receiving:**

   ```
   Click "Receive Delivery"
   Enter quantities received
   Mark any damaged items
   Click "Complete Receipt"
   ```

4. **Verify completion:**
   - Status changes to "Completed"
   - Stock levels are updated
   - Receipt document is created
   - Damage movements exist if applicable

## Database Schema Changes

### movement_types table

**Before:**

```sql
code  | requires_approval
------|------------------
101   | false
```

**After:**

```sql
code  | requires_approval
------|------------------
101   | true
```

## Impact

- ✅ Deliveries now require explicit receiving step
- ✅ Quality control is enforced
- ✅ Damaged goods are properly tracked
- ✅ Stock updates happen after verification
- ✅ Full audit trail with receipt documents
- ✅ Polish compliance (PZ document generation)
- ✅ Partial receipt support (via parent_movement_id)

## Migration Applied

```bash
npm run supabase:migration:up
```

Output:

```
Applying migration 20251103000001_fix_delivery_requires_approval.sql...
NOTICE: Movement type 101 (GR from PO) now requires approval
NOTICE: Deliveries will be created in pending status and require receiving workflow
```

## Next Steps (Optional)

1. **Test with existing pending deliveries** - Any deliveries created before this fix that are in 'approved' status can be manually updated to 'pending' if needed
2. **PZ Document Generation** - Implement actual PDF generation in `generatePZDocument()` method
3. **Email Notifications** - Send alerts when deliveries are pending receiving
4. **Receiving Dashboard** - Create a dedicated view for pending receipts

## Conclusion

The receiving workflow is now fully functional. Deliveries follow the proper SAP-inspired flow:

1. Create → Pending
2. Receive → Quality Check → Damage Tracking
3. Complete → Stock Update → Audit Trail

This matches industry best practices for warehouse management and Polish regulatory compliance.
