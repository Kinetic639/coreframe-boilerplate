---
title: "Locations Management Guide"
slug: "locations-guide"
lang: "en"
version: "1.0"
lastUpdated: "2025-11-26"
tags: ["locations", "warehouse", "organization", "qr-codes"]
category: "user-guide"
difficulty: "beginner"
audience: ["warehouse-staff", "managers"]
status: "published"
author: "AmbraWMS Team"
estimatedReadTime: 8
prerequisites: ["getting-started"]
related: ["warehouse-basics", "products-guide"]
---

# Locations Management Guide

Master warehouse organization with AmbraWMS location management. Learn how to create, organize, and optimize your storage space for maximum efficiency.

## Understanding Locations

Locations are the physical storage areas in your warehouse. A well-organized location system is key to efficient operations.

### Location Hierarchy

AmbraWMS uses a 3-level structure:

```
Level 1: Zone (Large area)
  └── Level 2: Aisle (Row within zone)
       └── Level 3: Bin/Shelf (Specific spot)
```

**Example Structure:**

```
Receiving Zone
  └── Aisle R-01
       ├── R-01-A (Bin A)
       ├── R-01-B (Bin B)
       └── R-01-C (Bin C)

Storage Zone A
  └── Aisle A-01
       ├── A-01-01 (Bin 01)
       ├── A-01-02 (Bin 02)
       └── A-01-03 (Bin 03)

Shipping Zone
  └── Aisle S-01
       ├── S-01-PACK (Packing area)
       └── S-01-STAGE (Staging area)
```

## Creating Locations

### Step 1: Create Zones

Zones represent major areas of your warehouse:

**Common Zone Types:**

- **Receiving** - Where goods arrive
- **Storage** - Main inventory area
- **Picking** - High-traffic items
- **Packing** - Order preparation
- **Shipping** - Outbound staging
- **Returns** - Customer returns processing
- **Quarantine** - Quality control holds

**To Create a Zone:**

1. Go to **Warehouse** → **Locations**
2. Click **Add Location**
3. Select **Zone** as level
4. Enter zone name
5. Choose icon and color
6. Add description
7. Save

### Step 2: Create Aisles

Aisles organize zones into rows:

1. Select parent zone
2. Click **Add Child Location**
3. Select **Aisle** as level
4. Name aisle (e.g., "A-01", "B-02")
5. Set properties
6. Save

### Step 3: Create Bins/Shelves

Bins are the specific storage spots:

1. Select parent aisle
2. Click **Add Child Location**
3. Select **Bin** as level
4. Name bin (e.g., "A-01-01")
5. Configure properties
6. Save

## Location Properties

### Basic Information

- **Name**: Clear, descriptive identifier
- **Code**: Short code for quick reference
- **Type**: Zone, Aisle, or Bin
- **Status**: Active, Inactive, Maintenance

### Visual Organization

**Icon Selection:**

Choose from 50+ icons:

- 📦 Box (general storage)
- 🚚 Truck (shipping)
- 🔄 Rotate (receiving)
- ⚠️ Alert (special handling)
- ❄️ Snowflake (cold storage)

**Color Coding:**

Use colors for quick identification:

- 🟢 Green - Active storage
- 🔵 Blue - Receiving
- 🟡 Yellow - Picking zones
- 🔴 Red - Special handling
- ⚫ Gray - Inactive

### Capacity & Dimensions

Track physical constraints:

- **Max Weight**: Weight capacity (kg)
- **Max Volume**: Cubic capacity (m³)
- **Dimensions**: Length × Width × Height
- **Max Pallets**: Number of pallets

## QR Codes

### Generating QR Codes

Every location can have a QR code:

1. Open location details
2. Click **Generate QR Code**
3. Choose size (small/medium/large)
4. Download as PNG or PDF
5. Print and attach to location

### QR Code Best Practices

- **Size**: Large enough to scan from 1 meter
- **Placement**: Eye level, well-lit area
- **Protection**: Laminate or use protective sleeves
- **Redundancy**: Multiple codes for large areas

### Scanning QR Codes

Use mobile app to:

- Quickly navigate to location
- View current stock
- Create movements
- Update stock counts

## Location Strategies

### Zone-Based Strategy

Organize by function:

**Receiving Zone:**

- Quick access to loading docks
- Large open spaces
- Temporary storage

**Storage Zone:**

- High-density racking
- Organized by category
- FIFO/LIFO lanes

**Picking Zone:**

- Fast-moving items
- Ergonomic placement
- Multiple access points

**Shipping Zone:**

- Near loading docks
- Staging lanes
- Packing stations

### ABC Classification

Organize by activity level:

- **A Locations**: High-activity (20% items, 80% picks)
  - Near packing area
  - Easy access
  - Multiple facings
- **B Locations**: Medium-activity (30% items, 15% picks)
  - Standard storage
  - Normal access
- **C Locations**: Low-activity (50% items, 5% picks)
  - Back of warehouse
  - High shelves
  - Bulk storage

### Product-Based Strategy

Group related products:

- **Category Zones**: Electronics, Apparel, Food
- **Size Zones**: Small parts, Medium boxes, Pallets
- **Temperature Zones**: Ambient, Chilled, Frozen
- **Special Handling**: Fragile, Hazardous, High-value

## Location Rules

### Storage Rules

Configure per location:

**Restrictions:**

- Max weight per shelf
- Product category limits
- Temperature requirements
- Hazmat compatibility

**Preferences:**

- Preferred product types
- FIFO/LIFO enforcement
- Pick sequence priority

### Replenishment

Set automatic replenishment:

- **Pick Locations**: High-turnover items
- **Reserve Locations**: Bulk storage
- **Replenishment Trigger**: When pick location low
- **Replenishment Quantity**: Amount to move

## Location Status

### Active Locations

Normal operations:

- Accept stock
- Allow picking
- Visible in searches

### Inactive Locations

Temporarily unavailable:

- Maintenance
- Reorganization
- Seasonal closure

### Blocked Locations

Cannot be used:

- Damaged
- Safety issues
- Pending repairs

## Location Reports

### Utilization Report

Track space usage:

- **Occupied**: Percentage full
- **Available**: Empty space
- **Reserved**: Allocated but empty

### Activity Report

Monitor location performance:

- **Picks**: Number of picks
- **Putaways**: Stock additions
- **Adjustments**: Corrections
- **Movements**: In/out transfers

### Capacity Planning

Analyze space needs:

- Current utilization
- Growth trends
- Seasonal patterns
- Expansion requirements

## Mobile Operations

### Location Navigation

Use mobile app for:

- Turn-by-turn directions
- Scan QR to confirm location
- Voice-guided picking
- Augmented reality (coming soon)

### Picking Workflows

Optimized routes:

1. System generates pick list
2. Sorts by optimal path
3. Navigator guides to each location
4. Scan to confirm pick
5. Move to next location

## Best Practices

### Naming Conventions

Use consistent patterns:

```
Zone-Aisle-Bin format:
A-01-01 (Zone A, Aisle 01, Bin 01)
RCV-01-A (Receiving, Aisle 01, Bin A)

Or descriptive names:
Receiving-Main-Bay1
Storage-Electronics-Shelf42
```

### Organization Tips

1. **Label Everything**: Clear, readable labels
2. **Use QR Codes**: Speed up operations
3. **Color Code**: Visual organization
4. **Regular Audits**: Verify accuracy
5. **Clear Aisles**: Maintain access
6. **Update Status**: Mark maintenance

### Performance Optimization

1. **Hot Zones**: Fast-movers near packing
2. **Bulk Storage**: Low-movers in back
3. **Cross-Docking**: Receiving to shipping direct
4. **Slotting Optimization**: Review quarterly
5. **ABC Analysis**: Update classifications

## Common Tasks

### How to Move a Product to Different Location

1. Go to **Warehouse** → **Movements**
2. Create movement type **301** (Location Transfer)
3. Select product and quantity
4. Choose source location
5. Choose destination location
6. Submit and complete

### How to Mark Location for Maintenance

1. Open location details
2. Change status to **Maintenance**
3. Add notes about issue
4. Set expected return date
5. Save

### How to Bulk Print QR Codes

1. Go to **Warehouse** → **Locations**
2. Select multiple locations (checkbox)
3. Click **Bulk Actions** → **Print QR Codes**
4. Choose size and layout
5. Download PDF
6. Print and distribute

## Troubleshooting

### "Can't find location in search"

- Check location status (active?)
- Verify spelling
- Check parent hierarchy
- Rebuild location index

### "QR code not scanning"

- Ensure good lighting
- Clean lens and code
- Check code not damaged
- Try different angle

### "Location shows as full but empty"

- Run stock audit for location
- Check for pending movements
- Review recent transactions
- Correct with adjustment

## Next Steps

- [Products Guide](/docs/user/products-guide) - Manage your inventory
- [Stock Movements](/docs/spec/stock-movements) - Understand transactions
- [Warehouse Basics](/docs/user/warehouse-basics) - Core concepts

---

_Last updated: November 26, 2025 | Version 1.0_
