# Zone 5 Phase-10 Attribution Integration — Migration Summary

## `20260914130000_zone5_receive_repair_order_stock_use_canonical_attach.sql`

- **Object changed**: `public.receive_repair_order_stock(uuid, uuid, uuid, jsonb, date, date, text, text, text)`
  — `CREATE OR REPLACE FUNCTION`, same name/signature/OID as the already-live function (this is a
  forward migration; the already-applied `20260912093000`/`20260914124640` migration files are
  not edited in place).
- **Before**: business-quantity attribution was a direct
  `INSERT INTO public.repair_order_line_movement_links (repair_order_line_id,
inventory_movement_line_id, applied_quantity, relation_type) VALUES (..., 'receipt')`, with no
  `ON CONFLICT` clause.
- **After**: `PERFORM public.attach_repair_order_line_movement(p_actor_user_id, v_resolved_rol_id,
v_movement_line_id, v_qty, 'receipt')` — the canonical, fully-validated Zone 3 Phase 10 writer,
  called inside the same transaction/orchestration. Everything else in the function is unchanged
  byte-for-byte: same actor/permission checks, same provenance resolution, same engine call, same
  spatial-seed `INSERT INTO repair_order_line_locations`.
- **Why required**: Zone 3 Phase 10 closed the direct-INSERT write boundary on
  `repair_order_line_movement_links` (a deny-all RLS policy) and established
  `attach_repair_order_line_movement` as the one canonical writer. `receive_repair_order_stock`'s
  own direct INSERT had kept silently working past that closure only because its `SECURITY
DEFINER` owner (`postgres`) has `rolbypassrls` — an architectural overlap, not a security hole
  (both paths were already equally privileged), but one canonical implementation of the
  attribution invariants is the intended end state.
- **RLS**: unaffected — this migration touches no RLS policy. `repair_order_line_movement_links`'s
  own INSERT-deny policy (from Phase 10's own migration) is unchanged; `receive_repair_order_stock`
  now simply routes through the one path that policy was always meant to leave open (the canonical
  RPC), rather than around it.
- **Constraints/FKs**: none added/changed.
- **Function/RPC**: `receive_repair_order_stock` — `SECURITY DEFINER`, signature unchanged.
  Live-verified: no longer contains any direct `INSERT INTO repair_order_line_movement_links`;
  does contain a call to `attach_repair_order_line_movement`. Grants unchanged
  (`authenticated`=EXECUTE, `anon`=none, `PUBLIC`=none).
- **Live verification**: **DONE** — applied via Supabase MCP (`apply_migration`), live version
  `20260914173843`. Pre-apply: both live function contracts inspected fresh
  (`pg_get_functiondef`/`pg_proc`), the overlap confirmed, every one of the canonical RPC's own
  invariants confirmed already-guaranteed-true for a Zone-5-created receipt line (via a real
  committed `101` movement's actual header shape), nested `SECURITY DEFINER` `auth.uid()`
  propagation proven live via a throwaway wrapper function. Post-apply: pgTAP `096` re-run in full
  (20/20 passing + 1 honest skip, plan 21), Phase 10's own pgTAP `097` re-run live unmodified
  (29/29 passing), a genuine idempotent-retry behavioral finding discovered and proven atomic
  (8a-8d), multi-line same-call independence proven (9a-9d).
- **Local/live parity**: confirmed via `list_migrations` — live version `20260914173843` present,
  named `zone5_receive_repair_order_stock_use_canonical_attach`, matching the local file's own
  intended name (MCP assigns its own version timestamp, same disclosed nuance as every other Zone
  5 migration this session).
