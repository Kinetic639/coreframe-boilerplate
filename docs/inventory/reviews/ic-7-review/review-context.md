# IC-7 Review Context

**Phase**: IC-7 — Inventory Security / Write-Boundary Closure +
Module-Boundary / Public-Entry-Point Audit. IC-0 through IC-6A and
IC-7A remain ACCEPTED/FINAL, not reopened. IC-8 and Phase 10D are
explicitly NOT started.

## 0. Starting-state disclosure

HEAD at phase start: `fb22529567cf029ea2dc6e6109f1f3d34216d477`
("ic6a" — this is the SAME combined IC-6+IC-6A commit flagged during
the IC-6A phase as having appeared via an out-of-band mechanism this
session did not directly invoke — see IC-6A's own final report for the
full disclosure. No new commit was created since; this session's own
standing "never commit without explicit instruction" policy was
respected throughout IC-7 — nothing in this phase's own 11 changed
files has been staged or committed). Working tree confirmed clean of
anything except this phase's own new files before IC-7 work began.
IC-8 and Phase 10D confirmed NOT started (grepped `inventory-core-
progress.md` for every "NOT started" marker — all consistent).

## 1. Can any ordinary user directly mutate physical stock tables?

**No, closed this phase.** `inventory_balances` raw writes were
confirmed exploitable pre-fix via a systemic NULL-comparison bug in
`inventory_guard_balance_write` (any session that never touched the
GUC at all could raw-UPDATE `on_hand_quantity`) — fixed with `COALESCE`
against the NULL case. Live-reproduced closed: a fresh, zero-GUC-
contact transaction's raw UPDATE now fails `P0001`.

## 2. Can anon execute any physical-write path?

**No.** `inventory_cancel_movement` and `inventory_save_draft` both
carried live `anon` EXECUTE with zero internal checks — both fully
unauthenticated, cross-tenant exploitable pre-fix (live-confirmed by a
background investigation agent's own probe). Both closed: `anon`/
`PUBLIC` explicitly revoked, actor-identity + permission checks added.
Every other physical-write RPC already had `anon` correctly revoked
(IC-2/IC-3/IC-4/IC-7A's own prior work, re-confirmed unchanged this
phase).

## 3. Can a caller spoof p_actor_user_id?

**No**, for every physical-write RPC. `inventory_create_reservation`/
`inventory_release_reservation`/`inventory_create_allocation`/
`inventory_release_allocation` had NO actor-identity check at all
pre-fix (accepted `p_actor_user_id`, used only for audit stamping,
never validated) — all 4 fixed this phase. `inventory_cancel_movement`/
`inventory_save_draft`/`inventory_approve_count_session` same fix.
Live-verified: a spoofed actor UUID on any of these → `28000`.

## 4. Can NULL actor bypass identity?

**No.** Every fixed function explicitly checks `p_actor_user_id IS NULL
OR p_actor_user_id IS DISTINCT FROM auth.uid()` — NULL is rejected by
the `IS NULL` branch, not silently accepted. Live-verified on
`inventory_cancel_movement` (pgTAP `110_...` Scenario P).

## 5. Can an authenticated user rewrite posted movement history?

**No, closed this phase — this was the single most architecturally
significant fix.** The posted-header/line immutability triggers
previously relied ENTIRELY on a caller-settable session GUC, which is
not a security boundary. Redesigned to validate the SUBSTANCE of any
change: only the exact reversal-lifecycle delta is ever permitted, and
even that requires a genuine, correctly-linked, correctly-typed
reversal row to exist (which cannot be forged, since `900`-type
movements cannot be manually created). Live-verified: raw UPDATE of
`document_number`/`movement_type_code` on a posted header → `42501`,
with or without the GUC deliberately set. A FORGED "already reversed"
state (fake `reversal_movement_id`) is also rejected.

## 6. Is the old GUC bypass actually closed?

**Yes**, and more thoroughly than the original finding described. The
known bypass (deliberately setting the GUC) is closed. A MORE severe,
previously-undiscovered variant (the guard failing open even WITHOUT
touching the GUC, due to a NULL-comparison bug) was found and closed
in the SAME phase, on the `inventory_balances`/`inventory_settings`
guard triggers.

## 7. Can reversal still perform its legitimate lifecycle transition?

**Yes, unchanged.** `inventory_reverse_movement`'s own body was read in
full and confirmed untouched. Live-verified end to end: a real
`inventory_reverse_movement` call still correctly transitions the
original header to `status='reversed'` with real `reversal_movement_
id`/`reversed_by`/`reversed_at` values (pgTAP `110_...` Scenario C).

## 8. Can posted movement lines be mutated?

**No.** Confirmed via TWO independent layers: RLS's own pre-existing
`status='draft'`-scoped UPDATE policy (silently filters to 0 rows for
posted lines — already correct, unrelated to this phase's own fix), AND
the redesigned `inventory_prevent_line_modification` trigger (now
unconditionally denies once posted, closing the same class of gap for
any `SECURITY DEFINER` internal caller that bypasses RLS entirely,
which RLS alone cannot protect against). Live-verified: raw line
UPDATE after posting → 0 rows affected; quantity genuinely unchanged.

## 9. Can raw reservation writes bypass the reservation RPC?

**No, closed this phase.** Confirmed a real, empirically-exploitable
gap pre-fix (single `PERMISSIVE ALL` policy, no `RESTRICTIVE` deny —
disclosed since IC-0, 2026-09-15). Closed with the same proven
`RESTRICTIVE USING(false)/WITH CHECK(false)` pattern IC-4/IC-5 already
used successfully. Live-verified: raw INSERT/UPDATE/DELETE on
`inventory_reservations`/`_lines` all denied; legitimate `inventory_
create_reservation`/`inventory_release_reservation` calls unaffected.

## 10. Can raw allocation writes bypass allocation RPC?

**No, closed this phase.** Identical finding and fix to item 9, applied
to `inventory_allocations`/`inventory_allocation_lines`.

## 11. Are container raw writes correctly closed?

**Yes, closed this phase for generic (non-RepairOrder) rows.**
RepairOrder-owned container rows were already closed (Phase 10C's own
correction, unchanged). Generic rows were openly `PERMISSIVE ALL`
until this phase — closed only after confirming (fresh, live repo-wide
grep) that IC-6 had already deleted the sole legacy direct-writer
(`ambra-location-inventory.ts`'s own 4 write actions), making this
closure safe with zero legitimate-caller impact.

## 12. Are branch-transfer raw writes still closed?

**Yes, unchanged — re-verified, not re-fixed.** IC-4's own `RESTRICTIVE`
policies on `inventory_branch_transfers`/`_lines`/`_discrepancies` were
live-queried this phase and confirmed still in place, correctly denying
raw writes. Matches architecture doc §9's own "Keep" target — this
phase did not touch these tables at all.

## 13. Are RepairOrder attribution/projection writes still closed?

**Yes, unchanged — re-verified, not re-fixed.** `repair_order_line_
movement_links` (closed since an IC-2-era migration) and `repair_order_
line_locations`/`repair_order_location_attribution_uncertain` (closed
by IC-5) were live-queried this phase and confirmed still `RESTRICTIVE`-
denied. Not touched by any of this phase's own 9 migrations.

## 14. Are internal helpers genuinely internal?

**Yes.** `inventory_finalize_posting_internal`, `write_repair_order_
line_movement_link_internal`, `rebuild_repair_order_projection_bucket_
internal` all re-confirmed `anon`/`authenticated`/`service_role`/
`PUBLIC` EXECUTE all `false` (pgTAP `110_...` Scenario N). `inventory_
get_or_create_balance_for_update` — previously carried live `anon`/
`PUBLIC` EXECUTE despite being the shared internal balance-getter —
tightened this phase (`anon`/`PUBLIC` revoked; kept `authenticated`/
`service_role` since it is not itself `SECURITY DEFINER` and full
internalization was not verified safe in this narrow pass).

## 15. Are all SECURITY DEFINER functions hardened?

**Every physical-stock-mutation `SECURITY DEFINER` function**, yes —
confirmed via the full grant-matrix sweep (`function-grant-matrix.md`):
`search_path` set, owner `postgres`, actor+permission checks present,
explicit grants. A DISCLOSED, NOT-hardened-this-phase set remains:
several product-catalog/procurement/audit-domain functions (`inventory_
create_enhanced_product` etc.) carry default `anon` EXECUTE without an
explicit revoke — out of this phase's own narrow physical-stock-write
scope, recorded in `security-evidence.md`'s own "Remaining open
findings."

## 16. Can default privileges silently reopen anon EXECUTE?

**Yes, structurally, for the WHOLE schema — this was investigated in
full this phase and a deliberate decision made (Option B).** `pg_
default_acl` confirms `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN
SCHEMA public GRANT EXECUTE ... TO anon` is schema-wide. A live audit
this phase (going further than IC-7A's own deferred investigation)
found dozens of genuinely, deliberately public-facing functions across
UNRELATED modules (invitations, signup, org creation) that legitimately
rely on this same default — changing it schema-wide was confirmed
UNSAFE within this phase's own Inventory-only scope. Every Inventory
Core function this phase touched was given an explicit per-function
`REVOKE`; the new `110_...` pgTAP file's own grant-privilege assertions
serve as the "stronger automated test" the task's own §36 requires,
rather than relying on human migration discipline alone.

## 17. Does inventory_cancel_movement verify real actor identity?

**Yes, now.** See item 3 — was completely absent pre-fix (the single
most severe finding of this entire phase, since it was ALSO combined
with live `anon` EXECUTE, requiring zero authentication at all to
exploit). Fully closed.

## 18. Are cross-org/branch boundaries preserved?

**Yes**, and strengthened. Every actor+permission-checked function this
phase touched re-validates `organization_id`/`branch_id` against the
actor's own resolved scope inside the function body (the established
convention). `inventory_release_reservation`/`inventory_release_
allocation` additionally had their own pre-existing cross-org
EXISTENCE-LEAK closed (different error messages for "not found" vs.
"found but no permission" — unified to the single non-leaking `P0002`
pattern `inventory_reverse_movement` already established).

## 19. Is the public write-path list finite and intentional?

**Yes** — see `function-grant-matrix.md`'s own "Public Business API"
table (28 functions, every one's own `SECURITY DEFINER`/grant/actor-
check state explicitly documented) and "Internal only" table (6
functions). No stale overloads found. No function was left in an
ambiguous or undocumented grant state within the physical-stock-write
surface this phase's own §2 scope covers.

## 20. Does every user-visible operation have a clearly identified owner/service?

**Yes** — see `application-entry-point-matrix.md`'s own per-operation
table. Zero action-layer RPC bypass anywhere in the Inventory domain
(confirmed via a repo-wide grep finding zero `.rpc("inventory_...")`
calls outside `src/server/services/`).

## 21. Does generic Inventory Core depend on RepairOrder logic?

**One narrow, disclosed, non-security-relevant exception.**
`inventory_add_to_container`'s own inline RepairOrder-ownership check
(a real, direct `JOIN repair_order_lines`) — see `module-boundary-
audit.md`. Not a security bypass, not touched this phase, recorded for
the architecture-compression pass. Every other generic Inventory Core
function/trigger is confirmed domain-agnostic.

## 22. Does generic Inventory Core depend on PO logic?

**No.** `inventory_create_purchase_order`/`inventory_receive_purchase_
order` are legitimately PO-domain functions that happen to share the
`inventory_`-prefixed naming convention — they do not represent the
GENERIC engine depending on PO logic (the generic engine, `inventory_
receive_stock`, remains fully domain-agnostic; the PO-specific business
rules live entirely in the PO wrapper, per IC-3's own accepted design).

## 23. Are domain orchestrators correctly classified ABOVE core?

**Yes.** `RepairOrdersService` (business-domain service) calls generic
Inventory Core RPCs — the ALLOWED direction. No generic Inventory Core
service imports or references `RepairOrdersService`, any RepairOrder
type, or any RepairOrder table (confirmed by grep). See `module-
boundary-audit.md`'s own full TypeScript-layer analysis.

## 24. Are there duplicate application entry points for the same physical write?

**No.** The apparent overlap between `InventoryEnterpriseService`'s
generic reservation/allocation methods and `RepairOrdersService`'s own
line-specific methods is NOT duplication — see `application-entry-
point-matrix.md`'s own dedicated analysis (two distinct business
operations correctly sharing one canonical RPC).

## 25. Which ones should be consolidated after IC-7?

**None require consolidation** (see item 24). See `compression-
candidates.md` for the 6 genuine candidates found — none are
"duplicate entry points," they are (1) a narrow core/domain coupling,
(2) an accepted domain-trigger-on-core-table design, (3) 3 fully-built
canonical RPCs awaiting their own UI, (4)-(5) already-disclosed dead
TypeScript code from IC-6, (6) a disclosed set of still-default-
privileged product/procurement functions.

## 26. Did IC-7 avoid changing business semantics?

**Yes.** Every fix is additive (`RESTRICTIVE` policies, actor/
permission checks, grant revocations) or a pure security-boundary
redesign (the header/line triggers) that preserves the EXACT prior
legitimate behavior while closing illegitimate paths. Full regression
(see `test-evidence.md`) confirms zero business-logic regression across
IC-1 through IC-6A's own accepted semantics.

## 27. Did IC-7A remain intact?

**Yes, re-verified live.** `105_ic7a_movement_engine_security_boundary_
test.sql` re-run as part of the full regression (see `test-evidence.md`)
— confirms `inventory_create_draft`/`inventory_finalize_posting`/
`inventory_create_and_finalize` remain correctly hardened, unaffected
by this phase's own changes.

## 28. Did IC-6A remain intact?

**Yes.** Opening stock (`inventory_create_and_finalize`, movement type
`401`) was not modified this phase; `InventoryProductsService.
createOpeningStockMovement` was not touched. Confirmed via the full
regression run including `109_ic6a_opening_stock_repair_test.sql`.

## 29. Is reproducibility still explicitly blocked on IC-8?

**Yes, unchanged and re-confirmed not touched.** The Zone-5 local-
migration-mirroring gap (7 live migrations never locally mirrored,
confirmed by IC-6/IC-6A to block from-scratch replay) remains the
IC-8 hard gate established in `inventory-core-implementation-plan.md`'s
own IC-8 section. IC-7's own 9 migrations were all correctly mirrored
locally under their exact live timestamps, so IC-7 itself does not add
to this gap — but does not close it either, per explicit instruction
(§39: "Do NOT solve the 7 missing historical Zone-5 migration files in
IC-7").

## 30. Is IC-7 safe to freeze before architecture compression / IC-8?

**Yes.** Every finding this phase discovered was either fixed (9
migrations, all live-verified) or explicitly disclosed with a
documented reason for deferral (product/procurement-domain functions,
the container/RepairOrder coupling, the reproducibility gap). No
security finding was silently dropped. The write-boundary matrix is
now 100% "Keep"/"Closed" across every row architecture doc §9 lists.

## CLOSING PASS ADDENDUM (2026-09-19)

A narrow follow-up pass closed the 7 disclosed-but-deferred product/
procurement/audit-domain functions from answer 30 above, plus 1
newly-found item (`inventory_convert_quantity`, zero permission check
— see `security-evidence.md` items 11-15). This did NOT reopen any of
IC-7's own core 10 findings, did NOT touch any of the original 9
migrations, and did NOT start architecture compression, IC-8, or Phase
10D. A genuine, previously-undisclosed actor-identity-spoofing
vulnerability was found and closed on 4 functions during this pass
(reproduced live with a real second user id, not a synthetic one — see
`test-evidence.md`'s own account of the false-negative this caused on
the first probe attempt). One pre-existing, out-of-scope business-logic
defect was found and disclosed but not fixed (`inventory_create_
valuation_snapshot`'s own reference to a non-existent relation,
`inventory_balance_analytics`) — not a security issue, not a
regression, not touched by this pass's own grant-only change to that
function. All answers 1-30 above remain accurate for IC-7's own core
scope; this addendum documents the additional closing-pass work
without altering the historical record above.
