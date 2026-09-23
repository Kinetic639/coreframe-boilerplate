# IC-3 — Test Evidence

All results below are from this session's own live runs against
`supabase-target`, via Supabase MCP `execute_sql` (pgTAP) or a real `psql`
binary against independent OS-level connections (concurrency, see
`concurrency-evidence.md`). Nothing here is inferred or fabricated.

## pgTAP regression (220/220, 0 failures)

| File                                                        | Result    | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 097 (movement-line attach, Phase 10)                        | 29/29     | Unaffected by IC-3. Run via `psql`.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 098 (reservation, Phase 10A)                                | 17/17     | Unaffected — dedicated RPC untouched. Re-verified via Supabase MCP after the known, disclosed connection-pooler GUC artifact hit the `psql` attempt (not a regression — retried clean via the MCP path, which is unaffected by that artifact).                                                                                                                                                                                                        |
| 099 (allocation, Phase 10B)                                 | 20/20     | Unaffected — dedicated RPC untouched. Run via `psql`.                                                                                                                                                                                                                                                                                                                                                                                                 |
| 100 (container orchestration, Phase 10C)                    | 44/44     | Unaffected — containers never touch the receiving path. Re-verified via Supabase MCP for the same known connection-pooler reason as 098.                                                                                                                                                                                                                                                                                                              |
| 101 (IC-1 movement-engine blind spot)                       | 17/17     | Unaffected by IC-3. Run via `psql`.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 102 (IC-1 reserved-only + final contract)                   | 14/14     | Unaffected by IC-3. Run via `psql`.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 103 (IC-2 movement reversal + security-boundary Scenario E) | 35/35     | Unaffected by IC-3's own RPC changes. Initially FAILED on a `branches_org_branch_number_unique` collision caused by this session's own genuine concurrency-test fixture (branch_number 970, committed, colliding with 103's own transaction-scoped scenario A) — diagnosed, fixed by renumbering the committed fixture (940), re-run clean. See `migration-summary.md` and the change log for the full account; 103's own file/logic was NOT touched. |
| **104 (IC-3 receiving consolidation, new)**                 | **44/44** | See below. Confirmed identically via both `psql` and Supabase MCP `execute_sql`.                                                                                                                                                                                                                                                                                                                                                                      |

**Total: 220/220, 0 failures.**

### 104 — full assertion list (all passing)

**Scenario F — the canonical `inventory_receive_stock` primitive, directly (13 assertions):**

- F1-F4: a two-line, same-variant receive posts successfully; aggregate balance is the exact sum (2+3=5); the returned `lines` array has exactly 2 entries; the two lines map to two DISTINCT `movement_line_id`s (never merged).
- F5-F6: a sequential retry with the SAME idempotency key returns the SAME `movement_id`; balance stays exactly 5 — no double-post.
- F7: missing `destination_location_id` rejected (`22023`).
- F8: `quantity <= 0` rejected (`22023`).
- F9: `p_actor_user_id` not matching `auth.uid()` rejected (`28000`).
- F10-F11: side-by-side equivalence — a receipt posted via the primitive and an equal-quantity receipt posted via `inventory_create_and_finalize` directly produce equal `on_hand` balances and equal ledger-entry counts (1 each, destination-increase-only per 101 semantics) — semantic equivalence, not byte-identical ids/timestamps.
- F12-F13: atomicity — a 2-line call where line 2 is missing its destination rejects the WHOLE call (`22023`); no orphan movement header is created (header count unchanged).

**Scenario G — `receive_repair_order_stock` wrapper (14 assertions):**

- G1-G8: happy path — 3 lines (two attributed to DIFFERENT RepairOrderLines sharing the SAME SKU/variant, one deliberately unattributed) post as one movement; receiving-location stock increases by the exact sum (6+4+5=15); each attributed line's own `applied_quantity` is exact and independent (never merged by SKU); the two attributed lines map to distinct movement lines (no cross-line contamination); `repair_order_line_locations` seeded correctly for both; exactly 2 attribution links exist (the 3rd, unattributed line created no fabricated attribution).
- G9: nonexistent `source_line_id` rejected (`P0002`).
- G10: ambiguous `source_line_id` (resolves to 2 RepairOrderLine candidates via 2 distinct source documents) rejected (`55000`).
- G11: a source line resolving to a RepairOrder in a DIFFERENT branch than the call's own target rejected (`42501`).
- G12: resolved RepairOrderLine variant not matching the received variant rejected (`22023`).
- G13-G14: atomicity — a 2-line call with one bad-provenance line rejects the WHOLE call (`P0002`); no orphan movement header created.

**Scenario H — `inventory_receive_purchase_order` wrapper (13 assertions):**

- H1-H4: a partial receive (6 of 10) transitions PO status to `partially_received`, `received_quantity=6`, physical stock +6; completing the remaining 4 transitions status to `received`.
- H5: nonexistent PO rejected (`P0002`).
- H6: a `purchase_order_line_id` belonging to a DIFFERENT PO rejected (`P0002`).
- H7: receiving above the remaining open quantity rejected (`22023`).
- H8: a PO already fully received rejected from receiving again (`55000`).
- H9: no `delivery_location_id` and no per-line override rejected (`22023`).
- H10a-H10b: a per-line `destination_location_id` override is honored and stock lands there, not at the PO's own default delivery location.
- H11-H12: retrying the FIRST partial receipt with the same idempotency token returns the SAME `movement_id`; `received_quantity` stays exactly 10 (6+4), NOT double-incremented to 16 — proves the self-caught defect (migration 4) is genuinely fixed.
- H13: zero `repair_order_line_movement_links` rows reference any movement line created by the PO wrapper.

**Scenario J — permission negatives, run LAST (3 assertions):**

- J1: `inventory_receive_stock` rejects an actor lacking `warehouse.inventory.operate`/`.adjust` (`42501`).
- J2: `receive_repair_order_stock` rejects the same (`42501`).
- J3: `inventory_receive_purchase_order` rejects an actor lacking `warehouse.procurement.manage` (`42501`).

**Ordering note**: Scenario J deliberately runs last — `user_effective_
permissions` has no wildcard row, and deleting a specific permission slug
for a user/org is a permanent, org-wide mutation for the rest of the
shared transaction, matching the established convention from `099_...`/
`103_...`.

## Semantic-equivalence proof (§17 of the brief)

F10-F11 above IS the required side-by-side comparison: same inputs (7
units, same variant, same org/branch), one posted through the new
primitive, one posted through the pre-existing `inventory_create_and_
finalize` path directly. Compared: `on_hand_quantity` (equal), ledger
entry count (equal, 1 each). Not compared (correctly, per instruction):
UUIDs, timestamps, document numbers — those are expected to differ
between two separately-executed movements.

## Vitest (228/228, 0 failures)

Targeted Inventory/Zone3/CRM/PO subset (no TypeScript changed, so the
full ~378-file baseline was not re-run in full):
`repair-orders.service.test.ts` (159), `inventory-actions.test.ts`,
`wdd-matcher-approval-actions.test.ts`, `crm-contacts.service.test.ts`,
`crm-module-migration.test.ts`, `crm-parties.service.test.ts`,
`wdd-matcher-movement-import-candidates.test.ts`, `wdd-matcher.service.
test.ts`, `inventory-cross-branch-transfers.test.ts`, `inventory-backend-
hardening-migration.test.ts`, `inventory-phase2-migrations.test.ts` (the
last of which specifically string-matches the PO migration's own SQL
text this phase built on — still passes, since the table/permission-slug
names it asserts on were kept unchanged) — 228/228, 0 failures.

## `pnpm type-check`

0 errors. IC-3 required zero TypeScript changes (pure PL/pgSQL).

## `pnpm lint`

0 errors. 319 pre-existing warnings, all in unrelated `apps/web/temp/`
scaffold prototypes — none touch any file this phase changed.

## `git diff --check`

Clean — zero trailing-whitespace issues across all 8 files this phase
changed or added (4 new migrations, 1 new pgTAP file, 3 modified docs).

## Production build

Not run — no application TypeScript/runtime surface changed (pure
PL/pgSQL + pgTAP + documentation), so a build provides no additional
signal beyond `type-check`/`lint`. Disclosed explicitly rather than
silently skipped.
