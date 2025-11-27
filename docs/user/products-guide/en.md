---
title: "Products Management Guide"
slug: "products-guide"
lang: "en"
version: "1.0"
lastUpdated: "2025-11-26"
tags: ["products", "inventory", "sku", "variants"]
category: "user-guide"
difficulty: "beginner"
audience: ["warehouse-staff", "managers"]
status: "published"
author: "AmbraWMS Team"
estimatedReadTime: 10
prerequisites: ["getting-started"]
related: ["warehouse-basics"]
---

# Products Management Guide

Learn how to create, manage, and organize products in AmbraWMS. This guide covers everything from basic product setup to advanced variant management.

## Understanding Products

In AmbraWMS, products are the foundation of your inventory system. Each product represents a unique item you store, sell, or manage.

### Product Structure

```
Product (Base Item)
  └── Variants
       ├── Size: Small, Medium, Large
       ├── Color: Red, Blue, Green
       └── Material: Cotton, Polyester
```

### Key Product Fields

**Required Fields:**

- **Name** - Product display name
- **SKU** - Stock Keeping Unit (unique identifier)
- **Unit of Measure** - ea, kg, m, L, etc.

**Optional but Recommended:**

- **Description** - Detailed product information
- **Images** - Product photos
- **Category** - Product classification
- **Barcode** - For scanning
- **Supplier** - Default supplier

## Creating a New Product

### Step-by-Step Process

1. Navigate to **Warehouse** → **Products**
2. Click **Add Product** button
3. Fill in product information
4. Add images (drag & drop supported)
5. Configure variants if needed
6. Set inventory parameters
7. Click **Save**

### SKU Best Practices

A good SKU system is:

- **Consistent** - Follow same pattern
- **Descriptive** - Tell you about the product
- **Concise** - Not too long
- **Unique** - No duplicates

**Examples:**

```
TEE-001-BLU-M    (T-Shirt #001, Blue, Medium)
LAP-HP-E840-16   (Laptop, HP, EliteBook 840, 16GB RAM)
BOX-STD-30X20    (Box, Standard, 30x20 cm)
```

## Product Variants

Variants allow you to manage different versions of the same base product.

### When to Use Variants

✅ **Use variants for:**

- Different sizes of same product
- Different colors of same item
- Different configurations
- Products with minor variations

❌ **Don't use variants for:**

- Completely different products
- Products with different suppliers
- Items with different prices (unless variant-based)

### Creating Variants

1. Open product details
2. Go to **Variants** tab
3. Select variant options (Size, Color, etc.)
4. Generate variant combinations
5. Set variant-specific data:
   - SKU suffix
   - Price adjustments
   - Images
   - Stock levels

**Example:**

Base Product: "Premium T-Shirt"

Variants generated:

- Premium T-Shirt - Small - Red
- Premium T-Shirt - Small - Blue
- Premium T-Shirt - Medium - Red
- Premium T-Shirt - Medium - Blue
- Premium T-Shirt - Large - Red
- Premium T-Shirt - Large - Blue

## Product Images

### Image Guidelines

- **Format**: JPG, PNG, WebP
- **Size**: Max 5MB per image
- **Resolution**: At least 800x800px
- **Background**: White or transparent preferred

### Multiple Images

You can add multiple images per product:

1. **Primary Image** - Main product photo
2. **Additional Images** - Different angles, details
3. **Variant Images** - Specific to each variant

## Categories & Tags

### Product Categories

Organize products in a hierarchical structure:

```
Electronics
  └── Computers
       ├── Laptops
       ├── Desktops
       └── Accessories
  └── Mobile Devices
       ├── Smartphones
       └── Tablets
```

### Tags

Add flexible tags for better searchability:

- Seasonal: `summer`, `winter`, `holiday`
- Features: `waterproof`, `eco-friendly`, `bestseller`
- Promotions: `sale`, `new`, `clearance`

## Inventory Parameters

### Per-Warehouse Settings

Each product can have different settings per warehouse:

**Reorder Point**: When to trigger replenishment

- Example: 50 units

**Minimum Stock**: Safety stock level

- Example: 20 units

**Maximum Stock**: Storage capacity

- Example: 500 units

**Lead Time**: Days to receive after ordering

- Example: 7 days

### Stock Alerts

System automatically monitors:

- 🔴 **Critical**: Below 25% of reorder point
- 🟡 **Low**: Below reorder point
- 🟢 **Normal**: Above reorder point

## Pricing & Cost

### Cost Tracking

- **Purchase Cost**: How much you paid
- **Selling Price**: How much you charge
- **Margin**: Profit percentage

### Currency Support

AmbraWMS supports multiple currencies:

- Set default currency in organization settings
- Track costs in original currency
- Convert for reporting

## Barcodes & Scanning

### Barcode Types Supported

- **EAN-13**: Standard retail barcode
- **UPC**: Universal Product Code
- **Code 128**: Versatile industrial barcode
- **QR Code**: 2D matrix barcode

### Generating Barcodes

1. Enter SKU or let system generate
2. System creates barcode automatically
3. Print labels from product page
4. Attach to products and locations

## Bulk Operations

### Importing Products

Upload products via CSV/Excel:

1. Download template
2. Fill in product data
3. Upload file
4. Review and confirm
5. System creates products

**CSV Format Example:**

```csv
SKU,Name,Category,Unit,Price,Barcode
TEE-001,T-Shirt Blue,Apparel,ea,29.99,123456789
LAP-001,Laptop HP,Electronics,ea,899.99,987654321
```

### Bulk Edit

Select multiple products and edit:

- Category
- Supplier
- Tags
- Status (active/inactive)

### Export

Export product data for:

- Analysis in Excel
- Backup
- Integration with other systems

## Product Search & Filters

### Quick Search

Use the search bar to find by:

- Product name
- SKU
- Barcode
- Supplier name

### Advanced Filters

Filter products by:

- **Category**: Narrow by product type
- **Stock Status**: In stock, low, out of stock
- **Supplier**: Products from specific supplier
- **Location**: Where product is stored
- **Price Range**: Min/max price
- **Tags**: Products with specific tags

## Product Status

### Active vs Inactive

- **Active**: Regular products in rotation
- **Inactive**: Discontinued or seasonal items

Inactive products:

- Don't appear in new orders
- Keep historical data
- Can be reactivated

## Integration with E-commerce

### Syncing Products

AmbraWMS can sync with:

- **Shopify**
- **WooCommerce**
- **Allegro** (Polish marketplace)

### Sync Settings

Configure per product:

- **Sync Enabled**: Yes/No
- **Visibility**: Public/Private
- **Stock Sync**: Real-time updates
- **Price Sync**: Keep prices in sync

## Best Practices

### Organization

1. **Use clear naming** - Describe what it is
2. **Consistent SKUs** - Follow naming convention
3. **Complete descriptions** - Help users find products
4. **Good images** - Multiple angles, high quality

### Data Quality

1. **Verify information** before saving
2. **Update regularly** - Keep data current
3. **Review duplicates** - Merge if found
4. **Archive old products** - Don't delete

### Performance

1. **Use categories** - Better organization
2. **Limit variants** - Only when necessary
3. **Optimize images** - Compress large files
4. **Regular audits** - Check data quality

## Common Tasks

### How to Archive a Product

1. Open product details
2. Click **More Actions** → **Archive**
3. Confirm action
4. Product hidden from active lists

### How to Duplicate a Product

1. Open product to duplicate
2. Click **More Actions** → **Duplicate**
3. Modify details as needed
4. Save new product

### How to Merge Duplicate Products

1. Go to **Products** → **Find Duplicates**
2. Review suggested duplicates
3. Select products to merge
4. Choose which data to keep
5. Confirm merge

## Troubleshooting

### "SKU already exists"

- Each SKU must be unique
- Check for duplicates
- Use system-generated SKUs if unsure

### "Image upload failed"

- Check file size (max 5MB)
- Verify file format (JPG, PNG, WebP)
- Try compressing image

### "Product not showing in search"

- Verify product is active
- Check category assignment
- Ensure not archived
- Rebuild search index (admin only)

## Next Steps

- [Warehouse Basics](/docs/user/warehouse-basics) - Understand inventory concepts
- [Stock Movements](/docs/spec/stock-movements) - Learn about inventory transactions
- [Location Management](#) - Organize your warehouse space

---

_Last updated: November 26, 2025 | Version 1.0_
