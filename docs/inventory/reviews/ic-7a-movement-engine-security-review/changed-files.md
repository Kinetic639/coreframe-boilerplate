# IC-7A — Changed Files

**Branch**: `zone3-zone5-integration-audit`.
**Baseline SHA**: `f549b25cffd19923e623d76534fa5a79c9f10a30` (commit
`ic3`) — confirmed clean working tree at this exact commit before any
IC-7A work began.
**Working tree at packaging time**: clean except the exact files listed
below (verified via `git status --short` immediately before packaging).

## New files (6)

| File                                                                                                              | Purpose                                                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/supabase-target/supabase/migrations/20260916050440_ic7a_harden_inventory_create_draft.sql`              | Adds actor-identity + permission checks to `inventory_create_draft`; adds the (initially overly-broad, self-caught) system-movement-type guard; revokes `anon`/PUBLIC EXECUTE, keeps `authenticated`/`service_role`.                                                 |
| `apps/web/supabase-target/supabase/migrations/20260916050528_ic7a_harden_inventory_finalize_posting_internal.sql` | Adds actor-identity + permission checks to `inventory_finalize_posting_internal` (the shared choke point for both the public 2-arg finalize wrapper and `inventory_reverse_movement`); re-confirms the public wrapper's own grants.                                  |
| `apps/web/supabase-target/supabase/migrations/20260916050557_ic7a_harden_inventory_create_and_finalize.sql`       | Adds the same actor + permission checks directly to `inventory_create_and_finalize`, as defense in depth; revokes `anon`/PUBLIC EXECUTE.                                                                                                                             |
| `apps/web/supabase-target/supabase/migrations/20260916050815_ic7a_fix_system_type_guard_overly_broad.sql`         | Corrective: fixes the self-caught `is_system`-based guard defect from migration 1 (caught before any test ran).                                                                                                                                                      |
| `apps/web/supabase/tests/105_ic7a_movement_engine_security_boundary_test.sql`                                     | New pgTAP file: 29/29 — anon negatives (Scenario K), exploit replay (Scenario Q), authenticated-no-permission (Scenario L), actor impersonation (Scenario O), NULL-actor (Scenario P), system-type guard (Scenario R), all legitimate flows still work (Scenario M). |
| `docs/inventory/reviews/ic-7a-movement-engine-security-review/` (this bundle)                                     | Review packaging.                                                                                                                                                                                                                                                    |

## Modified files (4)

| File                                                         | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/supabase/tests/103_ic2_movement_reversal_test.sql` | **Scenario E REPOSITIONED, not rewritten** — moved from after Scenario C to immediately after Scenario D, mirroring Scenario D's own already-established ordering rationale. This pass's own new `inventory_create_draft` permission check surfaced that Scenario E's own draft creation depended on Scenario C's own permission-strip not yet having run. Every assertion, fixture value, and line of Scenario E's own logic is byte-for-byte unchanged — only its position in the file moved. Diff is large (217 lines changed) because the whole block relocated; a line-by-line diff of old vs. new Scenario E content is identical. |
| `docs/inventory/inventory-core-architecture.md`              | New §9A ("IC-7A — Emergency Movement Engine Security Boundary Closure"). §9's own CRITICAL table row updated from "NOT fixed this pass" to "CLOSED," pointing to §9A.                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `docs/inventory/inventory-core-implementation-plan.md`       | New, explicitly out-of-roadmap-order "IC-7A" section inserted between IC-3 and IC-4. A note appended to the full IC-7 section clarifying only this one item closed early — IC-7 itself remains NOT done.                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `docs/inventory/inventory-core-progress.md`                  | Runtime status → IC-7A DONE; new phase-tracker row inserted between IC-3 and IC-4; full IC-7A change-log entry appended; overall-execution summary updated.                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

## No changes to

- `inventory_receive_stock`, `receive_repair_order_stock`, `inventory_
receive_purchase_order`, `inventory_reverse_movement`,
  `putaway_repair_order_stock` — all confirmed (via `pg_get_functiondef`
  and grant re-checks) to be unaffected; each is itself `SECURITY
DEFINER` owned by `postgres`, so their own nested calls into the
  hardened functions are unaffected by any grant change, by standard
  same-owner privilege semantics.
- `inventory_finalize_posting_internal`'s own EXECUTE grant set —
  remains revoked from every ordinary role, IC-2's own frozen contract,
  untouched.
- `inventory_accept_branch_transfer`, `inventory_decline_branch_
transfer` — confirmed via the caller-graph audit to not call any of
  the three hardened functions at all; IC-4's own future scope
  untouched.
- Reservations, allocations, containers, receiving, reversal — no
  architecture reopened, per explicit instruction.
- The posted-header GUC UPDATE bypass, reservation/allocation raw-write
  RLS, container generic raw-write policies, the systemic `anon`
  default-privilege re-grant behavior at the schema level — all remain
  open, explicitly deferred to the full IC-7 phase.
- Any TypeScript application code — IC-7A is entirely PL/pgSQL + pgTAP +
  documentation.

## Diff summary

9 files changed, 1695 insertions(+), 114 deletions(-) against baseline
`f549b25cffd19923e623d76534fa5a79c9f10a30`. Full unified diff in
`diff.patch` (142,281 bytes). `git diff --check` clean.
