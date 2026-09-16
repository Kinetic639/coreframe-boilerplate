# IC-7A Review Context — Emergency Movement Engine Security Boundary Closure

**Scope**: IC-7A only — an emergency, P0, narrow security pass pulled
forward out of roadmap order. NOT the full IC-7 phase (which remains
later in the roadmap, fully open). IC-4 is NOT started. Phase 10D is NOT
started. IC-0/IC-1/IC-2/IC-3's own architecture is not reopened —
receiving, reversal, reservations, allocations, containers, branch
transfer, RepairOrder attribution, and Zone 5 were not touched.

**Baseline**: `f549b25cffd19923e623d76534fa5a79c9f10a30` (commit `ic3`),
branch `zone3-zone5-integration-audit` — confirmed clean working tree at
this exact commit before any IC-7A work began.

**Why this pass exists, in one paragraph**: IC-3's own live verification
proved that `inventory_create_draft`, the public `inventory_finalize_
posting`, and `inventory_create_and_finalize` — the shared engine layer
every canonical receiving/reversal/adjustment RPC ultimately delegates
to — carried live `anon` EXECUTE and performed zero actor-identity or
permission check of their own. A safe, rolled-back probe proved a fully
unauthenticated caller could post an arbitrary physical movement. This
predates IC-1 and was not introduced by IC-3; IC-3 discovered and
disclosed it while hardening its own new code. Given the severity (zero
authentication required — strictly worse than any prior finding this
project has made), this one item was pulled forward and closed
immediately rather than left open through IC-4.

## Please verify these things

1. **Was the exploit genuinely reproduced live, not assumed?** See
   `security-evidence.md`'s own "Pre-fix reproduction" section — confirm
   the exploit payload, the exact `anon` role context (zero JWT claims),
   and the returned `document_number`/`on_hand_quantity` are real,
   live-queried values, not narrative claims.
2. **Was the caller graph genuinely audited before any grant was
   touched?** Confirm the 5 named Next.js server actions actually exist
   at the cited paths and actually call the three target RPCs directly
   (spot-check `inventory-movements.service.ts` and at least one server
   action). Confirm `inventory_approve_count_session` is genuinely NOT
   `SECURITY DEFINER` (read its own `pg_get_functiondef` output) — this
   is the specific fact that ruled out full internalization.
3. **Is the fix (harden in place, not internalize) the right call given
   that caller graph?** Would revoking `authenticated` EXECUTE on any of
   the three functions have broken a real flow? Trace through at least
   one (e.g. `quickReceiptAction` → `InventoryMovementsService.
createDraft` → `inventory_create_draft`) to confirm it calls the RPC
   directly, not through a wrapper this pass could have targeted
   instead.
4. **Does the fix actually close the exploit?** See `security-evidence.
md`'s own "Post-fix exploit replay" — confirm the exact original
   payload now returns `42501` and leaves zero rows.
5. **Is `inventory_finalize_posting_internal` still correctly
   unreachable?** Confirm its own grant matrix is unchanged (`anon`/
   `authenticated`/`service_role` all `false`) and that `inventory_
reverse_movement`'s own reversal end-to-end flow (M7 in `105_...`)
   still works — proving the reversal path's own nested call into the
   now-additionally-checked internal function is unaffected.
6. **Was the self-caught system-type-guard defect genuinely caught
   before it shipped to a test?** See `migration-summary.md` item 4 —
   confirm the live query showing `is_system=true` for every seeded type
   is accurate (re-run it yourself if useful:
   `SELECT code, is_system, allows_manual_entry FROM inventory_movement_
types WHERE organization_id = '9f98fe91-63b8-4986-a2b3-65bdd47684c9'`)
   and that the corrected guard (`allows_manual_entry` alone) is what's
   actually live now.
7. **Is the 103 Scenario E reordering genuinely just a reposition, not a
   weakening?** Diff Scenario E's own text at its old position (in
   `diff.patch`, the removed block) against its new position (the added
   block) — confirm they are byte-for-byte identical except for
   location, and confirm the NEW position (immediately after Scenario D,
   before Scenario C) genuinely avoids Scenario C's own permission-strip.
8. **Are all 20 items from the assigning brief's own test matrix
   (anon negatives A-H, authenticated-no-permission, authorized-
   legitimate for every real entry point, nested SECURITY DEFINER,
   actor-impersonation, NULL-actor, exploit replay) genuinely covered?**
   Cross-check `test-evidence.md`'s own Scenario K/L/M/O/P/Q/R against
   the file structure in `105_ic7a_movement_engine_security_boundary_
test.sql`.
9. **Was the default-privilege root cause investigated honestly, and is
   the decision not to change it justified, not merely convenient?**
   See `security-evidence.md`'s own "Default-privilege root cause"
   section — confirm the `pg_default_acl` query result is accurate, and
   that the stated reason for NOT changing it (unaudited public-facing
   RPC surfaces elsewhere in this schema) is a genuine constraint, not
   an excuse to skip harder work.
10. **Is the remaining IC-7 scope honestly represented as still open?**
    Confirm `inventory-core-implementation-plan.md`'s own IC-7 section
    was NOT marked done, and that its own note correctly lists what
    remains: the posted-header GUC UPDATE bypass, reservation/allocation
    raw-write RLS, container generic raw-write policies, the systemic
    `anon` default-privilege behavior, and `inventory_branch_transfers`/
    `_lines` (pending IC-4).

## Known, disclosed limitations (not defects)

- The full IC-7 phase remains open — this pass closed exactly one item
  from its own list, by design.
- `inventory_approve_count_session` itself still carries `anon` EXECUTE
  (pre-existing, not one of the 3 named engine functions, out of narrow
  scope) — functionally safe today via two independent downstream layers
  (its own `has_branch_permission` check, and the newly-hardened engine
  beneath it), but its own grant was not tightened this pass.
- The posted-header GUC UPDATE bypass (IC-2's own finding) remains open
  — unrelated mechanism, not needed to close this pass's own P0.
