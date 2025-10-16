# Products System Migration Guide

## Overview

This guide will help you migrate from the old complex EAV-based product system to the new simplified InFlow/Zoho-inspired system.

## Prerequisites

- Access to Supabase Dashboard (https://app.supabase.com)
- Admin access to your project: `rsnjgdskfjwjozrmdwpd`

## Step 1: Backup Current Data (IMPORTANT!)

Before applying any migrations, **backup your current database**:

1. Go to Supabase Dashboard → Your Project → Database → Backups
2. Create a manual backup or download current data
3. Save any important product data you want to preserve

## Step 2: Apply the Migration

### Option A: Using Supabase SQL Editor (Recommended)

1. Go to Supabase Dashboard → Your Project → SQL Editor
2. Open the migration file: `supabase/migrations/20250114000000_simplified_products_system.sql`
3. Copy the **entire contents** of the file
4. Paste into the SQL Editor
5. Click "Run" to execute the migration

**NOTE**: The migration will:

- ✅ Drop old tables: `product_attributes`, `product_images` (old), `template_attribute_definitions`, `product_templates`, old `product_variants`, old `products`, `product_types`
- ✅ Create new tables: `products`, `product_barcodes`, `product_custom_field_definitions`, `product_custom_field_values`, `product_variants`, `product_group_attributes`, `variant_attribute_values`, `product_images`, `product_categories`, `variant_option_groups`, `variant_option_values`
- ✅ Add all necessary indexes, triggers, and constraints
- ⚠️ RLS is **DISABLED** - you'll need to enable it manually when ready

### Option B: Using Supabase CLI (If you have access)

```bash
# Make sure you're logged in
npx supabase login

# Link to your project (use the access token from your account)
npx supabase link --project-ref rsnjgdskfjwjozrmdwpd

# Apply the migration
npx supabase db push
```

## Step 3: Generate TypeScript Types

After the migration is applied, regenerate the TypeScript types:

```bash
npm run supabase:gen:types
```

This will update `supabase/types/types.ts` with the new table structures.

## Step 4: Verify Migration Success

Run this SQL in the Supabase SQL Editor to verify all tables were created:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'products',
  'product_barcodes',
  'product_custom_field_definitions',
  'product_custom_field_values',
  'product_variants',
  'product_categories',
  'variant_option_groups',
  'variant_option_values',
  'product_images',
  'product_group_attributes',
  'variant_attribute_values'
)
ORDER BY table_name;
```

You should see all 11 tables listed.

## Step 5: Enable RLS (When Ready)

The migration has RLS **disabled** by default. When you're ready to enable security:

1. Go to Supabase Dashboard → Authentication → Policies
2. For each table, create appropriate RLS policies
3. Enable RLS for each table

Example RLS policy for `products`:

```sql
-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view products in their organization
CREATE POLICY "Users can view org products"
ON products FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id
    FROM organization_users
    WHERE user_id = auth.uid()
  )
);

-- Policy: Users can insert products if they have permission
CREATE POLICY "Users can insert products with permission"
ON products FOR INSERT
TO authenticated
WITH CHECK (
  public.authorize(
    'products.create'::text,
    organization_id::text
  )
);

-- Add similar policies for UPDATE and DELETE
```

## Step 6: Test the System

1. Start the development server: `npm run dev`
2. Navigate to `/dashboard/warehouse/products`
3. Click "Dodaj produkt" (Add Product)
4. Fill in the form and create your first product
5. Verify it appears in the product list

## New Database Schema

### Main Tables

#### `products`

The core products table with all fields as columns (no more JSONB contexts):

- Direct fields for all Zoho-style attributes
- Supports 3 types: `goods`, `service`, `item_group`
- Optional measurements (dimensions, weight)
- Multiple identifiers (UPC, EAN, ISBN, MPN)
- Sales and purchase information
- Inventory tracking settings

#### `product_barcodes`

Multi-barcode support like InFlow:

- Each product can have multiple barcodes
- One barcode marked as `is_primary`
- Supports both product barcodes and variant barcodes

#### `product_custom_field_definitions`

Organization-wide custom field definitions:

- Support for 5 types: text, number, date, dropdown, checkbox
- Dropdown options stored as JSONB
- Soft delete support

#### `product_custom_field_values`

Actual custom field values per product:

- Links to custom field definitions
- JSONB value storage for flexibility

#### `product_variants`

For item groups only:

- Links to parent product
- Stores variant SKU, barcodes, pricing
- Dimensions and weight per variant

#### `product_images`

Product image management:

- Primary image designation
- Display order
- Alt text for accessibility
- Separate images for ecommerce vs magazine use

## Troubleshooting

### Migration fails with "table already exists"

Some tables might already exist. You can either:

1. Drop them manually first, or
2. Comment out the CREATE TABLE statements for existing tables

### "Permission denied" errors

Make sure you're using the service role key or have sufficient database permissions.

### Old products data is gone

This is expected - the migration **drops old tables**. If you need to preserve data:

1. Export old data before migration
2. Write a custom migration script to transform and import it

## Next Steps After Migration

1. ✅ Create custom field definitions for your organization
2. ✅ Set up product categories
3. ✅ Create variant option groups (for item groups)
4. ✅ Import existing products (if needed)
5. ✅ Configure RLS policies
6. ✅ Set up product images in Supabase Storage
7. ✅ Test barcode scanning integration

## Support

If you encounter issues:

1. Check the browser console for errors
2. Check Supabase logs in the Dashboard
3. Verify all environment variables are set correctly
4. Ensure the migration completed successfully
