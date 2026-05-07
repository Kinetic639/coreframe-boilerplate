# Locations V2 Implementation Progress

## Plan source / mismatch note

- Requested plan file: `/mnt/data/ambra-locations-v2-refactor-implementation-plan.md`.
- Actual environment does not contain `/mnt/data` and the plan file is not present, so implementation is based on the user-provided phase checklist in the prompt.

## Phase 0 — Preflight

- [x] Review current `warehouse_locations` migrations.
- [x] Review current `warehouse_layouts` migrations.
- [x] Review current `warehouse_layout_shapes` migrations.
- [x] Review location services.
- [x] Review layout services.
- [x] Review shape services.
- [x] Review warehouse server actions.
- [x] Review React Query hooks for warehouse locations/maps.
- [x] Review `/dashboard/warehouse/locations` and `/dashboard/warehouse/map` routes.
- [x] Confirm current table and column names before migration work.
- [x] Confirm inventory stock table name (`product_location_stock`).
- [x] Confirm locale route structure (`app/[locale]/dashboard/...`).
- [x] Document repo/plan mismatches.

### Phase 0 mismatch details

1. Plan references an external markdown file path not available in this container.
2. Existing schema already includes v1 map concepts (`map_role`, `front_segment`, `top_down_unit`, `top_storage_segment`) and shape RPCs with replace-all semantics that must be preserved for legacy UI during transition.
3. Inventory table for location stock exists as `product_location_stock` (not just a hypothetical table name).

## Phase 1 — Database foundation (additive only)

- [x] `locations_v2_entity_cleanup` migration created.
- [x] `locations_v2_visual_nodes` migration created.
- [x] `locations_v2_split_nodes` migration created.
- [x] `locations_v2_mapping_archive_functions` migration created.
- [x] `locations_v2_backfill_visual_nodes` migration created.
- [x] `locations_v2_verification_queries` migration created.
- [ ] Apply migrations to target database.
- [ ] Regenerate Supabase types (if/when connected workflow is executed).
- [ ] Run post-apply verification queries against live data.

## Phase 2+

- [ ] Not started (intentionally deferred per instruction: start with Phase 0 and Phase 1 only).

## Migration Hardening Pass (2026-05-07)

- Strategy: amended original Phase 1 local migrations directly (assumed not applied to shared DB yet).
- Fixed `location_category` to controlled enum-like set with normalization + CHECK.
- Removed invalid `top_storage_segment` column usage; now uses `map_role` value mapping only.
- Hardened `can_store_inventory` backfill to conservative leaf-only role logic.
- Updated visual nodes schema:
  - added `visualization_type`
  - enforced controlled `visual_role`
  - changed status set to `active|hidden|historical`
  - changed `view_context_location_id` FK to `ON DELETE SET NULL`
  - primary-node unique index now scoped to active `visual_role='primary'`.
- Updated split nodes schema:
  - added `cache_valid`
  - aligned `size_mode` to `equal|ratio|fixed|auto`
  - `view_context_location_id` changed to nullable + `ON DELETE SET NULL`.
- Reworked RPCs:
  - `get_warehouse_location_mapping_status()` now returns `mapping_status` + child mapped counts.
  - `validate_warehouse_location_archive()` now returns UI-friendly `blockers[]` and `warnings[]`, and optional-table checks validate table+column presence before dynamic SQL references.
- Backfill migration corrected:
  - sets `visualization_type`
  - sets `visual_role='primary'`
  - maps `front_elevation -> front`
  - uses `anchor_location_id`/root for `view_context_location_id`
  - avoids duplicates via scoped `NOT EXISTS`
  - keeps legacy shapes intact.
- Verification migration converted into rerunnable function:
  - `public.verify_locations_v2_migration()`

### Remaining before Phase 2

- Apply amended migrations to Supabase target environment.
- Execute `public.verify_locations_v2_migration()` in dev/staging.
- Confirm zero duplicates/invalid categories/invalid visual roles on real data.
- Confirm `validate_warehouse_location_archive()` behavior against environments with optional dependency tables.

- manual verification SQL path: `docs/sql/locations-v2-verification.sql`
- Phase 1 completion status: **not yet complete** until migrations are applied and verification function passes in dev/shared DB.

## Migration Review Fix Pass (2026-05-07)

- Fixed verification function syntax/return shape in `public.verify_locations_v2_migration()` and ensured JSONB return compiles.
- Enforced `warehouse_locations.can_store_inventory` as `NOT NULL DEFAULT false` after normalization.
- Enforced `warehouse_locations.location_category` as `NOT NULL DEFAULT 'custom'` with controlled value constraint.
- Expanded `warehouse_locations.status` to `active|inactive|archived`, normalized invalid/null to `active`, and enforced NOT NULL + default.
- Added `updated_at` triggers for:
  - `warehouse_location_visual_nodes`
  - `warehouse_layout_split_nodes`
- Made visual node `depth_mm` nullable with positive check only when provided.
- Corrected backfill depth logic to use real depth fields only; removed shape-height-as-depth fallback.
- Added split-node anchoring and geometry support:
  - `parent_visual_node_id` (ON DELETE CASCADE)
  - index `wlsn_parent_visual_node_idx`
  - `calc_z_mm`
- Hardened archive validation against missing `product_location_stock` table/columns using table+column guards.
- Added note that mapping-status logic is direct-child aware in Phase 1 (descendant-aware later if needed).
- Updated manual verification SQL with null/invalid checks for location/visual/split fields.

### Verification assets

- Function: `public.verify_locations_v2_migration()`
- Manual SQL: `docs/sql/locations-v2-verification.sql`

### Remaining blockers before Phase 1 completion

- Run migrations on dev/shared DB successfully.
- Execute `SELECT public.verify_locations_v2_migration();` on dev DB and review metrics.
- Validate optional dependency behavior of archive validation in target schema.
- Confirm duplicate primary-node handling with real data (no silent delete/remap).
