# Inventory Core — A7 Follow-Up Correction Pass — Context

**Scope**: close the one disclosed, accepted tradeoff the A7 Domain-
Boundary Cleanup pass itself left open — a direct, permissioned caller
of the public generic primitive (`inventory_add_to_container`),
bypassing the RepairOrder-domain wrapper
(`repair_order_add_allocation_to_container`), could still place an
unrelated allocation into a RepairOrder-owned container, because the
post-A7 generic primitive had zero opinion on container ownership.
This pass does not reopen any prior Inventory Core work: IC-0 through
IC-7, the IC-7 closing pass, the architecture compression review,
PRE-IC8 P0, A1–A6, and the A7 base pass are accepted and final. A8 is
explicitly NOT started. IC-8 and Phase 10D are NOT started. No
Inventory Core business semantics beyond the container-ownership gate
described below were touched.

## Starting state

- Branch: `zone3-zone5-integration-audit`.
- HEAD at start: `45074e8a` ("Inventory Core A7 domain-boundary
  cleanup") — verified committed, working tree clean
  (`git status --porcelain` returned 0 lines) before any edit this
  pass.
- A8: confirmed not started.
- IC-8: confirmed not started.
- Phase 10D: confirmed not started.

## The disclosed tradeoff being closed

From the A7 base pass's own `boundary-evidence.md`: post-A7, a
**direct** call to `inventory_add_to_container` (bypassing
`repair_order_add_allocation_to_container` entirely) with a
cross-RepairOrder allocation **succeeds** — the generic primitive was
deliberately reduced to knowing only generic inventory concepts, and
enforcement for RepairOrder-owned containers existed only at the
wrapper, not at the generic primitive itself. This pass closes that
gap without reintroducing the RepairOrder-domain dependency into the
generic primitive.

## Live invariant check performed before choosing the eligibility rule

Before implementing anything, live-verified (per the task's own
explicit "STOP and report if this doesn't hold" instruction) whether
the correct generic-eligibility invariant is `reference_type IS NULL
AND reference_id IS NULL`:

- The DB has **zero validation** on `reference_type`/`reference_id` —
  `inventory_create_container` accepts any caller-supplied text pair
  with no CHECK constraint, enum, or trigger restricting values.
- A repo-wide grep confirmed **exactly one real application caller**
  of the entire container subsystem
  (`inventory_create_container`/`inventory_add_to_container`/
  `inventory_remove_from_container`/`inventory_seal_container`) across
  `apps/web` and `apps/public-web`: `RepairOrdersService`, via the
  wrapper — and it **always** passes `reference_type='repair_order'`.
  The "generic container" pathway this module's own architecture
  treats as first-class is currently 100% unexercised by real,
  production code — only reachable via pgTAP fixtures and hypothetical
  future callers.
- A live full-table scan of `inventory_containers` found no row with
  partial reference state (one of the two columns set, the other
  null) — the only pre-existing rows have both fields either fully
  set (`repair_order`) or both null.

**Invariant confirmed to hold.** No contradiction found — nothing to
STOP and report. The rule adopted, matching the task's own explicit
refinement: a container is reachable through the public generic entry
point **iff `reference_type IS NULL AND reference_id IS NULL`**, i.e.
the reject condition is `reference_type IS NOT NULL OR reference_id
IS NOT NULL` — the conservative, "either field alone is sufficient to
reject" reading, deliberately covering the theoretical partial-state
case even though live data currently shows zero such rows. The check
is domain-agnostic by design: it does **not** special-case
`reference_type = 'repair_order'`, per the task's own explicit
"Important refinement" instruction — ANY domain-owned/referenced
container, not only RepairOrder containers, is rejected by the public
generic API.

## Architecture implemented

```
public inventory_add_to_container
  -> generic eligibility check (reference_type IS NULL AND reference_id IS NULL)
  -> inventory_add_to_container_internal

repair_order_add_allocation_to_container
  -> RepairOrder ownership validation (unchanged from A7 base pass)
  -> inventory_add_to_container_internal

inventory_add_to_container_internal
  -> the single actual placement implementation
  -> INTERNAL ONLY, not executable by authenticated/anon/PUBLIC/service_role
```

Matches the exact `_internal`-suffixed helper convention already
established by `inventory_finalize_posting_internal` and
`write_repair_order_line_movement_link_internal` (both live-confirmed
`proacl = {postgres=X/postgres}` — EXECUTE granted to no role except
the owner). The new internal helper needed **zero non-owner grants**
(unlike A1-A6's own `inventory_ensure_settings_row_internal`, which
required an `authenticated` grant because one of its own callers was
`SECURITY INVOKER`) — both callers of this new internal helper are
`SECURITY DEFINER` owned by `postgres`, so no non-owner-context
invocation ever occurs.

## Error contract

`P0002` "Container not found" — the exact, pre-existing message the
function already raises for a genuinely nonexistent container,
deliberately reused verbatim so "does not exist" and "exists but is
not accessible through this generic entry point" are indistinguishable
from the error alone. **Not** `42501`: the actor may legitimately hold
`warehouse.inventory.operate` at the branch-capability level — this is
a resource-accessibility question, not a permission failure, per the
task's own explicit reasoning.

## Check-ordering re-confirmed

Actor-identity (`28000`) -> branch-permission (`42501`) ->
eligibility (`P0002`) — an unauthorized or spoofed-identity caller
never learns anything about a container's own domain-ownership state.
Verified live via dedicated `ORDER1`/`ORDER2` pgTAP scenarios in the
new file 115 (see `test-evidence.md`).

## What this pass did, in order

1. Verified starting state (above) — clean, committed baseline at
   `45074e8a`.
2. Live-reproduced the pre-fix vulnerability fresh: a direct
   `inventory_add_to_container` call with a cross-RepairOrder
   allocation against a RepairOrder-owned container succeeded before
   any change this pass.
3. Live-verified the generic-eligibility invariant (above) before
   choosing the rule.
4. Repo-wide caller audit confirming the container subsystem's single
   real caller and its always-`repair_order` reference_type.
5. Applied migration 1 — extracted `inventory_add_to_container_internal`
   as a byte-identical copy of the pre-correction
   `inventory_add_to_container` body, then revoked all EXECUTE
   (including from `service_role`).
6. Applied migration 2 — redirected
   `repair_order_add_allocation_to_container`'s own nested call from
   `inventory_add_to_container` to `inventory_add_to_container_internal`.
   Applied before narrowing the public entry point so the wrapper's
   own safe path is never broken mid-deploy.
7. Applied migration 3 — narrowed the public
   `inventory_add_to_container` to add the eligibility gate before
   delegating to the internal helper.
8. Live-verified all 3 functions' final grant states (below).
9. Updated `114_a7_repairorder_container_boundary_test.sql`: flipped
   scenario G2 from asserting the old disclosed-tradeoff success to
   asserting `P0002` rejection; corrected J2's expected total back to
   `10` (G2 no longer contributes to `container_a`'s own contents).
   Live-verified 18/18.
10. Wrote a new pgTAP file,
    `115_a7_correction_generic_container_eligibility_test.sql`
    (plan(14)) — internal-helper lockdown, functional proof of the
    lockdown (not just ACL), domain-agnostic eligibility proof (an
    arbitrary `reference_type='some_other_domain'`, not just
    `repair_order`), partial-state rejection (both directions), a
    genuinely generic container's continued success, check-ordering
    proof, atomicity, and wrapper sanity. Live-verified 14/14.
11. Discovered, mid-pass, in response to the user's own efficiency
    question about the test-run scope, a previously-missed blast-radius
    gap: `100_repair_order_container_orchestration_phase10c_test.sql`'s
    own `container_a`/`container_b` fixtures are BOTH RepairOrder-owned,
    and five scenarios beyond the already-known T19
    (T2, T5, T9, T15, T30) called the generic primitive **directly**
    against them, expecting success or a specific non-ownership
    rejection — all five would have incorrectly received `P0002` from
    the new eligibility gate. Fixed all five to route through
    `repair_order_add_allocation_to_container` instead. See
    `boundary-evidence.md` for the full per-scenario reasoning,
    including why T11/T14/T19/T33/T34/T43 were confirmed unaffected.
12. Ran the full 097–115 pgTAP regression (19 files, all included per
    the user's own explicit instruction after the file-100 gap was
    found) — see `test-evidence.md`.
13. Ran relevant Vitest, `pnpm type-check`, `pnpm lint`, `pnpm build`,
    `git diff --check` — all clean. Zero TypeScript files changed this
    pass (confirmed via `git status`), so Vitest was unaffected but
    re-run anyway per this project's established discipline.
14. Independently confirmed zero residual test data live (not merely
    trusting the regression agent's own report).

## Final live-verified grant matrix

| Function                                   | authenticated | anon  | service_role | overloads |
| ------------------------------------------ | ------------- | ----- | ------------ | --------- |
| `inventory_add_to_container`               | true          | false | true         | 1         |
| `inventory_add_to_container_internal`      | false         | false | false        | 1         |
| `repair_order_add_allocation_to_container` | true          | false | true         | 1         |

## Bundle contents

- `review-context.md` (this file)
- `changed-files.md` — full file-by-file change list
- `migration-summary.md` — all 3 migrations' full detail
- `test-evidence.md` — full 097-115 regression + Vitest + static-gate
  results
- `boundary-evidence.md` — the eligibility-invariant evidence, the
  file-100 blast-radius discovery and fix (per-scenario reasoning),
  and the check-ordering/non-leaking proof
- `diff.patch` — the complete diff against baseline (HEAD `45074e8a`)
