---
title: "AI Assistant Context"
slug: "ai-context"
lang: "en"
version: "1.0"
lastUpdated: "2025-11-26"
purpose: "Provide context for Claude/ChatGPT when helping users"
status: "published"
---

# AI Assistant Context

This document provides essential context for AI assistants (Claude, ChatGPT, etc.) when helping users with AmbraWMS.

## System Overview

- **Application Name:** AmbraWMS (Warehouse Management System)
- **Tech Stack:** Next.js 15, Supabase, TypeScript, Tailwind CSS, shadcn/ui
- **Primary Language:** Polish (PL)
- **Secondary Language:** English (EN)
- **Database:** PostgreSQL via Supabase
- **Authentication:** Supabase Auth with role-based access control (RBAC)

## Key Architectural Concepts

### Multi-Tenancy Structure

- **Organization** - Top-level tenant (company/business)
- **Branch** - Physical warehouse location within organization
- **Location** - Storage bin/shelf/rack within a branch (warehouse)

### Critical Warehouse Concepts

- **Branch = Warehouse** (enforced at database level)
- **Location = Bin/Shelf** (storage position within warehouse)
- **Movement Types:** SAP-style numeric codes (101-613)
  - 101-105: Receipts
  - 201-206: Issues
  - 301-312: Transfers
  - 401-411: Adjustments
  - 501-502: Reservations
  - 601-613: E-commerce integration

### Stock Management

- **On-Hand Quantity:** Physical stock in warehouse
- **Reserved Quantity:** Stock allocated to orders
- **Available Quantity:** `on_hand - reserved` (can be sold)
- **Reorder Point:** Threshold that triggers low stock alert
- **Min/Max Levels:** Per-warehouse inventory thresholds

## Current Implementation Status

### ✅ Fully Operational (65% Complete)

- Stock movements (receipts, issues, adjustments)
- Sales orders with automatic reservations
- Purchase orders with supplier management
- Stock alerts and low stock monitoring
- Per-warehouse inventory settings
- Real-time inventory calculations

### 🚨 Critical Gaps

1. **Warehouse Transfers** - DISABLED (cannot move stock between locations)
2. **PDF Document Generation** - MISSING (Polish legal requirement)
3. **Returns Processing** - MISSING (customer service essential)
4. **Row-Level Security** - DISABLED (security risk)

**See:** `/docs/spec/warehouse/implementation-status/en.md` for complete status

## Module Structure

The application uses a modular architecture:

- **home** - Dashboard and news
- **warehouse** - Complete WMS functionality
- **teams** - Collaboration and communication
- **organization-management** - Admin controls
- **support** - Help and feedback
- **documentation** - This knowledge center

Each module has:

- `config.ts` - Routes, widgets, permissions
- Dedicated pages in `/src/app/[locale]/dashboard/[module]/`
- Translations in `/messages/[lang].json`

## Common User Questions

### "How do I receive a delivery?"

1. Navigate to Warehouse → Movements
2. Click "New Movement"
3. Select movement type 101 (Goods Receipt from PO)
4. Select purchase order
5. Enter received quantities
6. Approve and complete

### "Why can't I sell more stock?"

Stock reservations prevent overselling. Check:

- Available quantity (on-hand minus reserved)
- Active sales orders with reservations
- Movement type 501 records

### "How do I set reorder points?"

1. Go to product details
2. Click "Branch Settings" tab
3. Configure per-warehouse:
   - Reorder point
   - Min/Max levels
   - Lead time
   - Safety stock

### "What are movement types?"

SAP-style numeric codes (101-613) that categorize inventory operations:

- **101** - Receipt from supplier
- **201** - Issue for sale
- **301-312** - Transfers (currently disabled)
- **401-403** - Adjustments
- **501-502** - Reservations

## Polish Compliance

### Required Documents

- **PZ** (Przyjęcie Zewnętrzne) - External Receipt
- **WZ** (Wydanie Zewnętrzne) - External Issue
- **MM** (Międzymagazynowe) - Transfer
- **RW** (Rozchód Wewnętrzny) - Internal Issue
- **INW** (Inwentaryzacja) - Inventory Count
- **KP/KN** (Korekta) - Corrections

**Status:** Document data ready, PDF generation not yet implemented

### JPK_MAG Export

XML export for Polish Ministry of Finance - not yet implemented.

## Documentation Structure

```
/docs/
  /user      - End-user guides
  /dev       - Developer documentation
  /internal  - Business processes
  /spec      - Technical specifications
  /api       - API documentation
  /meta      - System documentation (this file)
```

## Useful File Locations

### Warehouse Module

- **Services:** `/src/modules/warehouse/api/`
- **Types:** `/src/modules/warehouse/types/`
- **Pages:** `/src/app/[locale]/dashboard/warehouse/`
- **Migrations:** `/supabase/migrations/`

### Documentation

- **Specs:** `/docs/spec/warehouse/`
- **Status:** `/docs/warehouse/WAREHOUSE_IMPLEMENTATION_STATUS_AND_NEXT_STEPS.md`

## Role-Based Access

### Roles

- `org_admin` - Organization administrator
- `branch_admin` - Warehouse manager
- `warehouse_manager` - Warehouse supervisor
- `warehouse_operator` - Warehouse staff
- `warehouse_clerk` - View-only warehouse access
- `developer` - System developer

### Permission Scopes

- **organization** - Access across all warehouses
- **branch** - Access to specific warehouse only

## Development Guidelines

### Before Implementing Features

1. Check existing documentation in `/docs/spec/`
2. Verify current implementation status
3. Use Context7 MCP for library documentation
4. Follow existing patterns in codebase
5. Always use shadcn/ui components first

### Security Requirements

- Validate permissions server-side
- Check RLS policies (currently disabled)
- Use `public.authorize()` for database-level validation
- Never bypass permission checks

### Code Quality

- Run `npm run type-check` before committing
- Run `npm run lint` to check code quality
- Format with `npm run format`
- Follow TypeScript strict mode

## Common Development Patterns

### Server Actions

```typescript
"use server";

export async function createMovement(data: CreateMovementData) {
  const hasPermission = await checkPermission("warehouse.movements.create");
  if (!hasPermission) {
    throw new Error("Insufficient permissions");
  }
  // Implementation
}
```

### Using Translations

```typescript
import { useTranslations } from "next-intl";

const t = useTranslations("warehouse.movements");
return <h1>{t("title")}</h1>;
```

### Toast Notifications

```typescript
import { toast } from "react-toastify";

toast.success("Operation completed");
toast.error("Something went wrong");
```

## Getting Help

- **User Questions:** Use inline help widgets in UI
- **Developer Questions:** See `/docs/dev/`
- **Specifications:** See `/docs/spec/`
- **AI Context:** This file

## When to Update This File

Update this AI context when:

- Major features are added
- System architecture changes
- New modules are created
- Important business logic changes
- Common user questions emerge

---

**Last Updated:** November 26, 2025
**Maintained By:** Development Team
**Version:** 1.0
