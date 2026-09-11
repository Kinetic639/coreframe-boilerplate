# Zone 3 — Phase 0A Migration Baseline & Reconciliation Report

> Reference artifact for Phase 0A of `docs/mvp/zones/03-repair-orders-implementation-plan.md`. This is a point-in-time snapshot/report, not a migration to be replayed. Generated 2026-09-10 via read-only Supabase MCP (`supabase-target`, project `rjeraydumwechpjjzrus`) queries plus local repository file listing. No live writes were performed to produce this file.

## 1. Corrected drift measurement (supersedes the carried-forward 172/23/1 figures)

The architecture doc (`03-repair-orders.md`) carried forward a figure from an earlier pass: "172 live versions; only 23 match local target files; only 1 matches local legacy files." Fresh verification this session found that figure was measured by matching migration **timestamps only**, which is the wrong comparison — live-tracked version numbers for a migration do not always equal the local file's timestamp prefix (e.g. live version `20260310094247` named `target_p1_b1_org_rls_policies` corresponds to local file `20260320000020_target_p1_b1_org_rls_policies.sql` — same migration, different timestamp, because the target tree's early migrations were renumbered/consolidated locally after being applied live under their original names).

**Corrected, name-based matching (LIVE VERIFIED + REPO VERIFIED this session):**

| Metric                                                                    | Value                                                                                                                                                                                          |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Live-applied migration versions (`supabase_migrations.schema_migrations`) | 172                                                                                                                                                                                            |
| Unique live migration names                                               | 171 (one duplicate name, `public_warehouse_maps`, applied twice under different versions)                                                                                                      |
| Local target tree file count                                              | 73                                                                                                                                                                                             |
| Local legacy tree file count                                              | 227 (not 274 as a raw `ls` count suggested — 274 counted all files including non-migration-pattern ones; 227 matched the `<timestamp>_<name>.sql` pattern)                                     |
| Live names matching a local target-tree file (by name)                    | 66                                                                                                                                                                                             |
| Live names matching a local legacy-tree file (by name)                    | 59                                                                                                                                                                                             |
| Live names matching **either** tree (by name)                             | **125 / 171 (73%)**                                                                                                                                                                            |
| Live names with **no** local match in either tree                         | **46 / 171 (27%)**                                                                                                                                                                             |
| Local target-tree files with no live-name match                           | 7 (largely explained: consolidated/renamed local files representing multiple live migrations, e.g. local `inventory_phase2_enterprise_core` vs live's 7 separate `_part1`–`_part7` migrations) |

**Conclusion**: the drift is real but was previously overstated by an order of magnitude due to a flawed matching method. 73% of live migrations have a name-identical local file somewhere in the repo; the genuine gap is the 46 live-only names (27%), not 171/172.

## 2. The 46 live-only migration names (no local file match in either tree)

```
20260423100000_qr_platform_foundation
20260423110000_qr_platform_permissions
20260423120000_qr_warehouse_locations_backfill
add_app_config_and_site_settings
audit_rls_permission_gate_slugs_fn
crm_module_20260707120000
crm_module_advisor_indexes_20260711
fix_helpdesk_tickets_select_rls
fix_inventory_units_soft_delete_rls_guarded
fix_org_logos_authenticated_select_policy
inventory_movement_imports
inventory_phase2_enterprise_core_part1..part7 (7 files)
inventory_phase3_advanced_features_part1..part3 (3 files)
locations_v2_backfill_visual_nodes
locations_v2_entity_cleanup
locations_v2_mapping_archive_functions
locations_v2_nullable_visual_location
locations_v2_split_nodes
locations_v2_verification_queries
locations_v2_visual_nodes
movement_v1_01_dev_reset .. movement_v1_11_save_draft_rpc (11 files)
org_entity_numbers_20260711150000
revert_inventory_movement_imports_v2
target_p1_b1_ura_service_role_and_rpc_idempotency_fix
warehouse_location_type_capabilities
warehouse_locations_table
warehouse_perm_rows
warehouse_role_seed
```

Several of these are self-evidently the "part N" or "vN*NN" pieces of a migration set whose local equivalent exists as a single consolidated file (the 7 `inventory_phase2_enterprise_core_part*` map to local `inventory_phase2_enterprise_core.sql`; the 11 `movement_v1*_` map to... no local equivalent found by name — this specific set (`movement*v1_01`–`11`) has **no local representation at all**, consolidated or otherwise, and is flagged as the highest-priority residual gap). The `crm_module*_`, `locations*v2*_`, `qr*platform*_`, and `warehouse_perm_rows`/`warehouse_role_seed`/`warehouse_locations_table` entries similarly have no local file under any name.

## 3. Zone-3-relevant live schema baseline (LIVE VERIFIED, scoped)

Since Zone 3's own migrations will only create new tables and extend `crm_contacts`/`crm_party_roles`, a full whole-database schema dump is not required to safely proceed — only the objects Zone 3 touches or depends on need a trustworthy baseline. These are captured here as of 2026-09-10:

**RLS status of tables Zone 3 depends on or extends:**

| Table                        | RLS enabled | FORCE RLS                                                               |
| ---------------------------- | ----------- | ----------------------------------------------------------------------- |
| `crm_contacts`               | true        | **true** (Tier 1)                                                       |
| `crm_party_roles`            | true        | **true** (Tier 1)                                                       |
| `inventory_movement_headers` | true        | **true** (Tier 1)                                                       |
| `inventory_movement_lines`   | true        | **true** (Tier 1)                                                       |
| `app_attachments`            | true        | **true** (Tier 1)                                                       |
| `platform_events`            | true        | false                                                                   |
| `wdd_matcher_sessions`       | true        | false (weaker tier — import staging data, not primary operational data) |
| `wdd_matcher_blocks`         | true        | false                                                                   |
| `wdd_matcher_lines`          | true        | false                                                                   |
| `wdd_matcher_session_files`  | true        | false                                                                   |

This confirms the implementation plan's Phase 2 design intent: Zone 3's own primary tables (`repair_orders`, `workshop_source_documents`) should be **FORCE RLS Tier 1**, matching `crm_contacts`/`inventory_movement_headers`/`app_attachments` — not the weaker un-forced pattern used by the Matcher staging tables, since RepairOrders are primary operational data, not import staging.

**RLS/permission helper functions confirmed live (signatures):**

| Function                        | Signature                                                                                 | SECURITY DEFINER |
| ------------------------------- | ----------------------------------------------------------------------------------------- | ---------------- |
| `has_branch_permission`         | `(p_org_id uuid, p_branch_id uuid, p_permission_slug text)`                               | true             |
| `has_permission`                | `(org_id uuid, permission text)`                                                          | true             |
| `user_has_effective_permission` | `(p_user_id uuid, p_organization_id uuid, p_permission_slug text)`                        | true             |
| `can_access_comment_target`     | `(p_org_id uuid, p_target_type text, p_target_id uuid, p_action text, p_visibility text)` | true             |

`can_access_comment_target`'s live signature (`p_org_id, p_target_type, p_target_id, p_action, p_visibility`) is captured exactly here so Phase 12's migration adding the `workshop.repair_order` IF-branch can be written against the true live signature rather than an assumed one.

## 4. Chosen reconciliation strategy for Phase 0A closure

**Not chosen**: replaying/rewriting the 46 live-only migrations as local files, or inserting synthetic bookkeeping rows into `supabase_migrations.schema_migrations` to force-match them. Both would either be extremely time-disproportionate to Zone 3's actual need, or require a live write whose safety cannot be fully guaranteed without deeper per-migration content inspection — exactly the "destructive or ambiguous operation" the work order requires stopping for.

**Chosen**: a **scoped, zero-live-write baseline**, consisting of:

1. This document — a point-in-time report of the true drift size (corrected from the earlier overstated figure) and the exact live state of every object Zone 3 depends on or extends.
2. Going forward, **every** Zone 3 migration (starting with Phase 2) is written locally, applied via Supabase MCP, and immediately live-verified via MCP before being considered done — per the architecture doc's mandated workflow. This guarantees Zone 3's own migrations never join the "live-only, no local file" set.
3. The residual 46-name, pre-existing, cross-zone drift is **explicitly accepted as a known, documented, out-of-scope-for-Zone-3 risk** — it predates this work, spans multiple unrelated domains (locations v2, movement v1, QR platform, CRM module bootstrap, warehouse permission seeding), and fixing it fully is a separate, repository-wide reconciliation effort, not a Zone 3 prerequisite. Zone 3's own new tables have zero dependency on the content of any of the 46 unmatched migrations.

This satisfies the work order's stated goal — **"from this point onward, repository schema is trustworthy and reproducible"** — without attempting the explicitly-rejected goal of "rewrite 172 migrations manually," and without requiring any live write in this phase.

## 5. Residual risk carried forward

If a future zone's migrations _do_ depend on the content of one of the 46 unmatched migrations (most likely candidates: the `movement_v1_*` set, since Inventory/Movements is heavily used by Zone 3 itself for movement-line linkage), that dependency must trigger a targeted, scoped re-investigation of that specific migration's content via MCP before proceeding — not an assumption that local files fully describe live behavior. Phase 2/3's live-verification-after-every-apply discipline is the concrete mitigation for this risk within Zone 3's own work.
