# IC-8 — Section 20: Audit-Trail Matrix

Live-verified this pass: which mechanism records each class of action.
Three distinct layers exist in this architecture, not one:

1. **`inventory_stock_ledger_entries`** — the physical-effect ledger
   (Concept A). Append-only, immutable, written exclusively inside
   `inventory_finalize_posting_internal`/`inventory_reverse_movement`.
   Records WHAT physically changed (balance field, direction, quantity,
   before/after) but not WHY or WHO in business terms.
2. **`inventory_movement_audit_log`** (DB-level) — written by exactly 5
   functions (confirmed live this pass via `pg_get_functiondef` scan):
   `inventory_create_draft`, `inventory_save_draft`, `inventory_cancel_
movement`, `inventory_finalize_posting_internal`, `inventory_reverse_
movement`. Covers the movement lifecycle only.
3. **App-level audit events** (`event-registry.ts`, surfaced in the
   product's own Audit/Activity UI) — a curated subset of actions,
   registered per action key.

| Action                                                                      | Ledger entry                                                                                                                                                                                                       | DB movement-audit-log                       | App-level audit event                                                                   | Coverage                                                                                       |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Draft create/save                                                           | No (drafts don't touch balances)                                                                                                                                                                                   | Yes                                         | No                                                                                      | DB-only                                                                                        |
| Movement finalize/post                                                      | Yes                                                                                                                                                                                                                | Yes                                         | Yes (`warehouse.inventory.movement.posted`)                                             | Full                                                                                           |
| Movement cancel (draft)                                                     | No                                                                                                                                                                                                                 | Yes                                         | No                                                                                      | DB-only                                                                                        |
| Movement reversal                                                           | Yes                                                                                                                                                                                                                | Yes                                         | Yes (`warehouse.inventory.movement.reversed`)                                           | Full — but see `deferred-debt.md` item 3: no UI caller exists to ever trigger this in practice |
| Branch transfer create/send/accept/cancel/decline                           | Yes (via the underlying finalize call each state transition makes)                                                                                                                                                 | Yes (via the same underlying finalize call) | Yes — all 5 states registered (`.created`/`.sent`/`.accepted`/`.cancelled`/`.declined`) | Full                                                                                           |
| Reservation create/release                                                  | Yes, indirectly (`reserved_quantity` change is NOT a ledger entry — the ledger only records `on_hand`-affecting physical effects; reservations only ever move `reserved_quantity`, which has no ledger row at all) | No                                          | No                                                                                      | **Gap — see below**                                                                            |
| Allocation create/release                                                   | Same as reservation — `allocated_quantity` changes are not ledger events                                                                                                                                           | No                                          | No                                                                                      | **Gap — see below**                                                                            |
| Container create/add/remove/seal/relocate                                   | No (container placement doesn't itself move `on_hand`; relocate does, via a real movement, which IS ledgered)                                                                                                      | No                                          | No                                                                                      | **Gap — see below**                                                                            |
| RepairOrder line movement attribution (`attach_repair_order_line_movement`) | N/A (links an already-ledgered movement line, doesn't create a new one)                                                                                                                                            | No                                          | No                                                                                      | **Gap — see below**                                                                            |

## Gap, disclosed (not a HARD blocker, but a real finding)

**Reservation, allocation, and container state changes have zero
dedicated audit trail beyond the bare row itself** (each carries
`created_by`/`created_at`/`cancelled_by` columns — an implicit, queryable
record of who/when, but not a structured, append-only audit log entry
the way movements get). This is architecturally consistent (the ledger
is deliberately scoped to physical `on_hand` effects only, not
commitment-state changes — `reserved`/`allocated` are commitments against
physical stock, not physical movements themselves), but it means:

- There is no way to answer "who released this reservation and why" from
  an audit log — only "when was this row's `cancelled_by`/`cancelled_at`
  set," which is not the same guarantee the ledger provides for physical
  movements (an explicit, structured, immutable record with a documented
  reason).
- `attach_repair_order_line_movement` (the RepairOrder attribution write)
  is similarly unaudited beyond the `repair_order_line_movement_links`
  row itself.

**Disposition**: not a Section 37 HARD blocker (no correctness/security
defect — the underlying data is still correct and queryable, just not
structured as a formal audit trail the way movements are). Recommended
as a scoped follow-up (extend `inventory_movement_audit_log`'s pattern,
or the app-level event registry, to cover reservation/allocation/
container lifecycle events) — added to `deferred-debt.md`.

## What IS fully covered

The physical movement lifecycle (draft → post → reverse) and the full
branch-transfer lifecycle both have complete, three-layer audit coverage
(ledger + DB audit log + app-level event), live-verified this pass.
