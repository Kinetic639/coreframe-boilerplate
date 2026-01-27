# Warehouse Management Implementation Plan

## Overview

This document outlines the step-by-step implementation plan for building a comprehensive warehouse management system that leverages the existing `stock_movements` and `movement_types` infrastructure. Each feature will be implemented as a separate Pull Request to ensure code quality and incremental delivery.

## Current System Analysis

### Existing Database Tables

- ✅ `stock_movements` - Complete movement tracking with product variants
- ✅ `movement_types` - Predefined movement types (purchase_in, transfers, adjustments, etc.)
- ✅ `product_stock_locations` - Current stock levels (needs to be calculated, not hardcoded)
- ✅ `suppliers` - Supplier management
- ✅ `locations` - Warehouse location hierarchy
- ✅ `products` & `product_variants` - Product catalog with variants

### Architecture Principle

**All stock quantities will be calculated in real-time from `stock_movements` table, never hardcoded.**

---

## Implementation Phases

### Phase 1: Database Foundation (Weeks 1-2)

#### PR #1: Database Triggers for Stock Calculation

**Branch**: `feature/stock-calculation-triggers`
**Scope**: Database layer only
**Files to create/modify**:

- `supabase/migrations/[timestamp]_stock_calculation_triggers.sql`
- `docs/database/stock-calculation-system.md`

**Implementation Details**:

1. Create function `calculate_stock_at_location(product_variant_id, location_id)`
2. Create function `calculate_total_stock_for_product(product_id)`
3. Create trigger on `stock_movements` table to auto-update `product_stock_locations`
4. Add database indexes for performance optimization
5. Migration to verify existing data integrity

**Acceptance Criteria**:

- [ ] Stock levels are automatically calculated from movements
- [ ] Triggers update `product_stock_locations.quantity` on movement changes
- [ ] Performance tests show acceptable query times
- [ ] Data integrity verification passes

---

#### PR #2: Enhanced Activity System

**Branch**: `feature/activity-system`
**Scope**: Database + basic API
**Files to create/modify**:

- `supabase/migrations/[timestamp]_activity_system.sql`
- `src/modules/warehouse/api/activities.ts`
- `supabase/types/types.ts` (regenerate)

**Implementation Details**:

1. Create `activities` table for universal activity logging
2. Create `activity_movements` junction table
3. Create TypeScript types and API service
4. Basic activity logging functions

**Database Schema**:

```sql
activities:
  - id (uuid, PK)
  - organization_id (uuid, FK)
  - branch_id (uuid, FK)
  - activity_type (enum: delivery, audit, correction, transfer, manual)
  - entity_type (enum: product, location, delivery, movement)
  - entity_id (uuid)
  - user_id (uuid, FK)
  - description (text)
  - metadata (jsonb)
  - created_at (timestamp)

activity_movements:
  - activity_id (uuid, FK to activities)
  - movement_id (uuid, FK to stock_movements)
```

**Acceptance Criteria**:

- [ ] Activity system can log all warehouse operations
- [ ] Activities are linked to stock movements
- [ ] API service provides CRUD operations
- [ ] TypeScript types are generated and working

---

### Phase 2: Scanning Infrastructure (Weeks 3-4)

#### PR #3: Barcode Scanning Infrastructure

**Branch**: `feature/barcode-scanning`
**Scope**: Frontend scanning system
**Files to create/modify**:

- `src/hooks/useBarcodeScanner.ts`
- `src/components/scanning/BarcodeScanner.tsx`
- `src/components/scanning/ScannerDialog.tsx`
- `src/utils/barcode-validation.ts`
- `package.json` (add scanning libraries)

**Implementation Details**:

1. Install camera/barcode scanning library (e.g., `@zxing/library`)
2. Create reusable barcode scanner hook
3. Build mobile-optimized scanner components
4. Implement barcode validation and product lookup
5. Add scanning permissions and error handling

**Acceptance Criteria**:

- [ ] Camera scanning works on mobile devices
- [ ] Barcode formats are properly validated
- [ ] Product lookup by barcode/SKU functions
- [ ] UI provides clear feedback for scan results
- [ ] Offline scanning capabilities implemented

---

#### PR #4: QR Code Generation for Locations

**Branch**: `feature/location-qr-codes`
**Scope**: QR code system for locations
**Files to create/modify**:

- `src/utils/qr-code-generator.ts`
- `src/components/locations/LocationQRCode.tsx`
- `src/modules/warehouse/locations/components/QRCodeDialog.tsx`
- `supabase/migrations/[timestamp]_location_qr_data.sql`

**Implementation Details**:

1. Install QR code generation library
2. Create QR code generator utility
3. Add QR code display to location management
4. Implement QR code scanning for location identification
5. Add QR code data to locations table (optional field)

**Acceptance Criteria**:

- [ ] QR codes generated for all locations
- [ ] QR codes contain proper location identification data
- [ ] QR scanning identifies locations correctly
- [ ] Integration with location management interface
- [ ] Print-friendly QR code formats

---

### Phase 3: Delivery Management (Weeks 5-6)

#### PR #5: Delivery Database Schema

**Branch**: `feature/delivery-schema`
**Scope**: Database schema for deliveries
**Files to create/modify**:

- `supabase/migrations/[timestamp]_delivery_tables.sql`
- `supabase/types/types.ts` (regenerate)

**Implementation Details**:

1. Create `deliveries` table
2. Create `delivery_line_items` table
3. Create `delivery_stock_movements` junction table
4. Add proper foreign key relationships
5. Create indexes for performance

**Database Schema**:

```sql
deliveries:
  - id (uuid, PK)
  - delivery_number (text, unique)
  - supplier_id (uuid, FK to suppliers)
  - branch_id (uuid, FK to branches)
  - expected_delivery_date (timestamp)
  - actual_delivery_date (timestamp)
  - status (enum: pending, in_transit, delivered, processing, completed)
  - notes (text)
  - created_by (uuid, FK to users)
  - created_at/updated_at/deleted_at

delivery_line_items:
  - id (uuid, PK)
  - delivery_id (uuid, FK to deliveries)
  - product_variant_id (uuid, FK to product_variants)
  - expected_quantity (numeric)
  - unit_price (decimal)
  - notes (text)

delivery_stock_movements:
  - delivery_id (uuid, FK to deliveries)
  - stock_movement_id (uuid, FK to stock_movements)
  - line_item_id (uuid, FK to delivery_line_items)
```

**Acceptance Criteria**:

- [ ] All delivery tables created with proper relationships
- [ ] Database constraints ensure data integrity
- [ ] TypeScript types generated correctly
- [ ] Indexes optimize query performance

---

#### PR #6: Delivery API Service

**Branch**: `feature/delivery-api`
**Scope**: API layer for delivery management
**Files to create/modify**:

- `src/modules/warehouse/deliveries/api.ts`
- `src/modules/warehouse/deliveries/types.ts`
- `src/modules/warehouse/deliveries/utils.ts`

**Implementation Details**:

1. Create `DeliveryService` class with full CRUD operations
2. Implement delivery creation and management
3. Create delivery processing workflow
4. Integration with stock movements system
5. Activity logging for all delivery operations

**Key Methods**:

- `createDelivery()`
- `getDeliveriesByBranch()`
- `getDeliveryById()`
- `updateDeliveryStatus()`
- `processDeliveryItems()`
- `generateDeliveryReport()`

**Acceptance Criteria**:

- [ ] Full CRUD operations for deliveries
- [ ] Integration with movement system
- [ ] Activity logging implemented
- [ ] Error handling and validation
- [ ] TypeScript interfaces complete

---

### Phase 4: Delivery UI (Weeks 7-8)

#### PR #7: Delivery Management Interface

**Branch**: `feature/delivery-ui`
**Scope**: Desktop delivery management UI
**Files to create/modify**:

- `src/app/[locale]/dashboard/warehouse/suppliers/deliveries/page.tsx`
- `src/app/[locale]/dashboard/warehouse/suppliers/deliveries/new/page.tsx`
- `src/app/[locale]/dashboard/warehouse/suppliers/deliveries/[id]/page.tsx`
- `src/modules/warehouse/deliveries/components/DeliveryCard.tsx`
- `src/modules/warehouse/deliveries/components/DeliveryTable.tsx`
- `src/modules/warehouse/deliveries/components/DeliveryFilters.tsx`
- `src/modules/warehouse/deliveries/components/NewDeliveryDialog.tsx`

**Implementation Details**:

1. Create delivery list page with filtering
2. Build delivery details page
3. Implement new delivery creation form
4. Add delivery status management
5. Integration with existing UI patterns

**Acceptance Criteria**:

- [ ] Delivery list with filtering and pagination
- [ ] Delivery creation form with validation
- [ ] Delivery details view with status tracking
- [ ] Mobile-responsive design
- [ ] Integration with warehouse module navigation

---

#### PR #8: Mobile Receiving Interface

**Branch**: `feature/mobile-receiving`
**Scope**: Mobile-optimized delivery receiving
**Files to create/modify**:

- `src/app/[locale]/dashboard/warehouse/suppliers/deliveries/[id]/receive/page.tsx`
- `src/modules/warehouse/deliveries/components/MobileReceivingInterface.tsx`
- `src/modules/warehouse/deliveries/components/ItemReceivingCard.tsx`
- `src/modules/warehouse/deliveries/components/QuantityInput.tsx`

**Implementation Details**:

1. Build mobile-first receiving interface
2. Integrate barcode and QR scanning
3. Touch-friendly quantity input
4. Real-time stock updates
5. Offline capability with sync

**Acceptance Criteria**:

- [ ] Mobile-optimized receiving workflow
- [ ] Barcode scanning for product identification
- [ ] QR scanning for location selection
- [ ] Real-time stock level updates
- [ ] Offline functionality with background sync

---

### Phase 5: Analytics & Advanced Features (Weeks 9-10)

#### PR #9: Movement Analytics

**Branch**: `feature/movement-analytics`
**Scope**: Analytics based on movement data
**Files to create/modify**:

- `src/modules/warehouse/analytics/api.ts`
- `src/modules/warehouse/analytics/components/StockTrendsChart.tsx`
- `src/modules/warehouse/analytics/components/MovementFrequencyChart.tsx`
- `src/modules/warehouse/analytics/components/SupplierPerformance.tsx`
- `src/app/[locale]/dashboard/warehouse/analytics/page.tsx`

**Implementation Details**:

1. Create analytics API service
2. Build stock trend analysis
3. Movement frequency reporting
4. Supplier delivery performance metrics
5. Interactive charts and dashboards

**Acceptance Criteria**:

- [ ] Stock level trends over time
- [ ] Movement frequency analysis
- [ ] Supplier performance metrics
- [ ] Interactive charts with filtering
- [ ] Export capabilities for reports

---

#### PR #10: Advanced Delivery Features

**Branch**: `feature/delivery-enhancements`
**Scope**: Advanced delivery functionality
**Files to create/modify**:

- `src/modules/warehouse/deliveries/components/DeliveryNotifications.tsx`
- `src/modules/warehouse/deliveries/components/BatchReceiving.tsx`
- `src/modules/warehouse/deliveries/components/DeliveryDocuments.tsx`
- `src/utils/notifications/delivery-notifications.ts`

**Implementation Details**:

1. Push notifications for delivery arrivals
2. Batch receiving capabilities
3. Document attachment system
4. Advanced delivery reporting
5. Integration improvements

**Acceptance Criteria**:

- [ ] Push notifications for delivery events
- [ ] Batch processing of multiple deliveries
- [ ] Document attachment and management
- [ ] Advanced reporting features
- [ ] Performance optimizations

---

## Pull Request Guidelines

### PR Creation Checklist

- [ ] Feature branch created from `main`
- [ ] All tests passing
- [ ] TypeScript compilation successful
- [ ] ESLint and Prettier checks passed
- [ ] Database migrations tested
- [ ] Documentation updated
- [ ] Mobile responsiveness verified

### PR Review Process

1. **Self Review**: Creator reviews their own code
2. **Technical Review**: Focus on code quality, architecture, performance
3. **Functional Review**: Test all features work as expected
4. **Mobile Testing**: Verify mobile functionality
5. **Database Review**: Validate migration safety and performance

### Merge Requirements

- [ ] All CI checks passing
- [ ] At least 1 technical approval
- [ ] Mobile testing completed
- [ ] Database migration reviewed
- [ ] Documentation updated

## Testing Strategy

### Per PR Testing

- Unit tests for all new functions
- Integration tests for API endpoints
- Component tests for UI elements
- Database migration tests
- Mobile device testing

### End-to-End Testing

- Complete delivery workflow testing
- Scanning functionality verification
- Stock calculation accuracy
- Performance benchmarking

## Documentation Updates

### Files to Maintain

- `README.md` - Update with new features
- `CLAUDE.md` - Add delivery module documentation
- Database schema documentation
- API documentation
- Mobile usage guidelines

---

## Success Metrics

### Technical Metrics

- Database query performance (<200ms for stock calculations)
- Mobile app responsiveness (<100ms for scanning)
- Data accuracy (100% stock calculation accuracy)
- Test coverage (>90% for new code)

### Business Metrics

- Delivery processing time reduction
- Stock accuracy improvement
- User adoption of mobile features
- Error reduction in receiving process

---

This implementation plan ensures that each feature is delivered incrementally with proper testing and review, maintaining code quality while building toward a comprehensive warehouse management solution.
