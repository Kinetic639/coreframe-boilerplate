# IC-5 Changed Files

**Baseline**: `97f0e9d923cefbf9043eaefcab25d4c1cf9315b1` (commit `ic7a`).
**Total (original pass + narrow correction pass combined)**: 21 files.
See `diff.patch` for the exact `git diff --cached --stat` against
baseline (original pass alone was 15 files, 2758 insertions(+), 12
deletions(-); the correction pass added 6 new migration files plus
amendments to the 3 doc files and the pgTAP file already counted
above).

This bundle covers IC-5 only. It deliberately excludes the 4 TypeScript
files still uncommitted from IC-4/IC-4-correction (`inventory-enterprise.
service.ts`, `schemas.ts`, `index.ts`, `event-registry.ts`) — IC-5
required zero TypeScript/application changes (entirely PL/pgSQL) and
those 4 files are unmodified by this phase; they remain covered by
`docs/inventory/reviews/ic-4-review/`.

## New migrations (11, all applied live via MCP, mirrored locally under

their exact live timestamp)

1. `20260916182701_ic5_projection_quantity_nonnegative_check.sql` — `CHECK (quantity >= 0)` on `repair_order_line_locations`.
2. `20260916182708_ic5_projection_tables_restrictive_rls.sql` — explicit RESTRICTIVE deny INSERT/UPDATE/DELETE on both projection tables.
3. `20260916182731_ic5_rebuild_repair_order_projection_bucket_internal.sql` — new internal-only rebuild primitive (per-bucket).
4. `20260916182747_ic5_rebuild_repair_order_location_projection_rpc.sql` — new public per-RepairOrder rebuild wrapper.
5. `20260916182821_ic5_repair_order_location_attribution_sync_reversal_aware.sql` — trigger gains reversal-awareness (v1).
6. `20260916183020_ic5_attach_repair_order_line_movement_projection_sync.sql` — attach gains auto-rebuild (v1, later corrected).
7. `20260916184159_ic5_movement_links_allow_relocation_relation_type.sql` — adds `'relocation'` to the `relation_type` CHECK.
8. `20260916184230_ic5_putaway_repair_order_stock_relocation_link.sql` — putaway writes a relocation link (v1, field-matched — later corrected).
9. `20260916184329_ic5_putaway_repair_order_stock_fix_line_correlation.sql` — putaway relocation-link write corrected to ordinal correlation.
10. `20260916184357_ic5_trigger_mirror_relocation_on_reversal.sql` — trigger's reversal-mirroring filter extended to include `'relocation'`.
11. `20260916185523_ic5_fix_attach_double_write_via_authoritative_guc.sql` — attach's auto-rebuild gated by the authoritative GUC (fixes the live-caught 101/104 double-write regression).

Items 5/6/8 are superseded-in-place-but-kept versions (10/9/11 are the
corrected final forms); all 11 are real, separately-applied forward
migrations per this project's never-edit-an-applied-migration
discipline — none were edited after being applied.

## New migrations, narrow correction pass (6, same discipline)

12. `20260916201207_ic5c_write_repair_order_line_movement_link_internal.sql` — new internal canonical writer (v1, 4-arg — later corrected).
13. `20260916201228_ic5c_attach_uses_internal_writer.sql` — attach refactored to use it.
14. `20260916201300_ic5c_putaway_uses_internal_writer.sql` — putaway refactored to use it.
15. `20260916201328_ic5c_trigger_bucket_fix_and_internal_writer.sql` — trigger's reversal bucket-derivation fix + internal-writer usage (v1 — later corrected).
16. `20260916201516_ic5c_internal_writer_add_require_posted_param.sql` — internal writer corrected to 5-arg with `p_require_posted` (old 4-arg overload explicitly dropped).
17. `20260916201541_ic5c_trigger_reversal_mirror_skip_posted_check.sql` — trigger's reversal-mirror call updated to pass `p_require_posted => false`.

Items 12/15 are superseded-in-place-but-kept versions (16/17 are the
corrected final forms); all 6 are real, separately-applied forward
migrations per the same never-edit-an-applied-migration discipline.

## New test file

- `apps/web/supabase/tests/107_ic5_repair_order_projection_test.sql` — `plan(33)` → `plan(46)` (correction pass added Scenarios Q/R/S/T), final 46/46.

## Documentation

- `docs/inventory/inventory-core-architecture.md` — new §9C; correction pass corrected the "attach is the sole writer" claim and appended its own subsection.
- `docs/inventory/inventory-core-implementation-plan.md` — IC-5 section marked DONE; correction pass noted.
- `docs/inventory/inventory-core-progress.md` — runtime-status header, phase-tracker row, overall-execution summary, change-log entries for both the original pass and the correction pass.

## Not touched this phase

- `inventory_reverse_movement` (generic reversal engine) — read in full, confirmed unchanged, remains RepairOrder-agnostic.
- `receive_repair_order_stock`, `putaway_repair_order_stock`'s own core business rules (UNKNOWN hard-rejection, quantity validation) — unchanged except for the additive relocation-link write.
- Any UI/read-model consumer (`getPhysicalStateForLine` etc.) — no UI/read-model work this phase, per explicit instruction.
- `repair_order_line_movement_links`'s own raw-write RLS — already closed since an earlier IC-2-era migration, not reopened.
