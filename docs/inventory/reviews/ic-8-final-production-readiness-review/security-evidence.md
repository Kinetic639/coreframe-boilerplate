# IC-8 — Sections 6-8: RPC Contract, Raw-Write Adversarial, and Caller Audit

## Section 6 — RPC contract audit (live, this pass)

Classified every canonical mutation function/helper named in the task
brief, live against `supabase-target`:

| Function                                                                                                                                                                                                                                                                                                                                                                                                                               | Class                                           | `anon` EXECUTE | `authenticated` EXECUTE                                                                                                                                                     | Notes                                                                                                                                                                                                             |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `inventory_finalize_posting_internal`                                                                                                                                                                                                                                                                                                                                                                                                  | INTERNAL                                        | none           | none (revoked `20260922063459_a4_revoke_authenticated_balance_lock_helper.sql` covers the sibling lock helper; this function's own grants were revoked earlier, PRE-IC8-P0) | Only reachable via same-owner `SECURITY DEFINER` nesting from `inventory_finalize_posting`/`inventory_reverse_movement`. Zero direct TS callers (confirmed by caller-audit agent, Part 1.3).                      |
| `inventory_add_to_container_internal`                                                                                                                                                                                                                                                                                                                                                                                                  | INTERNAL                                        | none           | none                                                                                                                                                                        | Only reachable from `inventory_add_to_container`/`repair_order_add_allocation_to_container`. Zero direct TS callers.                                                                                              |
| `write_repair_order_line_movement_link_internal`                                                                                                                                                                                                                                                                                                                                                                                       | INTERNAL                                        | none           | none                                                                                                                                                                        | Only reachable from `attach_repair_order_line_movement`. Zero direct TS callers.                                                                                                                                  |
| `inventory_get_or_create_balance_for_update`                                                                                                                                                                                                                                                                                                                                                                                           | INTERNAL (unsuffixed, architecturally internal) | none           | none (revoked `20260922063459_a4_...sql`)                                                                                                                                   | 5-arg stale overload already dropped (IC-6). Only the 7-arg canonical form exists, zero external grants.                                                                                                          |
| `inventory_finalize_posting` (2-arg, public)                                                                                                                                                                                                                                                                                                                                                                                           | PUBLIC WRAPPER                                  | none           | operate permission enforced inside                                                                                                                                          | Legitimate public surface; explicit-effects 3-arg overload confirmed gone (`42883` on old signature, IC-2 Scenario E, re-verified live this pass — function does not exist).                                      |
| `inventory_reverse_movement`                                                                                                                                                                                                                                                                                                                                                                                                           | PUBLIC WRAPPER                                  | none           | operate permission enforced inside                                                                                                                                          | Zero direct TS callers found by caller-audit agent — see "Fully-built-backend, zero-frontend" finding below; DB-side contract itself is correct and hardened.                                                     |
| `inventory_receive_stock`, `inventory_create_and_finalize`, `inventory_create_reservation`, `inventory_release_reservation`, `inventory_create_allocation`, `inventory_release_allocation`, `inventory_create_container`, `inventory_remove_from_container`, `inventory_seal_container`, `inventory_send_branch_transfer`, `inventory_accept_branch_transfer`, `inventory_decline_branch_transfer`, `inventory_cancel_branch_transfer` | PUBLIC WRAPPER / DOMAIN WRAPPER                 | none           | operate permission enforced inside                                                                                                                                          | All confirmed live-reachable with correct grants; `inventory_seal_container` has zero TS callers (dead from the app side, not a DB defect — see finding below).                                                   |
| `repair_order_add_allocation_to_container`                                                                                                                                                                                                                                                                                                                                                                                             | DOMAIN WRAPPER (RepairOrder-specific)           | none           | operate permission enforced inside, plus RepairOrder-ownership checks                                                                                                       | A7's own domain-boundary extraction; correctly the sole RepairOrder path into containers (confirmed by caller-audit agent — no RepairOrder caller bypasses it to call `inventory_add_to_container` directly).     |
| `get_repair_order_line_physical_state`                                                                                                                                                                                                                                                                                                                                                                                                 | READ-ONLY                                       | n/a (read)     | granted                                                                                                                                                                     | Replaces the entire A8-removed projection subsystem; live on-demand computation, no persisted projection.                                                                                                         |
| `resolve_branch_receiving_location`                                                                                                                                                                                                                                                                                                                                                                                                    | READ-ONLY (STABLE)                              | none           | granted (per zone5 reconstruction, `migration-reproducibility.md`)                                                                                                          | Reconstructed this pass; grants match the established pattern.                                                                                                                                                    |
| `attach_repair_order_line_movement`                                                                                                                                                                                                                                                                                                                                                                                                    | PUBLIC WRAPPER (RepairOrder-specific)           | none           | operate permission enforced inside                                                                                                                                          | Only path to `repair_order_line_movement_links`; internal helper unreachable directly (confirmed).                                                                                                                |
| `inventory_convert_quantity`                                                                                                                                                                                                                                                                                                                                                                                                           | DEAD (dropped)                                  | n/a            | n/a                                                                                                                                                                         | Dropped `20260922063007_a1_drop_dead_inventory_convert_quantity.sql`; confirmed zero TS callers (only 2 migration-content test-string assertions, not invocations). Correctly removed, not a stale-overload risk. |
| `rebuild_repair_order_location_projection`, `rebuild_repair_order_projection_bucket_internal`                                                                                                                                                                                                                                                                                                                                          | DEAD (dropped, A8)                              | n/a            | n/a                                                                                                                                                                         | Confirmed zero TS callers before removal and zero references post-removal (caller-audit agent). Clean removal.                                                                                                    |
| `inventory_v1_get_or_create_balance`, 5-arg `inventory_get_or_create_balance_for_update` overload                                                                                                                                                                                                                                                                                                                                      | DEAD (dropped, IC-6)                            | n/a            | n/a                                                                                                                                                                         | Confirmed zero callers at time of removal (IC-6's own live `prosrc` scan, re-confirmed this pass via `pg_proc` — neither name resolves).                                                                          |

**Stale overloads**: zero found (re-confirmed live this pass — no function name in the above table resolves to more than one signature in `pg_proc` where more than one should legitimately exist; the one deliberate exception, `inventory_finalize_posting`'s 2-arg-only surface after IC-2's 3-arg removal, was itself re-verified: `42883` on the old 3-arg public-named call).

**`service_role` access**: not separately re-audited this pass beyond what PRE-IC8-P0 and earlier phases already established (no client-reachable `service_role` usage found by the caller-audit agent in either `apps/web` or `apps/public-web`; `apps/mobile`/`apps/vmi-client` have zero references to any protected table or RPC at all).

## Section 7 — Raw-write adversarial audit (live, this pass)

### Finding: `inventory_stock_ledger_entries` raw-insert bypass (FOUND, FIXED, REGRESSION-VERIFIED)

**This is the one HARD BLOCKER fix applied during IC-8**, per Section 37's
own narrow-fix allowance. Full finding, reproduction, root cause, fix, and
regression transcript is documented in the fix migration's own header
comment:
`apps/web/supabase-target/supabase/migrations/20260922172118_ic8_close_stock_ledger_raw_insert_bypass.sql`.

Summary: an authenticated user holding only the ordinary
`warehouse.inventory.operate` permission could raw-INSERT a fabricated
`inventory_stock_ledger_entries` row referencing a draft, never-finalized
movement line, with entirely self-chosen `balance_field`/`direction`/
`quantity`/`balance_after` values — completely bypassing
`inventory_finalize_posting_internal`, the sole intended writer. This does
NOT let the same user move real `on_hand_quantity` (separately protected),
but corrupts the append-only audit trail (Concept A of the architecture).

Discovered via a disciplined 3-step live probe (raw draft header → raw
draft line → raw ledger insert) after an initial ambiguous `23502`
not-null-violation result was NOT accepted at face value — investigated
further until a fully-formed raw INSERT satisfying all NOT NULL/FK
constraints was constructed and succeeded, confirming the real
vulnerability rather than a false negative.

**Fix**: `DROP POLICY inventory_stock_ledger_insert; CREATE POLICY
inventory_stock_ledger_insert_deny ... WITH CHECK (false);` — the same
established pattern already used for `repair_order_line_movement_links`
and (pre-A8) `repair_order_line_locations`. Safe because the sole
legitimate writer is `SECURITY DEFINER` owned by `postgres`
(`rolbypassrls = true`), never dependent on this policy.

**Regression, live-verified**: the same 3-step bypass now fails at step 3
with `42501`. `inventory_create_and_finalize` → `inventory_finalize_
posting_internal` still posts correctly (balance updated to the exact
expected value, exactly one ledger row created). `inventory_reverse_
movement`'s own reversal path also re-verified working end-to-end.

Confirmed via caller-audit agent (Part 1, "Bonus finding"): **zero
TypeScript callers anywhere touch `inventory_stock_ledger_entries`
directly** — this was purely a DB-layer gap (reachable via PostgREST/any
authenticated Supabase client directly, not via any application code
path), not a TS-application-layer bug, and not introduced by any app-side
change.

### Other adversarial probes this pass (all closed, no further findings)

Real `authenticated`/`anon` role contexts (`SET LOCAL ROLE`, `BEGIN...
ROLLBACK`), tested against `inventory_balances`, `inventory_movement_
headers`, `inventory_movement_lines`, `inventory_reservations`,
`inventory_reservation_lines`, `inventory_allocations`, `inventory_
allocation_lines`, `inventory_containers`, `inventory_container_lines`,
branch-transfer tables, RepairOrder attribution links:

- **`anon` write**: denied everywhere tested (RLS `USING (false)`/table
  privilege revoke, table-privilege checks run before RLS so cannot be
  bypassed by any GUC).
- **`authenticated` without permission**: denied (branch-permission checks
  inside RLS policies/RPC bodies).
- **`authenticated` with broad `warehouse.inventory.operate`, raw write
  attempts against `inventory_balances`**: denied — `REVOKE INSERT,
UPDATE, DELETE ON inventory_balances FROM authenticated, anon`
  (PRE-IC8-P0), a hard table-privilege revoke, confirmed still in effect
  this pass.
- **Actor spoofing** (`p_actor_user_id != auth.uid()`): every RPC checked
  (`inventory_reverse_movement`, `inventory_create_reservation`,
  `inventory_add_to_container_internal`, `attach_repair_order_line_
movement`, etc.) rejects with `28000`.
- **Cross-org / cross-branch**: denied via `has_branch_permission`/RLS
  org+branch scoping on every table checked.
- **Direct internal-helper invocation**: denied — see Section 6 table,
  zero external EXECUTE grants on any `_internal` function or `inventory_
get_or_create_balance_for_update`.
- **Self-set known GUCs**: no GUC was found that any RPC or RLS policy
  trusts as a substitute for `auth.uid()`/`has_branch_permission()` — the
  one historical GUC-bypass attempt (against the now-fixed ledger table)
  did not actually rely on GUC manipulation; the real vulnerability was
  the missing INSERT-guard entirely, not a GUC trust issue.
- **Stale public RPC paths**: zero found (Section 6 table).

**False alarm resolved, not reported as a finding**:
`inventory_container_lines` initially appeared to have a permissive raw-
write policy for non-RepairOrder containers via an incomplete summary
query (filtering only on `check_expr NOT ILIKE '%false%'`, missing
`polpermissive`). Re-queried including `polpermissive`: both policies on
this table are RESTRICTIVE (AND semantics), so an always-`false`
RESTRICTIVE policy fully closes the table regardless of the sibling
policy's own condition. Live-confirmed via an actual adversarial probe:
denied, `42501`. Not a real gap.

## Section 8 — Caller audit (apps/web + apps/public-web), delegated to background agent

Full results in the agent's own handback (see conversation record); key
findings synthesized here:

### Clean areas (no findings)

- **Zero direct mutations** against `inventory_reservations`/`_lines`,
  `inventory_allocations`/`_lines`, `inventory_containers`/`_lines`
  (beyond the one flagged dead-code file below), `inventory_branch_
transfers`/`_lines` — every mutation goes through RPC.
- **Zero calls to dropped RPCs** (`inventory_convert_quantity`,
  `rebuild_repair_order_location_projection`, `rebuild_repair_order_
projection_bucket_internal`, the old stale-overload names) — confirmed
  fully cleaned up, no TS code depends on removed functions.
- **Zero direct TS calls to any `_internal`-suffixed function** or to
  `inventory_get_or_create_balance_for_update` — matches Section 6's own
  grant-based finding; the architectural boundary is enforced both at the
  DB grant layer AND the application-code layer (defense in depth).
- **No RepairOrder caller bypasses `repair_order_add_allocation_to_
container`** to call the generic `inventory_add_to_container` directly
  — the A7 domain-boundary extraction is fully respected in application
  code.
- Direct writes to `inventory_movement_headers`/`_lines` (route-key/party-
  detail updates, add/remove draft lines) are a **sanctioned, DB-enforced
  "draft-only" surface** — RESTRICTIVE policies (IC-7) hard-require
  `status = 'draft'` at the DB layer for any such write; posted rows are
  immutable regardless of what the TS layer attempts. Not a bypass.

### Finding: dead, partially-broken direct-write code in `apps/public-web`

`apps/public-web/src/app/actions/warehouse/ambra-location-inventory.ts` —
an un-cleaned fork of code already deleted from `apps/web` during IC-6.
Four exported server actions perform direct (non-RPC) writes against
`inventory_containers`/`_lines` and `inventory_balances.allocated_
quantity`. Since PRE-IC8-P0's `inventory_balances` revoke, 3 of the 4
functions would fail their balance-side write with `42501` if invoked
today — 2 of those 3 **silently swallow the error** (return value
discarded, function still reports `{success: true}`), which would produce
silent, permanent bookkeeping drift on `allocated_quantity` if ever
exercised.

**Reachability**: confirmed dead — zero imports of any of the four action
names anywhere in `apps/public-web/src`, and `apps/public-web` has no
`locations` route at all (only a `map/` subfolder under `dashboard/
warehouse`). Not feature-flagged; simply never wired into any client
component. **Not a live product-integration blocker** — no real user can
reach this code today — but it is exactly the kind of orphaned,
partially-broken, silently-failing code a final-readiness gate should
require removed before sign-off. Per this task's own Section 37 change
policy, deleting/fixing this file is product cleanup, not a genuine HARD
correctness/security blocker for the accepted architecture (nothing live
depends on it, nothing live is corrupted by its mere presence) — **not
fixed in this pass**, flagged here for the deferred-debt list
(`deferred-debt.md`) instead.

### Finding: two fully-built-backend, zero-frontend RPCs

- **`receive_repair_order_stock` / `putaway_repair_order_stock`**: real,
  secured, extensively pgTAP-tested RPCs (touched as recently as A8 itself)
  with **zero TypeScript callers in either app**. RepairOrder's actual
  stock-receiving story in the shipped product is "not yet connected to
  any UI."
- **`inventory_reverse_movement`**: real, secured, extensively tested
  (touched as recently as this pass's own ledger-fix regression check)
  with **zero TypeScript callers in either app**. The only reachable
  "undo" capability from the product today is `inventory_cancel_movement`
  (cancels a still-draft, never-posted movement) — reversing an
  already-posted movement has no product entry point.

Both are DB-layer-correct and DB-layer-secure (Section 6/7 above cover
them fully) — these are product/frontend gaps, not architectural or
security defects, and are explicitly out of IC-8's own scope per Section
37 ("do NOT add new product features"). Flagged for `deferred-debt.md`
and the final readiness assessment, not fixed in this pass.

### Error-contract audit (Section 2 of the caller-audit agent's report)

Five `_KNOWN_ERRORS` allowlists exist, all in `apps/web/src/server/
services/repair-orders.service.ts`, each matched by exact `{code,
pattern}` pairs against the corresponding RPC's real `RAISE EXCEPTION`
statements. All five were cross-checked against this pass's own live
`pg_get_functiondef` output for the corresponding RPCs (via the Section 6
audit above) — no drift found between the allowlisted error contracts and
the live RPC bodies' actual `RAISE EXCEPTION ... USING ERRCODE` statements.

One pre-existing, disclosed-by-the-code-comment risk (not introduced by
IC-8, not a new finding): the reservation/allocation `RAISE EXCEPTION`
statements use bare `RAISE EXCEPTION 'message'` with no explicit `USING
ERRCODE`, so Postgres defaults all of them to `P0001` — a broad,
easily-collided error class if any future RPC change introduces a new
`P0001` in the same call chain. Not a HARD blocker (no live collision
found), noted for `deferred-debt.md`.

One orphaned allowlist entry noted: `Container cannot be sealed from its
current status` (for `inventory_seal_container`) has zero TS callers
(matches Section 6's own dead-RPC-from-app-side note for that function) —
harmless (an allowlist entry ready for a not-yet-wired RPC), not a defect.
