# Pilot Ready Gate

Additional requirements beyond Presentation Ready, before real users operate on real data in a controlled pilot. This gate is intentionally separate from — and larger than — the presentation gate; nothing here blocks this week's pitch.

## Pilot bootstrap

- Real pilot organization/branch setup, distinct from demo/rehearsal data.
- Initial stock strategy: how existing physical inventory gets loaded into Ambra at pilot start (not addressed by any current zone doc in detail — a genuine open item).
- Permissions/roles setup for real pilot users (owner, warehouse worker, advisor/acceptor, possible branch manager) — Zone 1's own doc already scopes this exact role set for pilot E2E testing.

## Correction/reversal UX decision

- `inventory_reverse_movement` needs a UI decision: build a minimal reversal UI, or explicitly accept "support/admin fixes only" as the pilot-scope answer. Currently an unresolved silent gap (see Inventory Core's own `accepted-technical-debt.md`, item B1) — must become an explicit decision before pilot, since real users WILL eventually post a wrong movement.
- Same open-decision status for RepairOrder receive/putaway UI if the pilot's own scope includes real RepairOrder receiving (distinct from whether the presentation needs it, which is already a confirmed blocker per `presentation-ready-gate.md`).

## Multi-user hardening

- Zone 1: last-owner protection (currently absent at every layer — action, service, RLS), self-demotion warning, full privilege-escalation verification across the admin surface, invitation accept-time one-organization revalidation.
- Zone 1: Matcher RLS is organization-scoped despite a `branch_id` column on every table — tolerable for a single-branch, single-account demo, NOT acceptable once a pilot introduces multiple real branches/users (any org member could read/act on another branch's delivery sessions).
- Zone 1: Help Desk has the same organization-only RLS pattern.
- Concurrency: simultaneous role/branch changes for the same user, concurrent role/ownership mutation — unverified.
- Zone 3: idempotent Matcher→RepairOrder import (duplicate WDD document protection), concurrent-import safety (two employees processing deliveries at once), transactional boundaries on RepairOrder/line creation.
- Zone 5: idempotent Matcher import into movement 101, concurrent receiving-quantity race protection, partial-delivery reporting policy.
- Zone 6: server-side pagination (currently client-side over up to 2000 rows/branch), concurrent-relocation race protection.
- Inventory Core's own already-accepted debt: reservation/allocation lock contention under real concurrent load (never measured — no safe tooling was available during IC-8), shared per-org `inventory_settings` row lock contention across all document types.

## Monitoring / operational support

- Zone 10 (Notifications): at minimum one real producer→delivery pair (e.g. "ticket needs acceptance" email) if pilot scope requires operational alerting — currently zero delivery engine exists at all.
- Administrative audit trail: Zone 1 explicitly lists this as PILOT-required (sensitive admin actions — role change, branch reassignment, invitation creation — should be auditable); currently unimplemented.
- Zone 8: automated test coverage for Help Desk authorization (currently zero tests of any kind).

## Backups / disaster recovery

- **Clean-room database reproducibility** — Inventory Core's own already-accepted, already-documented technical debt (`docs/inventory/reviews/inventory-core-final-pilot-freeze/accepted-technical-debt.md`, Group A). **Per this task's own explicit instruction, this is NOT elevated to a pilot blocker here** unless a new, concrete operational reason emerges (e.g. an actual DR event, a planned environment migration). No such reason has surfaced during this audit.
- Schema/migration source-of-truth reconciliation: two parallel migration trees (`apps/web/supabase/migrations` "legacy" vs `apps/web/supabase-target/supabase/migrations` "target") — Zone 1's own doc lists this as a PILOT-required reconciliation (decision 44), separate from and narrower in urgency than full clean-room reproducibility.
- Missing repository migrations for `qr_codes`/`qr_assignments` (confirmed again this pass, Zone 4) — a specific, disclosed instance of the broader schema-drift problem.

## Initial stock strategy

- Not addressed in detail by any current zone doc — a genuinely open pilot-planning item, distinct from and in addition to the "receiving" workflow itself (receiving handles ongoing deliveries; initial stock load is a one-time bulk-load problem with different constraints).

## Known technical-debt acceptance (carried forward, not re-litigated here)

All 11 items from Inventory Core's own `accepted-technical-debt.md` Group B (reservation/allocation/container audit-trail enhancement, reversal UI, RepairOrder receive/putaway UI as a PRODUCT decision distinct from presentation need, unmeasured performance items, document-numbering DRY debt, valuation snapshot, ledger partitioning, misc low-risk items) remain accepted, deferred debt for pilot planning purposes — see that document directly rather than duplicating it here.

## Any genuinely required Phase 14/15 items

None identified beyond what's listed above — no zone doc or this audit's own findings surfaced a distinct "Phase 14/15"-labeled requirement; the pilot gate is fully described by the sections above.

## Explicit non-requirement, per this task's own instruction

**Clean-room migration reproducibility is NOT a pilot blocker** unless a new, concrete operational reason appears (see Backups/DR above) — this task's own instruction is followed exactly, not reopened or second-guessed.
