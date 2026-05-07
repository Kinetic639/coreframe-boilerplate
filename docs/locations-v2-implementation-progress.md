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

## Migration Fix Pass (2026-05-07)

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
