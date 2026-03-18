---
title: "Warehouse Basics"
slug: "warehouse-basics"
lang: "en"
version: "1.0"
lastUpdated: "2025-11-26"
tags: ["warehouse", "inventory", "basics", "concepts"]
category: "user-guide"
difficulty: "beginner"
audience: ["warehouse-staff", "managers"]
status: "published"
author: "AmbraWMS Team"
estimatedReadTime: 8
prerequisites: ["getting-started"]
related: ["stock-movements"]
---

# Warehouse Basics

Understanding core warehouse concepts is essential for effective inventory management in AmbraWMS.

## Branch = Warehouse

In AmbraWMS, **each branch represents a physical warehouse**. This is enforced at the database level:

- Each branch has its own inventory
- Stock levels are tracked per branch
- Movements occur within or between branches

## Location Hierarchy

Locations organize your warehouse space:

```
Warehouse (Branch)
  └── Zone A
       ├── Aisle 1
       │    ├── Shelf A1-1
       │    └── Shelf A1-2
       └── Aisle 2
            └── Shelf A2-1
```

### Location Features

- **3-level hierarchy** - Organize space logically
- **QR codes** - Each location can have a QR code
- **Color coding** - Visual organization with colors
- **Icons** - Custom icons for location types

## Stock Calculations

AmbraWMS tracks three key stock metrics:

### On Hand

Total physical quantity in the warehouse.

### Reserved

Quantity allocated to sales orders or other commitments.

### Available

Stock available for new orders:

```
Available = On Hand - Reserved
```

## Movement Types

Stock movements use SAP-style numeric codes:

### Receipts (100s)

- **101** - Goods Receipt from Purchase Order
- **102** - Goods Receipt from Production
- **103** - Goods Receipt (Return from Customer)

### Issues (200s)

- **201** - Goods Issue for Sales Order
- **202** - Goods Issue (Return to Supplier)
- **261** - Goods Issue for Production

### Transfers (300s)

- **301** - Transfer Posting (Location to Location)
- **305** - Transfer Posting (Branch to Branch)

### Adjustments (400s)

- **401** - Inventory Increase (Count Correction)
- **402** - Inventory Decrease (Count Correction)
- **411** - Physical Inventory Adjustment

## Per-Warehouse Settings

Each product can have different settings per warehouse:

- **Reorder Point** - When to reorder
- **Min Stock** - Minimum safe stock level
- **Max Stock** - Maximum storage capacity
- **Lead Time** - Days to receive after ordering
- **Preferred Supplier** - Default supplier for this warehouse

## Stock Alerts

The system monitors inventory automatically:

- 🔴 **Critical** - Stock below 25% of reorder point
- 🟡 **Low** - Stock below reorder point
- 🟢 **Normal** - Stock above reorder point

## Polish Document Types

AmbraWMS supports Polish warehouse documents:

- **PZ** - Przyjęcie zewnętrzne (External Receipt)
- **WZ** - Wydanie zewnętrzne (External Issue)
- **MM** - Przesunięcie magazynowe (Transfer)
- **RW** - Rozchód wewnętrzny (Internal Issue)
- **PW** - Przyjęcie wewnętrzne (Internal Receipt)

## Best Practices

1. **Organize Locations Logically** - Use clear naming conventions
2. **Set Reorder Points** - Prevent stockouts
3. **Use QR Codes** - Speed up receiving and picking
4. **Regular Audits** - Schedule periodic inventory counts
5. **Document Everything** - Always create movements for changes

## Next Steps

- Learn about [Stock Movements](/docs/spec/stock-movements)
- Explore [Location Management](#)
- Understand [Inventory Audits](#)

---

_Updated: November 26, 2025_
