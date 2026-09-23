# IC-8 — Section 5: Live-vs-Clean Schema Parity

## Status: BLOCKED (dependent on Section 3/4)

Section 5 requires diffing the schema produced by a clean migration replay
against the live `supabase-target` schema. Section 3 (Clean Database
Replay) is itself **REPRODUCIBILITY BLOCKED** — the clean replay fails at
migration #38 of 200 (`20260505091000_inventory_phase1_core.sql`,
`42P01: relation "public.warehouse_locations" does not exist`), long
before a complete schema exists to diff against. See
`migration-reproducibility.md` for the full investigation.

There is no partial substitute that would be meaningful here: a diff
between the live schema and a database that stopped replaying 162
migrations short of complete would trivially show hundreds of
"missing" objects, none of which represents a real parity defect — it
would only restate the already-disclosed reproducibility gap in a
different form, not surface any NEW information.

**Not fabricated as passing, not silently skipped.** This gate remains
BLOCKED for the same root cause as Section 2/3, and is counted as such in
the final freeze-criteria synthesis (`final-readiness-assessment.md`).
