# Zone 3 Phase 10A Reservation Integration — Review Context

Baseline: `HEAD` `52fc0913` (Phase 9 + Phase 10 base scope + Phase 10's write-boundary correction, all committed). Diff: `zone3-phase10a-reservation.diff` (2626 lines, 171080 bytes, 17 files). Manifest: `changed-files.md`. No `migration-summary.md` — no migration was created in either version of this phase.

**This is the SECOND version of this document.** The reservation architecture described in §A-§K below is **ACCEPTED** from the first review round. This version adds §L, documenting a narrow, external-review-driven UI/cache correction pass (2026-09-14) that touched only the popover component, the query-hooks module, two new/expanded test files, and translations — the accepted service contract (§C-§G below) was not redesigned and was frozen throughout, per explicit instruction.

Phase 10 base scope and its write-boundary correction are **ACCEPTED and FINAL**. This phase wires the RepairOrder domain to the _existing, live, generic_ inventory reservation engine (`inventory_create_reservation`/`inventory_release_reservation`) so a real RepairOrderLine can reserve stock, per the accepted product rule: **Reservation before Allocation is the normal RepairOrder path.** Nothing in the generic reservation engine was changed, in either review round.

## A. What this phase is, and is not

**Is**: a narrow Zone 3-side wiring pass — `RepairOrdersService.reserveForLine`/`releaseReservationForLine`/`listReservationsForLine`, a minimal line-level UI, and the tests proving all three are correct and safe. The correction pass (§L) narrowed this further to a UI/cache/documentation fix only.

**Is not**: allocation (Phase 10B), container orchestration (10C), container QR (10D), 801 relocation (10E), 201/WZ issue (10F), or Zone 5 receiving/putaway integration. None of these was touched, called, or modified in either round — see §I.

## B. Verify-first: the reservation engine's real contract, checked before writing any code

Per explicit instruction not to trust the implementation plan's own prior text, the engine's real live behavior was inspected first (via `execute_sql`/`pg_proc`/`pg_constraint`/`pg_policies` against `supabase-target`):

- **`inventory_create_reservation` / `inventory_release_reservation` are `SECURITY INVOKER`** (`pg_proc.prosecdef = false`) — a materially different security model from Phase 10's own `SECURITY DEFINER` RPC. This means RLS on `inventory_reservations`, `inventory_reservation_lines`, and `inventory_balances` genuinely governs every call made through these RPCs.
- **Live-verified `pg_policies`, precisely** (re-verified in the correction pass, §L.4, after the first round's own description of this was found to be imprecise): each of `inventory_reservations` and `inventory_reservation_lines` carries **two** permissive policies — an `ALL`-command policy with `USING`/`WITH CHECK` gated on `has_branch_permission(organization_id, branch_id, 'warehouse.inventory.operate')` (covering INSERT/UPDATE/DELETE, and SELECT too, since an `ALL` policy applies to every command), and a **separate, SELECT-only** policy gated on `has_branch_permission(organization_id, branch_id, 'warehouse.inventory.read')`. Because Postgres OR's multiple permissive policies together for the same command, the effective SELECT boundary is `.operate` **OR** `.read` — a caller holding only `.read` can already see reservation status, without needing `.operate`. See §L.4 for the exact policy rows and the documentation fix this produced.
- **`inventory_reservations.reference_id` is a real `uuid` column with no FK to any table** (confirmed via `pg_constraint` — zero foreign-key constraints reference this column). The generic engine therefore cannot itself validate "this reservation genuinely belongs to this RepairOrderLine's own org/branch" — that check does not exist anywhere in the database. This is the one place a genuine, new, domain-specific security property was needed on top of the generic engine, and it is why `releaseReservationForLine` performs an explicit pre-RPC ownership check (§D) rather than relying on the engine alone.
- **Row-locking and the availability formula were already correct and required no change**: `inventory_get_or_create_balance_for_update` uses `SELECT ... FOR UPDATE`; `inventory_balances.available_quantity` is an `ALWAYS GENERATED` column computed as `on_hand_quantity - reserved_quantity - allocated_quantity`.
- **Plan-assumption checklist (A-H from the task's own list) — all confirmed true, none forced**: the engine accepts an array of reservation lines per call; `warehouse.inventory.operate` is the correct, already-existing gating permission for writes (no new slug); the release RPC accepts `p_cancel` distinguishing cancellation from fulfillment-adjacent release; reservation quantity/availability math lives entirely in SQL (row-locked), never duplicated in TypeScript.

## C. Why the RPCs are called directly, not through `InventoryEnterpriseService`

`InventoryEnterpriseService` already has `createReservation`/`releaseReservation` wrapper methods. They were read before deciding not to use them: their shared `errorMessage()` helper (`return error?.message ?? "Unexpected database error"`) discards the Postgres errcode entirely, which the Zone 3 hardened code+message-pattern error-normalization convention (established in Phase 10, reused here as `normalizeReservationRpcError`) requires. `RepairOrdersService.reserveForLine`/`releaseReservationForLine` therefore call `supabase.rpc(...)` directly — matching Phase 10's own established direct-call convention — rather than duplicating the underlying reservation algorithm (they still call the _same_ two RPCs; only the call site differs). **Unchanged by the correction pass.**

## D. Reference security/integrity — the one new domain-specific check

Because `reference_id` has no FK (§B) and the RPCs are `SECURITY INVOKER` (so RLS, not the RPC's own logic, governs the create path), a RepairOrder-specific security property had to be added by the Zone 3 service layer itself. **Unchanged by the correction pass** — the correction touched only the client-side cache key (§L.3), never this server-side check:

- **`reserveForLine`**: scope (organization_id, branch_id, variant_id) is resolved server-side from the RepairOrderLine's own parent RepairOrder (`resolveRepairOrderLineScope`, two bounded, RLS-governed reads) — never trusted from client input. If the line doesn't resolve, or has no `variant_id`, the RPC is never called. `reference_type` is hardcoded to `'repair_order_line'`; `reference_id` is hardcoded to the resolved line's own `id` — a caller cannot pass an arbitrary `reference_id`.
- **`releaseReservationForLine`**: before calling `inventory_release_reservation`, the target reservation row is read directly (`organization_id`, `branch_id`, `reference_type`, `reference_id`) and compared against the caller's own resolved RepairOrderLine scope. Any mismatch returns the same generic `"Reservation not found"` message the genuine not-found case returns, and the release RPC is never called.
- **`listReservationsForLine`**: same scope resolution; returns an empty array (not an error) if the line itself doesn't resolve.

## E. No migration — the index question, resolved with evidence, not assumption

No migration was created in either review round. The reservation read path (`listReservationsForLine`) queries `inventory_reservations` filtered by `organization_id`, `branch_id`, `reference_type`, `reference_id`, at Phase 10A's real current data volume; no query-plan evidence justifying a new index was found. **Unchanged by the correction pass** — this remains a deliberate, evidence-based "not now."

## F. Cardinality — no 1:1 assumed, proven with a real second reservation

The read model (`listReservationsForLine`) sums `outstandingQuantity` across an unbounded number of reservations, each itself possibly holding multiple lines — proven live with a genuine second, independent reservation against the same RepairOrderLine (pgTAP T7-T9, sum=7). **Unchanged by the correction pass** (the correction touched only the client display layer's own state derivation, never this aggregation).

## G. Over-reservation and release — proven live, through the real RepairOrder path

Unchanged by the correction pass — see the first-round pgTAP results in §J. Over-reservation (T10-T11) is rejected atomically with no partial write; release (T12-T14) reduces exactly the released reservation's own outstanding; the sequential over-sell proof (T15-T16) is honestly disclosed as sequential-only (pgTAP's single-connection limitation), not genuine multi-session concurrency.

## H. UI — deliberately minimal, now also state-honest

`repair-order-line-reservation.tsx` adds exactly: a badge, a popover listing active reservations each with a Release button, and a toggleable inline Reserve form. All write affordances are gated on `warehouse.inventory.operate` and are **hidden**, not merely disabled. This remains explicitly **not** a reservation management center, not allocation UI, not container UI. **Correction pass (§L.1-§L.2)**: the badge/popover now distinguish never-fetched, loading, error, success+empty, and success+populated as five genuinely distinct states, instead of collapsing "not yet fetched" and "query failed" into the same "No reservation" copy the original version showed.

## I. Hard boundaries — confirmed not crossed, in either round

- **No allocation work.** `inventory_create_allocation` was not called; no allocation table was read or written; Phase 10B's own section of the implementation plan remains untouched.
- **No container/QR/801/201/WZ work.**
- **No Zone 5 integration.** No new overlap discovered.
- **The Phase 10 write boundary was not reopened.** `097_...` re-run live, byte-for-byte unmodified, still 29/29.
- **The reservation service contract was not touched by the correction pass** — confirmed by the diff itself: `repair-orders.service.ts`, `event-registry.ts`, `validations/repair-orders.ts`, `actions/workshop/repair-orders.ts`, and `098_...` are byte-for-byte identical to the first version of this bundle (the only files in this diff that changed between the two rounds are the popover component, the query-hooks module, the two component/hook test files, the two message files, and `progress.md`).

## J. Testing summary (both rounds combined, current state)

- **Unit (Vitest)**: 27 tests from the first round (17 service + 10 component) + 11 new from the correction pass (5 component + 6 hooks) = 38 new tests total across this phase. Scoped Zone 3 + CRM sibling + Inventory-movement regression (17 files): **238/238 passing** (up from 227 pre-correction).
- **Live pgTAP**: `098_repair_order_line_reservation_phase10a_test.sql`, **17/17 passing**, re-run byte-for-byte unmodified in the correction pass (no DB-layer bug was found, so none was needed).
- **Regression**: `095_...` 11/11, `096_...` 15/15, `097_...` 29/29 (097 re-verified live earlier in this session's Phase 10A pass; unaffected by the correction pass since no RPC/RLS/migration was touched by it).
- **`pnpm type-check`**: clean. **`pnpm lint`**: clean (0 errors; 319 pre-existing, unrelated warnings elsewhere in the monorepo).
- **Browser/Playwright**: not performed, honestly disclosed — no cached browser binaries in this sandboxed environment.

## K. External-review questions (unchanged — the architecture these ask about was not redesigned)

1. Does `reserveForLine`/`releaseReservationForLine` genuinely reuse the existing generic reservation engine without duplicating its allocation/availability algorithm anywhere in TypeScript?
2. Is the RepairOrderLine reference (`reference_type='repair_order_line'`, `reference_id=<line id>`) exact and server-authoritative — never derived from, or overridable by, client input?
3. Can a caller cause a reservation to be created or released against a RepairOrderLine in an organization or branch other than their own?
4. Is `reference_id` forgeable by a client in a way that lets them attach a reservation to, or read/release a reservation belonging to, a RepairOrderLine they don't have access to?
5. Is the permission gating (`warehouse.inventory.operate`) correct and consistent with the existing `createInventoryReservationAction`/`releaseInventoryReservationAction` convention, with no new permission slug invented?
6. Does the implementation genuinely make Reservation-before-Allocation the default/only path exercised by the RepairOrder domain, without silently enabling or depending on direct allocation-without-reservation?
7. Is the `outstandingQuantity = reserved - released - fulfilled` formula applied exactly, matching the generic engine's own live-verified semantics?
8. Is same-SKU independence (two RepairOrderLines sharing a SKU) genuinely proven, not merely assumed from Phase 8's own precedent?
9. Is the read model correct under multiple reservations and/or multiple reservation lines against the same RepairOrderLine — no 1:1 cardinality silently assumed?
10. Is over-reservation rejected atomically (no partial write) when proven through the real RepairOrder path, not just via a mocked rejection?
11. Does `releaseReservationForLine` correctly verify ownership before releasing — could a line action release an unrelated reservation?
12. Are RPC errors normalized safely — no raw Postgres error text reaching the client, no broad errcode-only allowlist that could pass through a same-code/different-message native error?
13. Is the decision not to add a covering index on `inventory_reservation_lines (reference_type, reference_id)` adequately justified by real evidence, not merely asserted?
14. Was the generic reservation/allocation engine (its RPCs, tables, or RLS policies) modified in any way by this phase?
15. Was any allocation-phase (10B) work started, even partially, by this phase?
16. Was Zone 5 (receiving/putaway/spatial attribution) touched, read, or integrated in any way by this phase?
17. Was the Phase 10 write-boundary correction (the deny-all policy on `repair_order_line_movement_links`) reopened, weakened, or bypassed in any way?
18. Are the new reservation actions appropriately permission-sensitive, and does the read action correctly fail closed for a caller lacking `warehouse.inventory.read`?
19. Is the concurrency assurance provided by this phase's own testing honestly scoped — no unperformed multi-session concurrency claimed?
20. Is the UI appropriately minimal, and does every write control correctly disappear (not just disable) for a caller lacking `warehouse.inventory.operate`?
21. Is Phase 10A genuinely complete and ready to hand off to Phase 10B, with no unresolved open question that would block that next phase?

## L. Correction pass (2026-09-14) — three UI/cache bugs, one documentation-accuracy item

### L.1 Bug — "No reservation" shown before the lazy query had ever run

**CONFIRMED.** `useRepairOrderLineReservationsQuery` is intentionally lazy (`enabled: open` — preserved, not changed). Before the popover has ever opened, `query.data === undefined`; the original component mapped that to `data ?? []` and rendered "No reservation" — false for a line that genuinely has one. **Fixed**: a new pure function, `deriveReservationViewState(query, activeCount)`, reads react-query's own `isLoading`/`isError`/`isSuccess` flags (checked in that precedence order: error first, then loading, then success/empty-vs-populated, falling through to never-fetched) to produce one of five states. The trigger badge now shows neutral `badgeUnknown` ("Reservation") wording for never-fetched/loading/error, `badgeNone` ("No reservation") only for a genuinely successful, empty fetch, and `badgeReserved` only for a genuinely successful, non-empty fetch. Lazy loading itself is completely unchanged — still zero eager fetches, still no N+1 across lines.

### L.2 Bug — query error collapsed into the empty state

**CONFIRMED**, same root cause as L.1. **Fixed**: `viewState === "error"` is now a dedicated, popover-local branch with its own testid (`repair-order-line-reservation-error`) and a generic, localized message (`errorState` i18n key: "Couldn't load reservation status. Try again." / Polish equivalent) — never raw database/server error text, and never rendered as "No reservation". The error state does not fail the RepairOrder page — it is scoped entirely to this popover, matching the existing loading/empty states' own scoping.

### L.3 Cache-scope bug — `branchId` was not part of the reservation query key

**CONFIRMED.** The component received `branchId` and its own comment claimed it scoped the cache key, but the actual key (`workshopKeys.lineReservations(lineId)`) and hook signature (`useRepairOrderLineReservationsQuery(lineId, enabled)`) never included it. **Fixed**: `workshopKeys.lineReservations(branchId, lineId)`; `useRepairOrderLineReservationsQuery(lineId, enabled, branchId)`; both mutations now take `(lineId, branchId)` and invalidate against the same branch-scoped key. `branchId` is used **only** as cache identity — never passed to, or used by, any authorization check; `RepairOrdersService`'s own server-side scope resolution (§D) is completely unchanged and remains the real boundary. **Regression proof** (`hooks/queries/workshop/__tests__/index.test.tsx`, new): a real `QueryClient` is primed with branch A's own cached result under branch A's key; the same line is then mounted under branch B's key; the result shows branch B's own freshly-fetched data, never branch A's — and branch A's own cache entry is confirmed untouched afterward. This is a genuine client-cache-identity proof, not a fabricated cross-tenant DB record (none was needed or created).

### L.4 Documentation-accuracy item — the read permission contract, verified live

Live-inspected (not guessed) via `pg_policies` against `supabase-target`:

| table                         | policy                                | cmd    | predicate                                                                                                |
| ----------------------------- | ------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------- |
| `inventory_reservations`      | `inventory_reservations_operate`      | ALL    | `has_branch_permission(organization_id, branch_id, 'warehouse.inventory.operate')`                       |
| `inventory_reservations`      | `inventory_reservations_select`       | SELECT | `(deleted_at IS NULL) AND has_branch_permission(organization_id, branch_id, 'warehouse.inventory.read')` |
| `inventory_reservation_lines` | `inventory_reservation_lines_operate` | ALL    | `has_branch_permission(organization_id, branch_id, 'warehouse.inventory.operate')`                       |
| `inventory_reservation_lines` | `inventory_reservation_lines_select`  | SELECT | `has_branch_permission(organization_id, branch_id, 'warehouse.inventory.read')`                          |

**Finding**: SELECT is governed by TWO permissive policies together (Postgres ORs permissive policies for the same command) — the `ALL`/`.operate` policy (which also covers SELECT, since ALL includes every command) **and** the dedicated `.read`-only SELECT policy. Effective read boundary: `.operate` **OR** `.read` — a caller with only `.read` can already see reservation status; `.operate` is not additionally required for reading. This means `listRepairOrderLineReservationsAction`'s own existing comment ("the real data-visibility boundary is `inventory_reservations`' own RLS (`warehouse.inventory.read`)") was **already accurate** — a read-only Workshop user with `warehouse.inventory.read` can see reservation status today, consistent with the existing (UI-less) Warehouse-module reservation-read semantics elsewhere in the codebase. The imprecise text was in this phase's own §B (first round) and in `03-repair-orders-progress.md`'s pre-correction Phase 10A change-log entry, both of which described the read governance as though the `.operate`-gated ALL policy were the only relevant one, omitting the separate `.read` SELECT policy. **No RLS change was made or needed** — this item required correcting documentation only, per the explicit "do not guess, do not silently widen RLS" instruction. §B above has been rewritten to state this precisely; `progress.md` records the finding in its own new 2026-09-14 correction-pass change-log entry rather than rewriting the prior entry in place.

### L.5 What was explicitly NOT touched by this correction pass

`reserveForLine`, `releaseReservationForLine`'s ownership check, `listReservationsForLine`'s aggregation, `normalizeReservationRpcError`'s allowlist, the two Mode-A events, the `reference_type`/`reference_id` model, the outstanding formula, the generic `inventory_create_reservation`/`inventory_release_reservation` RPCs, and every RLS policy on every reservation table — confirmed both by direct inspection and by the diff itself (§I).
