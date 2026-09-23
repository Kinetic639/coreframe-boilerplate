# IC-7 Function Grant Matrix

Live-queried (`pg_proc`/`has_function_privilege`, not inferred from
migration text) after all 9 of this phase's own migrations were applied.
`repair_order_location_attribution_sync` and every other `RETURNS
trigger` function are excluded (not meaningfully PostgREST-RPC-callable
regardless of grant state — see `security-evidence.md` item 10).

## Public Business API (authenticated + service_role, anon revoked) — expected shape, confirmed correct

| Function                                   | Signature                                                   | DEFINER                 | anon | auth | svc | Notes                                                  |
| ------------------------------------------ | ----------------------------------------------------------- | ----------------------- | ---- | ---- | --- | ------------------------------------------------------ |
| `inventory_create_draft`                   | `(uuid,uuid,text,jsonb,date,date,text,text,text,text,uuid)` | ✅                      | ❌   | ✅   | ✅  | IC-7A                                                  |
| `inventory_finalize_posting`               | `(uuid,uuid)`                                               | ✅                      | ❌   | ✅   | ✅  | IC-7A                                                  |
| `inventory_create_and_finalize`            | `(uuid,uuid,text,jsonb,date,date,text,text,text,text,uuid)` | ✅                      | ❌   | ✅   | ✅  | IC-7A                                                  |
| `inventory_save_draft`                     | `(uuid,date,date,text,text,text,jsonb,uuid)`                | ✅                      | ❌   | ✅   | ✅  | **IC-7 (was anon-exploitable)**                        |
| `inventory_cancel_movement`                | `(uuid,uuid,text)`                                          | ✅                      | ❌   | ✅   | ✅  | **IC-7 (was anon-exploitable, CRITICAL)**              |
| `inventory_reverse_movement`               | `(uuid,uuid,text)`                                          | ✅                      | ❌   | ✅   | ✅  | IC-2                                                   |
| `inventory_reconcile_balances`             | `(uuid,uuid,uuid)`                                          | ✅                      | ❌   | ✅   | ✅  | **IC-7 (was anon-exploitable, arity changed 2→3)**     |
| `inventory_receive_stock`                  | `(uuid,uuid,uuid,jsonb,date,date,text,text,text)`           | ✅                      | ❌   | ✅   | ✅  | IC-3                                                   |
| `receive_repair_order_stock`               | `(uuid,uuid,uuid,jsonb,date,date,text,text,text)`           | ✅                      | ❌   | ✅   | ✅  | IC-3; zero current TS callers (see entry-point matrix) |
| `inventory_receive_purchase_order`         | `(uuid,jsonb,uuid,text)`                                    | ✅                      | ❌   | ✅   | ✅  | IC-3                                                   |
| `inventory_create_reservation`             | `(uuid,uuid,jsonb,text,uuid,text,timestamptz,text,uuid)`    | ✅                      | ❌   | ✅   | ✅  | **IC-7 (was INVOKER, no actor check)**                 |
| `inventory_release_reservation`            | `(uuid,uuid,boolean)`                                       | ✅                      | ❌   | ✅   | ✅  | **IC-7 (was INVOKER, existence-leak)**                 |
| `inventory_create_allocation`              | `(uuid,uuid,jsonb,uuid,text,uuid,text,uuid)`                | ✅                      | ❌   | ✅   | ✅  | **IC-7 (was INVOKER, no actor check)**                 |
| `inventory_release_allocation`             | `(uuid,uuid)`                                               | ✅                      | ❌   | ✅   | ✅  | **IC-7 (was INVOKER, existence-leak)**                 |
| `inventory_create_container`               | `(uuid,uuid,uuid,text,uuid,text,text,text)`                 | ✅                      | ❌   | ✅   | ✅  | Phase 10C                                              |
| `inventory_add_to_container`               | `(uuid,uuid,uuid,uuid,uuid,numeric)`                        | ✅                      | ❌   | ✅   | ✅  | Phase 10C; disclosed generic/RepairOrder coupling      |
| `inventory_remove_from_container`          | `(uuid,uuid,uuid,uuid,uuid,numeric)`                        | ✅                      | ❌   | ✅   | ✅  | Phase 10C                                              |
| `inventory_seal_container`                 | `(uuid,uuid,uuid,uuid)`                                     | ✅                      | ❌   | ✅   | ✅  | Phase 10C                                              |
| `inventory_create_branch_transfer`         | `(uuid,uuid,uuid,jsonb,text,uuid)`                          | ✅                      | ❌   | ✅   | ✅  | IC-4                                                   |
| `inventory_send_branch_transfer`           | `(uuid,uuid)`                                               | ✅                      | ❌   | ✅   | ✅  | IC-4                                                   |
| `inventory_accept_branch_transfer`         | `(uuid,uuid,uuid,jsonb)`                                    | ✅                      | ❌   | ✅   | ✅  | IC-4                                                   |
| `inventory_decline_branch_transfer`        | `(uuid,text,uuid)`                                          | ✅                      | ❌   | ✅   | ✅  | IC-4                                                   |
| `inventory_cancel_branch_transfer`         | `(uuid,uuid,text)`                                          | ✅                      | ❌   | ✅   | ✅  | IC-4                                                   |
| `attach_repair_order_line_movement`        | `(uuid,uuid,uuid,numeric,text)`                             | ✅                      | ❌   | ✅   | ✅  | IC-2/IC-5                                              |
| `putaway_repair_order_stock`               | `(uuid,uuid,uuid,jsonb,uuid,text)`                          | ✅                      | ❌   | ✅   | ✅  | Zone 5/IC-5; zero current TS callers                   |
| `rebuild_repair_order_location_projection` | `(uuid,uuid,uuid,uuid)`                                     | ✅                      | ❌   | ✅   | ✅  | IC-5; zero current TS callers                          |
| `inventory_approve_count_session`          | `(uuid,uuid)`                                               | ❌ (INVOKER, unchanged) | ❌   | ✅   | ✅  | **IC-7 (actor check added, anon revoked)**             |
| `inventory_seed_movement_types`            | `(uuid,uuid)`                                               | ✅                      | ❌   | ✅   | ✅  | pre-existing, correct                                  |

## Internal only (all ordinary-role EXECUTE revoked, reachable only via same-owner `SECURITY DEFINER` nesting)

| Function                                          | Signature                              | anon | auth | svc                    |
| ------------------------------------------------- | -------------------------------------- | ---- | ---- | ---------------------- | ---------------------------------------------------------- |
| `inventory_finalize_posting_internal`             | `(uuid,uuid,jsonb)`                    | ❌   | ❌   | ❌                     | IC-2, re-confirmed                                         |
| `write_repair_order_line_movement_link_internal`  | `(uuid,uuid,numeric,text,boolean)`     | ❌   | ❌   | ❌                     | IC-5, re-confirmed                                         |
| `rebuild_repair_order_projection_bucket_internal` | `(uuid,uuid,uuid,uuid)`                | ❌   | ❌   | ❌                     | IC-5, re-confirmed                                         |
| `inventory_seed_movement_types_internal`          | `(uuid,uuid)`                          | ❌   | ❌   | ✅ (service_role only) | pre-existing, correct                                      |
| `resolve_branch_receiving_location`               | `(uuid,uuid)`                          | ❌   | ❌   | ✅ (service_role only) | pre-existing, correct                                      |
| `inventory_get_or_create_balance_for_update`      | `(uuid,uuid,uuid,uuid,uuid,uuid,uuid)` | ❌   | ✅   | ✅                     | **IC-7 (anon/PUBLIC revoked; kept authenticated for now)** |

## CLOSED this pass (IC-7 closing pass, 2026-09-19) — was "disclosed not fixed"

The 5 mutation functions and 3 tenant-sensitive read functions below were
disclosed-but-deferred by full IC-7 and are now closed. See
`security-evidence.md`'s own "IC-7 CLOSING PASS" section for the full
live-reproduction/fix/re-verification detail for each.

| Function                                        | Signature                                              | anon (before→after) | auth | svc | Actor check added?                                                                                                                      |
| ----------------------------------------------- | ------------------------------------------------------ | ------------------- | ---- | --- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `inventory_create_enhanced_product`             | `(uuid,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,uuid,uuid)` | ✅→❌               | ✅   | ✅  | Yes (`28000`)                                                                                                                           |
| `inventory_create_product_with_default_variant` | `(uuid,text,text,uuid,text,text,uuid)`                 | ✅→❌               | ✅   | ✅  | Yes (`28000`)                                                                                                                           |
| `inventory_create_purchase_order`               | `(uuid,uuid,uuid,jsonb,date,uuid,text,text,uuid)`      | ✅→❌               | ✅   | ✅  | Yes (`28000`)                                                                                                                           |
| `inventory_create_count_session`                | `(uuid,uuid,jsonb,text,uuid)`                          | ✅→❌               | ✅   | ✅  | Yes (`28000`)                                                                                                                           |
| `inventory_create_valuation_snapshot`           | `(uuid,uuid,date)`                                     | ✅→❌               | ✅   | ✅  | No — no actor param exists, no actor-tracking column on the target table; grant-only hardening (see rationale in the migration itself)  |
| `inventory_count_session_list`                  | `(uuid,uuid,text,text,integer,integer)`                | ✅→❌               | ✅   | ✅  | N/A, read-only; grant-only (tenant-sensitive audit data)                                                                                |
| `inventory_find_sku_collisions`                 | `(uuid,text[],uuid[])`                                 | ✅→❌               | ✅   | ✅  | N/A, read-only; already body-filtered to empty for anon, grant-only hardened defensively                                                |
| `inventory_convert_quantity`                    | `(uuid,uuid,uuid,uuid,numeric)`                        | ✅→❌               | ✅   | ✅  | N/A, read-only; **had zero permission check of any kind pre-fix** — genuine tenant-config-data exposure, zero TS/SQL callers found live |

**Genuine actor-spoofing vulnerability found and closed this pass**: the 4
actor-bearing functions above accepted `p_actor_user_id` but never
validated it against `auth.uid()` — LIVE-REPRODUCED with a real, different
user id: an authenticated caller holding the correct business permission
could forge `created_by`/`updated_by` on a product, purchase order, or
count session to an arbitrary other real user's identity. Grant exposure
alone (anon/PUBLIC EXECUTE) was separately confirmed NOT independently
exploitable through any tested anon/no-permission path — each function's
own body-level `has_permission`/`has_branch_permission` check already
correctly rejected those callers — but was hardened anyway per the
established "mutation APIs never carry anon EXECUTE" convention.

## Remaining out-of-scope, genuinely public utility functions (unchanged)

| Function                                            | Signature                              | Domain                                                                                                                                                                                                                                  |
| --------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `inventory_build_sku_from_pattern`                  | `(text,text,text,text,bigint,integer)` | Pure computation, no table access, no side effect — genuinely public, unchanged                                                                                                                                                         |
| `inventory_sku_fingerprint` / `inventory_sku_token` | various                                | Pure computation, no table access, no side effect — genuinely public, unchanged                                                                                                                                                         |
| `inventory_preview_sku`                             | `(uuid,text,text)`                     | Read-only preview; already correctly gated by `has_permission('warehouse.products.read')` — live-confirmed anon rejected; left as-is (not independently re-hardened, out of this closing pass's own 8-function scope, no exploit found) |
| `inventory_variant_matches_audit_supplier`          | `(uuid,uuid,uuid,uuid,uuid)`           | Boolean-only matcher, requires 3 already-known UUIDs as input, discloses no record data — left as-is, low-severity, out of this closing pass's own scope                                                                                |

## Stale overloads

**None found**, including after the closing pass's own 4 additional
migrations (live-verified via a `GROUP BY proname HAVING count(*) > 1`
query over all 8 functions touched, both directly and inside
`111_ic7_closing_security_test.sql`'s own STALE-OVERLOAD assertion). The
one historical case, `inventory_get_or_create_balance_for_update`'s own
5-arg/7-arg duplication, was already closed by IC-6.

## Legacy/removed

No function was removed this phase or the closing pass (both are
hardening passes, not cleanup passes — that was IC-6's own scope).
`inventory_reconcile_balances`'s own OLD 2-arg signature was dropped as
part of its arity change (item 5 in `security-evidence.md`) — confirmed
`to_regprocedure` NULL post-drop. The closing pass's `CREATE OR REPLACE`
calls did not change any function's arity (only inserted the actor check
as new first-line body logic within the SAME existing signature).
