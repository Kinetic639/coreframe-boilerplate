---
title: "Getting Started with AmbraWMS"
slug: "getting-started"
lang: "en"
version: "2.0"
lastUpdated: "2025-11-26"
tags: ["getting-started", "basics", "tutorial", "quickstart"]
category: "user-guide"
difficulty: "beginner"
audience: ["warehouse-staff", "managers", "administrators", "new-users"]
status: "published"
author: "AmbraWMS Team"
estimatedReadTime: 12
---

# Getting Started with AmbraWMS

Welcome to **AmbraWMS** - your complete warehouse management solution! This guide will help you get up and running quickly, whether you're a warehouse worker, manager, or system administrator.

## What is AmbraWMS?

AmbraWMS is a modern, cloud-based warehouse management system designed for businesses of all sizes. Built with cutting-edge technology, it provides:

- **Real-time Inventory Tracking** - Know exactly what you have, where it is, and when it's moving
- **Multi-Warehouse Support** - Manage multiple warehouses (branches) from a single platform
- **Polish Compliance** - Built-in support for Polish warehouse regulations and document types
- **Mobile-First Design** - Works seamlessly on desktop, tablet, and mobile devices
- **Powerful Integrations** - Connect with e-commerce platforms, ERP systems, and more

## Key Concepts

Before diving in, let's understand the core concepts:

### Organization Structure

AmbraWMS uses a hierarchical structure:

```
Organization (Your Company)
  └── Branch (Warehouse 1)
       └── Locations (Shelves, Zones, Aisles)
  └── Branch (Warehouse 2)
       └── Locations (Shelves, Zones, Aisles)
```

**Important**: Each **branch represents a physical warehouse**. This is enforced at the database level to ensure accurate inventory tracking.

### Products & Inventory

- **Products** - The items you sell or store
- **Variants** - Different versions (sizes, colors, configurations)
- **Inventory Data** - Stock levels per warehouse/branch
- **Stock Movements** - All changes to inventory (receipts, issues, transfers)

### Locations

Physical storage areas in your warehouse:

- **Zone** - Large area (e.g., "Zone A", "Receiving Area")
- **Aisle** - Row within a zone
- **Shelf/Bin** - Specific storage location

Each location can have:

- QR code for scanning
- Color coding for visual organization
- Icon for quick identification

## Quick Start Checklist

Follow these steps to get your warehouse operational:

### 1. Set Up Your Organization Profile

Navigate to **Organization** → **Profile Settings**

- [ ] Upload your company logo
- [ ] Enter company details (name, address, contact)
- [ ] Configure default settings (currency, timezone, units)

### 2. Create Your First Branch (Warehouse)

Go to **Organization** → **Branches**

- [ ] Click "Add Branch"
- [ ] Enter branch name (e.g., "Main Warehouse", "Distribution Center")
- [ ] Add address and contact information
- [ ] Set operating hours
- [ ] Assign warehouse manager

### 3. Set Up Storage Locations

Navigate to **Warehouse** → **Locations**

- [ ] Create zones (e.g., "Receiving", "Storage", "Shipping")
- [ ] Add aisles within zones
- [ ] Create shelf/bin locations
- [ ] Generate QR codes for each location
- [ ] Print and attach labels

**Example Structure:**

```
Receiving Zone
  └── Aisle R1
       ├── R1-A (Shelf A)
       ├── R1-B (Shelf B)
       └── R1-C (Shelf C)

Storage Zone A
  └── Aisle A1
       ├── A1-01 (Bin 1)
       ├── A1-02 (Bin 2)
       └── A1-03 (Bin 3)
```

### 4. Add Your First Product

Go to **Warehouse** → **Products** → **Add Product**

- [ ] Enter product name and SKU
- [ ] Add description
- [ ] Upload product image
- [ ] Set unit of measure (ea, kg, m, etc.)
- [ ] Configure variants if needed (size, color)
- [ ] Set reorder point and min/max stock levels

**Pro Tip**: Use clear, consistent SKU naming conventions. Example: `WIDGET-001-BLU-LG` for Widget 001, Blue, Large

### 5. Receive Your First Inventory

Navigate to **Warehouse** → **Movements** → **New Movement**

- [ ] Select movement type: **101 - Goods Receipt from Purchase Order**
- [ ] Choose product and quantity
- [ ] Select destination location
- [ ] Add purchase order reference (optional)
- [ ] Submit movement
- [ ] Approve movement (if you have permission)
- [ ] Complete movement to update stock

**Result**: Your inventory is now in the system and tracked!

### 6. Set Up User Roles & Permissions

Go to **Organization** → **User Management**

- [ ] Invite team members
- [ ] Assign roles (Warehouse Worker, Manager, Admin)
- [ ] Configure branch access
- [ ] Test permissions

## Understanding Stock Movements

AmbraWMS uses **SAP-style movement types** with numeric codes:

### Common Movement Types

| Code    | Name                  | Use Case                        |
| ------- | --------------------- | ------------------------------- |
| **101** | Goods Receipt from PO | Receiving from supplier         |
| **103** | Customer Return       | Product returned by customer    |
| **201** | Goods Issue for Sales | Fulfilling customer order       |
| **202** | Return to Supplier    | Sending defective goods back    |
| **301** | Location Transfer     | Moving stock between shelves    |
| **305** | Branch Transfer       | Moving stock between warehouses |
| **401** | Inventory Increase    | Correcting undercount           |
| **402** | Inventory Decrease    | Correcting overcount            |
| **411** | Physical Inventory    | Annual audit adjustment         |

### Movement Workflow

Every movement goes through stages:

```
Draft → Pending → Approved → Completed
```

- **Draft**: Created but not submitted
- **Pending**: Awaiting approval
- **Approved**: Ready to execute
- **Completed**: Stock has been updated ✅

**Important**: Stock only changes when movement is **Completed**!

## Navigation Guide

AmbraWMS is organized into modules:

### 🏠 Home (Start)

- Dashboard with key metrics
- Recent announcements
- Quick actions

### 📦 Warehouse

- Products management
- Locations hierarchy
- Stock movements
- Inventory audits
- Suppliers & clients

### 👥 Teams

- Team collaboration
- Chat and announcements
- Shared calendar
- Kanban board

### 🏢 Organization

- Company profile
- Branch management
- User roles & permissions
- Settings

### 💬 Support

- Help center
- Contact support
- System status
- Roadmap

### 📚 Documentation

- User guides (you are here!)
- Developer docs
- Technical specifications

## Daily Workflows

### Receiving Goods

1. Scan QR code on packing slip or enter PO number
2. Create movement type **101** (Goods Receipt)
3. Scan product barcodes as you unload
4. Assign to receiving location
5. Complete movement
6. Move to storage locations (use movement **301**)

### Picking for Orders

1. View pick list for sales order
2. Navigate to storage locations
3. Scan product barcodes
4. Confirm quantities
5. Create movement **201** (Goods Issue)
6. Move to shipping area
7. Complete movement to update stock

### Cycle Counting

1. Navigate to **Warehouse** → **Audits**
2. Create new audit or select scheduled audit
3. Count physical stock at location
4. Enter counted quantities
5. System shows discrepancies
6. Approve adjustments
7. Movements auto-created to correct stock

## Mobile App Tips

AmbraWMS works great on mobile devices:

- **Use Camera** - Scan QR codes on locations and products
- **Offline Mode** - Continue working without internet (syncs later)
- **Voice Commands** - Hands-free operation in the warehouse
- **Quick Actions** - Swipe gestures for common tasks

## Best Practices

### Organization

1. **Use Logical Naming** - Clear zone/aisle/bin names
2. **QR Codes Everywhere** - On locations, products, equipment
3. **Color Coding** - Visual system for product categories

### Stock Management

1. **Set Reorder Points** - Prevent stockouts
2. **Regular Audits** - Schedule quarterly cycle counts
3. **Document Everything** - Always create movements for changes
4. **First In, First Out** - Use location strategy for expiring goods

### Team Training

1. **Role-Based Training** - Tailor to each user's responsibilities
2. **Hands-On Practice** - Use test branch for training
3. **Regular Refreshers** - Monthly tips and updates
4. **Document Custom Processes** - Create your own guides

## Common Tasks

### How to Transfer Stock Between Locations

**Warehouse** → **Movements** → **New Movement**

1. Select type: **301 - Transfer Posting (Location to Location)**
2. Choose product
3. Enter quantity
4. Select source location (where it is now)
5. Select destination location (where it's going)
6. Add notes if needed
7. Submit and complete

### How to Adjust Stock Levels

If you find a discrepancy:

**Warehouse** → **Movements** → **New Movement**

1. Select type:
   - **401** if you found more stock than system shows
   - **402** if you found less stock than system shows
2. Choose product and location
3. Enter adjustment quantity
4. **Important**: Add reason in notes
5. Submit for approval

### How to Search for Products

Use the global search (top right):

- Search by name
- Search by SKU
- Search by barcode
- Filter by category, supplier, location

## Troubleshooting

### "Can't find my product"

- Check if you're in the correct branch
- Verify product is not archived
- Check spelling of SKU/name
- Use filters to narrow search

### "Movement is stuck in Pending"

- Check if you have approval permission
- Ask your warehouse manager to approve
- Review movement details for errors

### "Stock count doesn't match"

- Check recent movements for that product
- Verify location is correct
- Run an audit to investigate
- Check for pending movements

## Getting Help

### In-App Support

Click the **Support** module or press `?` key:

- Browse help articles
- Watch video tutorials
- Contact support team
- Check system status

### Training Resources

- **Video Library**: Step-by-step tutorials
- **Webinars**: Live training sessions
- **Community**: Connect with other users
- **Documentation**: Comprehensive guides

### Contact Support

**Email**: support@ambrawms.com
**Phone**: +48 XXX XXX XXX
**Live Chat**: Available 8 AM - 6 PM CET

## Next Steps

Now that you understand the basics:

1. 📖 **Read**: [Warehouse Basics](/docs/user/warehouse-basics) - Deep dive into inventory concepts
2. 🎯 **Explore**: [Stock Movements Guide](/docs/spec/stock-movements) - Master all movement types
3. 🏗️ **Learn**: [System Architecture](/docs/dev/architecture) - How AmbraWMS works (developers)
4. ⚙️ **Configure**: Set up integrations with your e-commerce platform
5. 📊 **Analyze**: Explore reporting and analytics features

## Quick Reference Card

**Keyboard Shortcuts**

- `?` - Help
- `/` - Global search
- `N` - New movement
- `P` - Products
- `L` - Locations

**Polish Document Types**

- **PZ** - Przyjęcie Zewnętrzne (External Receipt)
- **WZ** - Wydanie Zewnętrzne (External Issue)
- **MM** - Przesunięcie Magazynowe (Transfer)
- **RW** - Rozchód Wewnętrzny (Internal Issue)
- **PW** - Przyjęcie Wewnętrzne (Internal Receipt)

---

**Welcome to AmbraWMS!** We're excited to help you streamline your warehouse operations. If you have any questions, our support team is here to help.

_Last updated: November 26, 2025 | Version 2.0_
