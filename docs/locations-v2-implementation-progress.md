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
