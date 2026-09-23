# IC-8 — Migration Reproducibility (HARD GATE — BLOCKED)

## Verdict

**REPRODUCIBILITY BLOCKED.** A from-scratch clean replay of the repository's
own migration directory does NOT produce the accepted live schema. This is
a genuine, previously-underestimated finding, not a fabricated or assumed
one — verified live, against a real, empty, disposable Postgres 17.6
Supabase project, using every one of the repository's 200 migration files
in order.

## What was known before this pass

The architecture compression review and every IC-phase since IC-5 have
consistently disclosed a narrower finding: "7 live `zone5_*`-named
migrations were never locally mirrored," assigned to IC-8 as a hard gate.
This pass:

1. **Reconstructed all 7** of those migrations at their own original live
   timestamps, from cross-validated evidence (live-captured function
   bodies pre-dating their A8 removal, explicit "kept byte-for-byte
   unchanged" disclosures in later already-mirrored migrations' own header
   comments, live-confirmed table schemas, live-confirmed unmodified
   functions, and the established RLS/grant patterns used identically
   elsewhere in this schema). Two of the seven (the exact intermediate
   bug-fix content of `zone5_attribution_sync_trigger_max_uuid_fix` and
   `zone5_receive_repair_order_stock_rpc_v2`) could not be recovered
   separately from their own immediate successors and are represented as
   disclosed no-op placeholders at their own original timestamps, with the
   successor reconstruction carrying the collapsed content — explicitly
   NOT inventing semantics for the unrecoverable delta.
2. Attempted an actual clean replay to validate this reconstruction (and
   the repository's own broader reproducibility) live.

## What this pass discovered: a much larger, previously-undisclosed gap

The clean replay did not reach the zone5 window at all — it failed much
earlier, at migration #38 of 200
(`20260505091000_inventory_phase1_core.sql`), with:

```
error: relation "public.warehouse_locations" does not exist
code: 42P01
```

Investigating this precisely (not merely patching around it) revealed the
true scope, via a systematic version-and-name cross-reference between
every migration in `supabase_migrations.schema_migrations` on the live
target (293 rows) and every local `.sql` file (200 files, pre-existing
plus this pass's own 7 reconstructions):

- **149 live-applied migration versions have no local file at the same
  timestamp.**
- Of those, **106 have no local file matching even by NAME** (i.e. this is
  not merely a local timestamp-renumbering of the same logical changes —
  the content itself is unaccounted for locally).
- Cross-referencing those 106 by keyword, a meaningful subset is
  **core Inventory infrastructure, not unrelated feature work**:
  - `movement_v1_01_dev_reset` through `movement_v1_11_save_draft_rpc` —
    the foundational movement-engine migration series itself.
  - `warehouse_locations_table` — the base `warehouse_locations` table.
  - `warehouse_location_hierarchy_functions`, `warehouse_locations_rls_hardening`,
    and ~20 further `warehouse_location_*`/`warehouse_layouts*` migrations.
  - `svwms_wdd_matcher_tables`/`svwms_wdd_matcher_storage` and 3 further
    `wdd_matcher_*` migrations — the provenance-chain tables
    `receive_repair_order_stock` itself depends on
    (`workshop_source_document_lines`, `repair_order_line_source_links`).
- Direct `CREATE TABLE` searches across all 200 local files confirm, with
  certainty, that the following tables — among the most foundational in
  the entire Inventory Core schema — have **no local migration creating
  them at all**:
  - `public.inventory_stock_ledger_entries` (physical history — Concept A
    of the entire architecture)
  - `public.inventory_movement_audit_log`
  - `public.warehouse_locations` (the base table; the `purpose` column
    added by this pass's own zone5 reconstruction assumes it already
    exists, consistent with this finding)
  - `public.inventory_movement_headers` IS created locally
    (`20260505091000_inventory_phase1_core.sql`), but that very migration
    is the one that fails, since it also references `warehouse_locations`
    earlier in its own body.
- The remaining ~70 of the 106 name-unmatched migrations are genuinely
  **out-of-scope, unrelated product modules** sharing the same database
  (CRM, Helpdesk, Planning, Analytics, QR platform, calendar, generic
  app comments/attachments, tools module) — not Inventory Core's own
  concern, but still part of what a truly-from-empty replay must
  traverse if later Inventory migrations were ever applied live
  interleaved with them (not confirmed either way in this pass).

## Root cause (best understanding, disclosed as inference, not certainty)

The local migrations directory's own history reliably matches the live
target — by BOTH timestamp and name, with zero exceptions found — starting
at `20260910071815_enable_pgtap_extension`. Before that point, local files
use a **different, synthetic timestamp scheme** (e.g. `20260321000001`,
`20260505090000`, round-numbered `...090000`/`...120000`-style
timestamps) that does not correspond to when anything was actually
applied live, strongly suggesting the local repository underwent a
consolidation/reorganization of its own early history at some point
before this project's own current "verify every migration live" IC-phase
discipline began. That consolidation appears incomplete: it captured some
of the early platform/warehouse/inventory lineage but not all of it, and
did not capture the movement engine's own foundational migrations, the
wdd_matcher tables, or any of the unrelated feature modules at all.

**This is disclosed as the most likely explanation, not asserted as
proven fact** — no changelog or review bundle from that period was found
in this pass documenting the reorganization itself.

## Separately discovered: live migration-tracking has its own gap, going forward

`supabase_migrations.schema_migrations` (Supabase's own internal
applied-migration bookkeeping, the source for `list_migrations`) stops at
`20260922082141_a7_correction_narrow_public_generic_eligibility` — it does
NOT contain any of A8's own 7 migrations, even though A8 is fully applied
live (confirmed independently: the tables/trigger/functions A8 touches
are live-confirmed in their post-A8 state). This is because this entire
project's own established methodology, from A1 onward, applies live
changes via direct `execute_sql` calls (with manual local-file mirroring
afterward) rather than the `apply_migration` MCP tool or Supabase CLI —
and only the latter register in this tracking table. This does not affect
the accuracy of the local `.sql` mirror files themselves (each was
independently live-verified via `pg_get_functiondef`/grant inspection
after applying, per this project's own standing discipline) but means
`supabase_migrations.schema_migrations`/`list_migrations` cannot be
trusted as a complete picture of "what changed live" for anything from
A1 onward — only for migrations applied via the tracked mechanism, which
is everything through `a7_correction_narrow_public_generic_eligibility`.
Recorded here for Section 30 (Migration Hygiene) as well.

## What was validated successfully

- The first 37 of 200 local migrations (2026-03-20 through the point
  immediately before `inventory_phase1_core`) applied cleanly to a fresh,
  empty Postgres 17.6 database with byte-identical extension baseline to
  the live target (confirmed: `pg_stat_statements`, `pgcrypto`, `plpgsql`,
  `supabase_vault`, `uuid-ossp` present on both; `pgtap`/`pg_trgm` present
  live, expected to be added by later, un-reached local migrations).
- This pass's own 7 zone5 reconstructions are syntactically well-formed
  and internally consistent with every cross-validated piece of evidence
  gathered (schema, signatures, grants, trigger binding) — but were
  **not** reachable by the clean replay to prove this via actual
  execution, since the replay fails at migration #38, long before
  reaching migration #170 (`zone5_receiving_location_purpose`) in
  sequence. Their own correctness is therefore evidenced by static
  cross-validation only, not by a successful live clean-replay execution.

## Disposition

Per this task's own explicit instruction ("If exact historical
reconstruction cannot be proven: STOP and report REPRODUCIBILITY BLOCKED.
Do not fake migration parity"), and per the user's own explicit direction
after this finding was surfaced: **this gate is reported as BLOCKED,
not fabricated as passing.** Reconstructing the full ~100+ migration gap
(spanning the movement engine's own foundational schema and several
entirely unrelated product modules) was explicitly declined as
out-of-scope for this pass — it is a materially larger undertaking than
the 7-file zone5 reconstruction, would require reconstructing modules
with zero relationship to Inventory Core, and risks exactly the kind of
low-confidence, semantics-inventing reconstruction this task's own
instructions forbid.

**The rest of IC-8 proceeds against the live, accepted `supabase-target`
project directly** (not the clean replay), per explicit user direction.
Every section that specifically depends on a working clean-replay
environment (Section 4 clean seed, Section 5 schema parity, Section 9
clean-environment pgTAP, Section 27 clean-room app boot) is marked
BLOCKED / NOT EXECUTABLE in its own section of this review, not silently
skipped.

## Evidence artifacts

- `migration-manifest.md` (this bundle) — the full, final migration
  manifest, including this pass's own 7 reconstructions.
- The disposable Supabase project used for this test (`rzkzypgiyjhruwkmqnlg`)
  was created solely for this pass, at the user's own explicit
  direction, on a separate account, specifically to avoid any risk to
  the shared live target. It has not been deleted by this pass (deletion
  left to the user's own discretion, since it is the user's own account).
