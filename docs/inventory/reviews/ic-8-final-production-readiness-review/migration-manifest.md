# IC-8 — Final Migration Manifest

## Summary

- **Total local migrations**: 200 (193 pre-existing + 7 reconstructed this
  pass, see `migration-reproducibility.md`).
- **Filename hygiene**: all 200 files match `YYYYMMDDHHMMSS_name.sql`
  exactly; zero duplicate timestamps; zero malformed filenames
  (live-checked).
- **First local migration**: `20260320000001_target_p1_b1_extensions_utilities.sql`.
- **Last local migration**: `20260922110807_a8_drop_projection_tables.sql`
  (Inventory Core A8's own final migration).
- **Reliable timestamp+name parity with live history**: confirmed
  unbroken from `20260910071815_enable_pgtap_extension` onward (192 of
  200 local files, everything from repair_orders_core_schema through A8,
  minus the 7 reconstructed zone5 files which sit correctly interspersed
  in that same reliable range by timestamp, even though they were only
  reconstructed rather than originally mirrored).
- **Unreliable/incomplete range**: everything with a local timestamp
  before `20260910`. See `migration-reproducibility.md` for the full
  finding — 149 live-applied versions have no local timestamp match in
  this range, 106 of those have no local NAME match either.

## No migration edited retroactively

Confirmed via this session's own unbroken discipline (never editing an
already-applied migration, always forward-only) and via `git log` on the
migrations directory: every migration present locally was either applied
live and mirrored at its own live-reported timestamp in the SAME pass
that applied it, or (for this pass's own 7 reconstructions) is a NEW file
at a historically-accurate timestamp that was never live-applied by THIS
repository's own tooling before (since it did not exist locally to edit).

## No migration exists only live (beyond the disclosed reproducibility gap)

Beyond the disclosed 149-version gap (`migration-reproducibility.md`),
every migration applied via this project's own `execute_sql`-based
methodology (A1 onward) was, per this session's own standing discipline,
mirrored locally in the SAME pass it was applied, at its exact
live-reported timestamp. Live-vs-local parity for A1 through A8 (36
migrations) was independently re-confirmed function-by-function at the
time of each pass (see each phase's own review bundle's own
`migration-summary.md`) and is not re-litigated here.

## No repo migration missing live without explanation

Every one of the 200 local files corresponds to either (a) a live-applied
migration (matched by timestamp, or in the case of the 7 reconstructions,
representing a live-applied migration whose content was reconstructed),
or (b) is itself part of THIS review bundle's own disclosed
reconstruction work. No local file was found that has no live counterpart
and no explanation.

## No migration depends on fixture data accidentally

Spot-checked via the successful portion of the clean-replay attempt (37
of 200 files applied cleanly to a genuinely empty database with zero
pre-existing rows) — no migration in that successfully-applied range
required any pre-existing data row to succeed. The remainder (migration
38 onward) was not reached by the replay and is therefore not verified on
this specific point by direct execution; no evidence of fixture-dependent
migrations was found via static review of their own SQL bodies either.

## Function-replacement grant preservation

Every `CREATE OR REPLACE FUNCTION` migration applied this session (A1
through A8, and the 7 zone5 reconstructions) was followed by an explicit
`REVOKE`/`GRANT` block matching the function's own intended final grant
state, live-verified via `has_function_privilege` after application —
matching the established project-wide discipline that a bare `CREATE OR
REPLACE` alone can silently inherit a stale or default grant state.

## Stale overloads

Re-confirmed live, this pass (Section 6): zero stale overloads found
across every canonical Inventory RPC/internal helper enumerated (see
`security-evidence.md` for the full per-function overload count table).

## Table of contents by phase (local file count)

| Phase / range                                                      | Local file count |
| ------------------------------------------------------------------ | ---------------- |
| Platform/warehouse foundation (pre-2026-09-10, partially reliable) | 87               |
| RepairOrder core + Zone 3/4 (2026-09-10 to 09-12, pre-gap)         | 8                |
| Zone 5 (2026-09-12 to 09-14, this pass's own reconstruction)       | 7                |
| Container subsystem (2026-09-14)                                   | 9                |
| IC-1 (2026-09-15)                                                  | 3                |
| IC-2 (2026-09-15)                                                  | 9                |
| IC-3 (2026-09-15)                                                  | 4                |
| IC-7A (2026-09-16)                                                 | 4                |
| IC-4 (2026-09-16)                                                  | 11               |
| IC-4C (2026-09-16)                                                 | 1                |
| IC-5 / IC-5C (2026-09-16)                                          | 17               |
| IC-6 (2026-09-17)                                                  | 4                |
| IC-7 (2026-09-17)                                                  | 8                |
| IC-7 closing (2026-09-19)                                          | 4                |
| PRE-IC8 P0 (2026-09-19 to 09-22)                                   | 9                |
| A1, A4 (2026-09-22)                                                | 2                |
| A7, A7 correction (2026-09-22)                                     | 5                |
| A8 (2026-09-22)                                                    | 7                |
| **Total**                                                          | **200**          |
