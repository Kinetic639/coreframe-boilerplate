# Ambra Inventory Product Creation Enhancement Plan

## Purpose

This document defines how Ambra should evolve the current inventory product
creation experience into a compact, professional, Zoho-style item creation flow,
while keeping Ambra's stronger product/variant architecture.

The goal is not to copy Zoho's data model exactly. Zoho separates "Items" and
"Item Groups". Ambra should keep one unified product creation flow and expose
variants through a dedicated product creation tab. The user should be able to
create a simple item or a variant item from the same `/items/new` page.

This plan is based on:

- the current Ambra inventory implementation
- the Zoho Inventory "New Item" flow
- the Zoho Inventory "New Item Group" variant flow
- the desired Ambra behavior discussed during planning

## Progress Tracker

### Zoho Distance Snapshot

Current implementation now covers the required Zoho-like product MVP surface.
The remaining work is hardening, performance tuning, browser QA, and smaller
professional polish rather than missing core product flows.

- Backend/data foundations: about 90-95% of the Zoho-like item creation MVP is
  present.
- Create item workflow: about 85-90% there. Core sections, images, variants,
  token values, auto-generated combinations, custom fields, tags, opening stock,
  unit conversions, brand/manufacturer quick add, and quick-add unit behavior
  now exist.
- Variant workflow: about 85-90% there. It has chip values, automatic
  combinations, configurable SKU generation, duplicate SKU validation, gallery
  image assignment, and spreadsheet editing. Remaining polish is mostly
  keyboard/a11y and dense-table ergonomics.
- Product list / variant browsing: about 80-85% there. Products now support
  full-width inline expanded variant rows plus a flat variant-list toggle.
- Visual/professional polish: about 70-75% there. The form follows Ambra theme
  tokens and is compact, but it still needs final desktop/mobile and light/dark
  visual QA.

The next highest-impact hardening gaps are:

1. Visual QA in light/dark mode and mobile/desktop widths.
2. Browser tests around variant generation, image assignment, validation,
   import/export, SKU templates, validation, and list expansion.
3. Performance hardening for very large catalogs and import files.
4. Marketplace/channel metadata is intentionally out of MVP scope for now.

### Done

- [x] Created dedicated `/dashboard/warehouse/items/new` product creation page.
- [x] Added i18n routing for the new product creation page.
- [x] Kept the create page out of the sidebar registry.
- [x] Added product metadata fields: returnable, manufacturer, brand, dimensions,
      weight, sales description, purchase description, and preferred vendor.
- [x] Added first-class identifier storage for barcode, UPC, EAN, ISBN, and MPN.
- [x] Added product image and variant image storage foundations.
- [x] Added product image upload and preview during creation.
- [x] Added variant image upload and preview during creation.
- [x] Added image removal controls for product, simple variant, and generated
      variant rows.
- [x] Added primary product image selection during creation.
- [x] Added generated variant combinations from attribute/value input.
- [x] Added variant spreadsheet with SKU, name, prices, identifiers, reorder
      point, opening stock, and custom field columns.
- [x] Added configurable SKU generation modal with source fields,
      first/last/full modes, character counts, case conversion, separators, custom
      text, and live preview.
- [x] Added duplicate SKU validation before saving generated variants.
- [x] Added product tags.
- [x] Added product custom fields to creation flow.
- [x] Added variant custom fields to creation flow.
- [x] Replaced comma-separated tag, variant option, and multi-select custom
      field inputs with Enter-to-add token controls.
- [x] Quick-added units update the unit dropdown immediately and select the new
      unit without page refresh.
- [x] Variant combinations auto-update as attribute names or option values
      change; the manual generate combinations button has been removed.
- [x] Moved `Add Attribute` below the attribute list so the action sits with the
      rows it modifies.
- [x] Added compensation cleanup for failed enhanced product creation before
      stock posting, so failed catalog steps soft-delete the created product and
      variants instead of leaving visible partial records.
- [x] Added opening stock creation through inventory movements.
- [x] Added product list thumbnails, tags, variant count, and variant preview in
      the detail panel.
- [x] Added an inline variant expander in the product list product column while
      keeping DataView sorting/filtering/pagination intact.
- [x] Added true full-width inline expandable product rows on the product list.
- [x] Added flat variant-list toggle for browsing every variant as a row.
- [x] Added product detail/profile page.
- [x] Added product edit page for enhanced metadata, tags, unit conversions,
      and image management.
- [x] Added image reorder, remove, and primary/default controls on edit.
- [x] Added unit conversion controls inside product creation and edit.
- [x] Added brand and manufacturer master-data quick-add support.
- [x] Added tag and custom-field product list filters/columns.
- [x] Added create-form validation summary for required basics, variants,
      opening stock, unit conversions, and required custom fields.
- [x] Applied the product creation enhancement migration to the target Supabase
      project.
- [x] Applied the brand/manufacturer master-data migration to the target
      Supabase project.
- [x] Applied the product MVP completion migration to the target Supabase
      project.
- [x] Added database-level transactional catalog create RPC for enhanced product
      save: product, variants, option links, identifiers, tags, custom fields,
      reorder rules, and unit conversions are created in one database transaction.
- [x] Added server-side SKU collision checks before save.
- [x] Added persisted reusable SKU templates and template selection in the SKU
      generator.
- [x] Added CSV product import preview/import with import job records.
- [x] Added CSV product export with export job records.
- [x] Added multi-image variant gallery assignment during product creation.
- [x] Added custom-field section/group metadata and grouped custom-field
      rendering on the create form.
- [x] Added focused migration test coverage for the product creation
      enhancement schema.
- [x] Added service/action tests for enhanced product creation cleanup and
      branch/permission behavior.

### Partially Done

- [~] Zoho-style compact layout: functional sections exist, but the UI still
  needs a dedicated professional polish pass.
- [~] Variant creation: combinations auto-update and attribute values use token
  input, but attribute selection and generated row ergonomics still need polish.
- [~] SKU generation: configurable generation, server collision checks, and
  persisted templates now exist. Remaining work is keyboard/a11y polish and
  browser coverage.
- [~] Images: upload, preview, remove, primary image selection, edit-time
  reorder, persisted product image management, and multi-image variant
  assignment during creation exist. Remaining work is drag-and-drop polish and
  edit-time variant gallery management.
- [~] Product list grouping: full-width child rows and flat variant mode exist;
  remaining work is browser/performance polish for large catalogs.
- [~] Custom fields: values can be entered, saved, validated when required,
  grouped on the create form, and shown/filtered on the product list. Remaining
  work is edit-time custom-field management and field-type-specific polish.
- [~] Theme support: the creation form now uses Ambra theme tokens, but it still
  needs screenshot review in both light and dark mode.

### Still To Do

- [x] Add configurable SKU generator rules:
  - selected source fields
  - first/last/full value modes
  - character counts
  - case conversion
  - separators
  - live preview
- [x] Add true inline expandable product rows on the product list.
- [x] Add flat variant-list toggle for users who want every variant as a row.
- [x] Add image remove, reorder, and primary/default image selection.
- [x] Add edit product flow matching the enhanced creation flow.
- [x] Add product detail/profile page with Zoho-like operational tabs.
- [x] Add better validation and user-facing error summaries.
- [x] Make product catalog save database-transactional through an enhanced RPC.
      Opening stock posting and image storage still run after catalog creation
      because they use separate storage/ledger workflows; failures there trigger
      cleanup for the visible catalog records.
- [x] Add unit conversion controls directly inside product creation.
- [x] Add brand/manufacturer master data instead of only free-text fields.
- [x] Add tags/custom fields to product filtering and list columns.
- [~] Add tests for enhanced create action and client-side variant generation.
  Enhanced create service/action coverage exists; browser/client interaction
  tests for variant generation are still pending.
- [ ] Run visual QA in light mode, dark mode, desktop, and mobile.
- [x] Add import/export bulk item workflows.
- [ ] Add marketplace/channel integration metadata and sync readiness fields.
      Skipped intentionally for MVP.

## Target Product Experience

Ambra product creation should feel like a serious inventory/accounting tool:

- compact layout
- high information density
- light operational UI
- thin separators and aligned form rows
- sticky save/cancel action bar
- clear required fields
- inline table editing for variants
- product images and variant images
- expandable grouped item list
- professional, predictable, Zoho-like behavior

The current page is too basic. It creates only the core product record and a
basic variant spreadsheet. It does not expose enough of the inventory model we
already built.

## Current Ambra Support Matrix

### Already Supported

- Products and variants are separate entities.
- Variants are the stock-bearing entity.
- Products can have multiple variants.
- Variant option groups and option values exist.
- Variant combinations are generated automatically from option values.
- Variant fields exist for SKU, name, barcode, purchase price, sales price, and
  currency.
- Basic product creation exists.
- Default variant creation exists.
- Unit of measure exists.
- Quick-added units are immediately added to the creation form unit dropdown.
- Product-specific unit conversion support exists.
- Custom fields exist at database/service level.
- Product and variant custom fields render in the creation flow.
- Opening stock can be represented safely through inventory movements.
- Opening stock can be created during product creation.
- Inventory balances are movement-driven.
- Product list can be changed to group products and expand variants because the
  data model already separates product and variant.
- Product and variant images have storage metadata and creation-form upload
  support.
- Product tags exist and can be added during product creation.
- Product metadata fields exist for returnable, manufacturer, brand,
  dimensions, weight, sales description, purchase description, and preferred
  vendor.
- First-class barcode, UPC, EAN, ISBN, and MPN identifiers exist.

### Partially Supported

- SKU generation exists, and a basic modal can generate variant SKUs, but the UI
  does not yet expose Zoho-style configurable source fields, character count,
  case, and separators.
- Variant generation exists with token values and automatic combinations, but
  the attribute selector and generated-row ergonomics are not yet as polished as
  Zoho.
- Purchase and sales price exist and are organized into sales/purchase
  sections, but account/tax/vendor behavior is still lighter than Zoho.
- Custom fields render and save, but still need better grouping, validation
  messages, and field-type-specific polish.
- Units exist, but alternate units and conversions are not part of creation UX.
- Supplier/procurement basics exist, and preferred vendor is exposed, but vendor
  creation and richer procurement defaults are not part of the flow yet.

### Missing

- Image remove/reorder/default image controls.
- Brand and manufacturer master-data management.
- Fully configurable Zoho-style SKU generator modal.
- Grouped product list with inline expandable variants.
- Flat variant list toggle.
- Product edit flow matching enhanced create.
- Product detail/profile page with Zoho-like operational tabs.
- Transactional create flow that rolls back or cleans up partial products when
  follow-up steps fail.
- Unit conversion controls inside product creation.
- Tags/custom fields as filterable product list columns.

## Target Information Architecture

The `/dashboard/warehouse/items/new` page should become a unified item creation
workspace with these sections or tabs:

1. Basics
2. Images
3. Variants
4. Sales and Purchase
5. Inventory
6. Units
7. Custom Fields

The page should support two modes:

- Simple item: one default variant is created.
- Variant item: the user defines attributes and values, Ambra generates all
  variant combinations, and the user edits the generated variant table before
  save.

The variant workflow should be inline, not a separate "Item Groups" page.

## Target UI Layout

### Page Shell

Use a compact operational layout:

- light workspace background
- page title: `New Item`
- close/back button on the right
- sticky bottom action bar with `Save` and `Cancel`
- no large decorative cards
- no marketing-style hero layout
- no dark card-heavy product creation surface
- form sections separated by thin horizontal rules
- labels in left columns, controls aligned in right columns
- dense but readable spacing

The current dark card style should be replaced for this area. Product creation
should visually match inventory/accounting tools like Zoho.

### Save Behavior

Saving should be transactional from the user's point of view:

1. create product
2. create default variant or generated variants
3. attach images
4. set variant identifiers/prices
5. set custom field values
6. create opening stock movements if requested
7. redirect to product detail or product list

If any critical step fails, the user should get a clear error and no partial
inventory stock changes should be silently created.

## Section Detail

## 1. Basics

### Fields

- Type
  - Goods
  - Service
- Product name
- SKU
- Unit
- Returnable item
- Description
- Manufacturer
- Brand
- Dimensions
  - length
  - width
  - height
  - dimension unit
- Weight
  - weight
  - weight unit
- UPC
- EAN
- ISBN
- MPN

### Supported Today

- Product name
- SKU
- Unit
- Basic product type
- Description
- UPC/EAN/ISBN/MPN could be custom fields, but that is not ideal

### Needed Changes

Add first-class product metadata:

- `returnable` boolean
- `brand_id` or `brand_name`
- `manufacturer_id` or `manufacturer_name`
- `length`
- `width`
- `height`
- `dimension_unit`
- `weight`
- `weight_unit`

Add first-class identifiers. Recommended approach:

- `inventory_product_identifiers`
  - `id`
  - `organization_id`
  - `product_id`
  - `variant_id` nullable
  - `identifier_type`
  - `identifier_value`
  - `is_primary`

Identifier types:

- `sku`
- `barcode`
- `upc`
- `ean`
- `isbn`
- `mpn`
- custom future types

SKU should remain on the variant for fast operational lookup, but identifiers
should allow multiple external identifiers per product or variant.

## 2. Images

### Zoho Behavior

Zoho allows a user to drag or browse product images during item creation. It
mentions up to 15 images and shows an upload drop zone.

### Ambra Target Behavior

Ambra should support:

- product image upload
- variant image upload
- default product thumbnail
- default variant thumbnail
- image ordering
- image preview during creation
- fallback behavior:
  - variant thumbnail if present
  - product default thumbnail otherwise
  - placeholder icon otherwise

### Needed Database

Create storage bucket:

- `inventory-item-images`

Create table:

```sql
inventory_item_images
```

Recommended columns:

- `id`
- `organization_id`
- `product_id`
- `variant_id` nullable
- `storage_bucket`
- `storage_path`
- `public_url` nullable
- `file_name`
- `content_type`
- `file_size`
- `width`
- `height`
- `alt_text`
- `sort_order`
- `is_primary`
- `created_by`
- `created_at`
- `deleted_at`

Rules:

- at most one primary image per product without variant
- at most one primary image per variant
- product and variant images must belong to the same organization
- variant image must belong to the same product

### Needed UI

- image drop zone on Basics or Images tab
- thumbnails strip
- action to set primary image
- action to remove image
- variant table image column or side panel

## 3. Variants

### Zoho Behavior

Zoho "Item Group" flow:

- user creates item group name
- user enables multiple items
- user adds attributes
- each attribute has option values as chips
- Zoho generates every combination
- generated rows are shown in a spreadsheet table
- rows include item name, SKU, cost price, selling price, UPC, EAN, ISBN,
  reorder point
- user can copy values to all rows
- user can generate SKUs from item group name and attributes

### Ambra Target Behavior

Ambra should keep this inside `/items/new` under a `Variants` tab.

Controls:

- toggle: `Simple item` / `Item with variants`
- attribute builder
- option value chips
- add attribute
- remove attribute
- generated combination count
- regenerate variants
- preserve user-edited rows when possible
- variant spreadsheet
- copy-to-all actions
- row delete
- row reorder, optional later

### Variant Builder Fields

Attribute rows:

- attribute name
- option values
- delete row

Variant generated rows:

- thumbnail
- item name
- SKU
- barcode
- UPC
- EAN
- ISBN
- MPN
- purchase price
- sales price
- currency
- reorder point
- opening stock, when enabled
- opening stock rate, when enabled
- active/enabled flag

### Supported Today

- option groups
- option values
- generated variants
- variant SKU/name/barcode
- purchase and sales price
- copy/fill behavior

### Needed Changes

- move current spreadsheet into a polished variant tab
- add attribute/value chip builder
- generate all combinations in the client before save
- add SKU generator modal
- add identifier fields per variant
- add image per variant
- add reorder point field once reorder rules exist
- add opening stock fields once opening stock flow is wired

## 4. SKU Generator Modal

### Zoho Behavior

Zoho opens a modal where user selects attributes used to generate SKU.

Each row has:

- selected source attribute
- show rule, such as first N characters
- letter case
- separator

It previews the SKU, then applies generation to rows.

### Ambra Target Behavior

Add modal:

Title:

- `Generate SKU`

Source parts:

- product name
- product SKU prefix
- attribute values
- sequence number
- custom text

Per part controls:

- include/exclude
- first N characters
- last N characters
- full value
- upper case
- lower case
- title case
- separator after part

Preview:

- show sample SKU
- show collision warnings if possible

Actions:

- `Generate SKU`
- `Cancel`

### Supported Today

- SKU pattern and preview exist at backend level.

### Needed Changes

- UI modal
- client-side preview for generated variant combinations
- server validation for uniqueness
- final generated SKU assignment per variant

## 5. Sales and Purchase

### Zoho Behavior

Zoho separates:

- Sales Information
- Purchase Information

Each section can be enabled/disabled.

Sales fields:

- selling price
- account
- description
- tax

Purchase fields:

- cost price
- account
- description
- preferred vendor

### Ambra Target Behavior

Initial Ambra version should include:

Sales:

- enable sales information
- selling price
- sales description
- tax placeholder hidden or disabled until tax module exists

Purchase:

- enable purchase information
- purchase price
- purchase description
- preferred supplier

Defer:

- sales account
- COGS account
- inventory asset account
- tax accounting

Reason: Ambra does not yet have full accounting/tax models. Fake account fields
would create confusion.

### Supported Today

- purchase price on variants
- sales price on variants
- suppliers exist from procurement work

### Needed Changes

- add sales description field
- add purchase description field
- add preferred supplier relation
- render these fields in product create
- propagate default product-level values into generated variants

## 6. Inventory

### Zoho Behavior

Zoho has:

- Track Inventory for this item
- inventory account
- opening stock
- opening stock rate per unit
- reorder point

For item groups:

- select item type: Inventory or Non-Inventory
- include opening stock
- per-variant opening stock fields

### Ambra Target Behavior

Ambra should expose:

- track inventory toggle
- inventory item vs non-inventory item
- opening stock toggle
- branch
- location
- opening quantity
- opening cost/rate per unit
- reorder point

For variants:

- opening quantity per variant
- opening cost per variant
- reorder point per variant

### Supported Today

- inventory movements
- opening balance movement kind
- variant-based balances
- unit cost metadata on movement lines

### Needed Changes

- product create action must create opening stock movement after variants exist
- UI must collect branch/location
- reorder point needs new table

Recommended reorder table:

```sql
inventory_reorder_rules
```

Columns:

- `id`
- `organization_id`
- `branch_id`
- `variant_id`
- `location_id` nullable
- `min_quantity`
- `reorder_point`
- `reorder_quantity`
- `preferred_supplier_id` nullable
- `is_active`

## 7. Units

### Current Ambra

- base unit exists
- unit creation exists
- global unit conversions exist
- product-specific unit conversions exist

### Target Behavior

Product creation should include:

- base unit
- quick add unit
- alternate units section
- conversion factor

Example:

- base unit: `pcs`
- alternate unit: `box`
- `1 box = 10 pcs`

This can be a collapsible section. It does not need to dominate the initial
form.

## 8. Custom Fields

### Current Ambra

Custom field definitions and values exist for:

- product
- variant
- lot
- serial

### Target Behavior

Product creation should render configured custom fields:

- product custom fields in the main form
- variant custom fields in the variant spreadsheet or variant row side panel

Field types:

- text
- number
- date
- boolean
- select
- multi-select

Rules:

- required custom fields must block save
- filterable fields should later appear in product list filters
- custom fields should not replace core fields like brand, dimensions, EAN,
  UPC, or manufacturer

## 9. Tags and Collections

### Zoho Behavior

Zoho has `Associate Tags`.

### Ambra Current State

Ambra has collections, which are more structured than tags.

### Target Behavior

Add lightweight tags:

```sql
inventory_tags
inventory_product_tags
```

Tags should be usable for:

- product labels
- quick filtering
- item classification

Collections should remain available for curated/manual/dynamic groupings.

## 10. Product List Enhancements

### Zoho Behavior

Zoho item group list shows:

- parent item group row
- folder/expand icon
- child variant rows indented below
- stock on hand per variant
- reorder point per variant

### Ambra Target Behavior

Product list should have view modes:

1. Grouped products
   - one row per product
   - expand row to show variants
   - product thumbnail
   - product name
   - total stock on hand
   - variant count
   - status

2. Flat variants
   - one row per variant
   - product name
   - variant name
   - SKU
   - thumbnail
   - stock on hand
   - reorder point

Grouped should be the default.

### Expandable Variant Row Fields

Variant child row:

- thumbnail
- variant name
- SKU
- barcode
- stock on hand
- available stock
- reorder point
- sales price
- purchase price

### Needed Service Changes

Product list service should support:

- grouped list with summary fields
- optional variant expansion
- stock summary by product
- stock summary by variant
- thumbnail resolution

## Suggested Database Work Order

### Migration 1: Product Metadata

Add:

- returnable flag
- physical dimensions
- weight
- brand/manufacturer support
- sales description
- purchase description
- preferred supplier

### Migration 2: Product and Variant Images

Add:

- storage bucket
- image metadata table
- primary image constraints
- RLS policies

### Migration 3: Identifiers

Add:

- identifier table
- uniqueness rules by organization and identifier type/value
- optional product/variant scoping

### Migration 4: Reorder Rules

Add:

- reorder rule table
- branch/variant/location scoping
- RLS policies

### Migration 5: Tags

Add:

- tags table
- product tags join table

## Suggested UI Work Order

### Phase A: Visual Reset of Product Create

- replace card-heavy dark layout with compact light operational form
- sticky save/cancel bar
- Zoho-like sections
- keep existing create behavior

### Phase B: Basics, Sales, Purchase, Inventory Sections

- add fields supported by new metadata
- add tracking toggle
- add sales/purchase sections
- add preferred supplier

### Phase C: Images

- add product image upload
- add primary thumbnail selection
- show thumbnail on product list

### Phase D: Variant Builder

- add simple vs variant product mode
- add attribute/value chip builder
- generate combinations
- show variant table
- add copy-to-all controls

### Phase E: SKU Generator

- add modal
- generate per-variant SKUs
- preview and apply

### Phase F: Opening Stock

- add opening stock fields
- create opening balance movements after product/variant creation
- validate branch and location

### Phase G: Product List Expansion

- grouped product list
- expandable variant rows
- flat variant mode toggle

## Design Rules For This Area

Use Zoho as the baseline visual language:

- compact table-like forms
- labels left, inputs right
- thin separators
- minimal cards
- blue primary action
- neutral secondary action
- dense row heights
- no oversized headings
- no big decorative empty space
- no dark form panels for operational entry

Ambra-specific improvements:

- clearer tab structure for complex products
- better variant builder
- better image thumbnails
- better validation messages
- stronger permission-aware states

## MVP Scope Recommendation

The first serious enhancement should include:

- compact Zoho-like create page shell
- basic product metadata fields
- image table and upload
- variant tab with attribute/value builder
- generated variant spreadsheet
- SKU generator modal
- grouped product list with expandable variants

The following can wait:

- accounting accounts
- tax module
- bundles/kits
- manufacturing readiness
- rental readiness
- advanced tags automation
- advanced supplier pricing

## Open Questions

1. Should brand and manufacturer be master data tables or simple text fields at
   first?
2. Should identifiers be variant-first, product-first, or both?
3. Should images be uploaded before save as temporary files or only after the
   product record exists?
4. Should product creation redirect to product detail or back to product list?
5. Should opening stock be allowed during product creation for every user with
   product manage permission, or should it also require inventory operate
   permission?
6. Should grouped product list be the default for everyone, or should users be
   able to save their preferred list mode?

## Final Direction

Ambra should treat "item groups" as products with variants, not as a separate
primary navigation concept.

The product creation page should become the central place for:

- item identity
- images
- variants
- sales and purchase information
- inventory tracking
- opening stock
- custom fields

The resulting experience should be familiar to Zoho users, but with Ambra's
cleaner product/variant data model underneath.
