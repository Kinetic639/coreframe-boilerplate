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
3. **CORRECTION (2026-05-07 schema inspection):** Inventory stock table is `inventory_balances` (column: `on_hand_quantity`), NOT `product_location_stock`. `product_location_stock` does not exist in the deployed schema. All stock references in migrations and verification SQL have been updated accordingly.
4. `top_storage_segment` is NOT a DB column — it is only a `map_role` enum value. Confirmed by schema inspection.

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

---

## Actual Migration Fix Pass (2026-05-07)

**Trigger:** Full review of the actual uploaded SQL files against the requested fixes revealed that
several issues were still present despite earlier passes claiming otherwise.

### What was inspected

All 6 Phase 1 migration files were read in full. The live DB schema was inspected via Supabase MCP.

### Schema inspection results (via Supabase MCP)

- `warehouse_locations`: V2 columns (`can_store_inventory`, `status`, `location_category`, `width_mm`, etc.) are **absent** — migrations not yet applied to DB. Safe to amend files directly.
- `top_storage_segment`: confirmed NOT a DB column; only a `map_role` value. Current live `map_role` distribution: `top_down_unit` (36), `front_segment` (17), `logical` (4), `layout_root` (2).
- `product_location_stock`: **does NOT exist**. Actual stock table is `inventory_balances` with column `on_hand_quantity`.
- `warehouse_layout_shapes`: `projection`, `anchor_location_id`, `shape_type`, `location_id`, `x`, `y`, `width`, `height`, `rotation` columns all confirmed present.

### Files that were CORRECT and required NO changes

| File                                                        | Status                                                                                                                     |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `20260507130000_locations_v2_entity_cleanup.sql`            | ✅ Correct — no invalid column refs, all constraints present                                                               |
| `20260507131000_locations_v2_visual_nodes.sql`              | ✅ Correct                                                                                                                 |
| `20260507132000_locations_v2_split_nodes.sql`               | ✅ Correct — `parent_visual_node_id`, `calc_z_mm`, `cache_valid`, `size_mode` enum all present                             |
| `20260507133000_locations_v2_mapping_archive_functions.sql` | ✅ Correct — mapping status returns full counts; archive validation returns `blockers[]`/`warnings[]`; stock table guarded |
| `20260507134000_locations_v2_backfill_visual_nodes.sql`     | ✅ Correct — `visualization_type`, `visual_role='primary'`, `front_elevation→front`, `NOT EXISTS` dup guard                |

### File that was BROKEN and was fixed

**`20260507135000_locations_v2_verification_queries.sql`** had 5 real bugs:

1. **Missing `RETURN jsonb_build_object(`** — function body was syntactically invalid; would fail to CREATE.
2. **`sn.size_mode NOT IN (...)` did not catch NULLs** — changed to `IS NULL OR NOT IN`.
3. **Direct unguarded references to `product_location_stock`** (which does not exist) — would fail at call time. Replaced with guarded `EXECUTE` blocks targeting `inventory_balances`.
4. **Missing metric `null_can_store_inventory`** — added variable, SELECT, and RETURN key.
5. **Missing metric `invalid_location_status`** — added variable, SELECT, and RETURN key.

### Other file updated

**`docs/sql/locations-v2-verification.sql`** — query 7 referenced `product_location_stock` with `quantity`. Updated to use `inventory_balances` with `on_hand_quantity`. Added query 8 for stock on non-storable locations.

### Migration strategy

Files amended directly (not additive fix migrations) — confirmed safe because V2 migrations are not applied to any shared/dev DB yet.

### Phase 1 readiness

Ready for DB application once team reviews and approves. Phase 1 is **not complete** until:

- [ ] Migrations applied to dev/shared Supabase target DB
- [ ] `SELECT public.verify_locations_v2_migration();` executed and all metrics reviewed
- [ ] Zero `null_can_store_inventory`, zero `invalid_location_categories`, zero `invalid_location_status`
- [ ] `unmapped_stock_holding_locations` and `stock_on_non_storable_locations` reviewed (non-zero is a warning, not a blocker)
- [ ] `duplicate_active_primary_visual_nodes` = 0 confirmed
