# IC-6 Migration Summary

All 4 migrations applied live to `supabase-target` via
`mcp__supabase-target__apply_migration`, then live-verified independently
(never trusting the tool's own success response), then mirrored locally
under `apps/web/supabase-target/supabase/migrations/` using the EXACT
live-reported version/timestamp from `list_migrations`. Applied in
dependency order: the function fix (step 1) had to precede the column
drop (step 2), since the function was the column's own only remaining
SQL reader.

## 1. `20260917062247_ic6_finalize_posting_remove_dead_negative_stock_policy_check.sql`

`CREATE OR REPLACE FUNCTION public.inventory_finalize_posting_internal
(p_movement_id uuid, p_actor_user_id uuid DEFAULT NULL, p_explicit_
effects jsonb DEFAULT NULL) RETURNS jsonb` — full function body
reproduced with only the 3-line dead conditional removed:

```sql
-- REMOVED:
-- IF v_new_qty < 0 AND v_settings.negative_stock_policy = 'block' THEN
--   RAISE EXCEPTION 'Insufficient stock: % has % on hand, need % for line %',
--     v_line.variant_id, v_current_qty, v_line.quantity, v_line.line_number;
-- END IF;
```

The `SELECT * INTO v_settings FROM inventory_settings WHERE
organization_id = v_header.organization_id FOR UPDATE;` row-lock
statement (earlier in the function) preserved byte-for-byte in its own
original position — IC-6 must not alter locking/concurrency behavior,
and that lock serves purposes independent of this one field.

**Live-verified**: `pg_get_functiondef(...) NOT ILIKE
'%negative_stock_policy%'` → true; exactly one overload
`inventory_finalize_posting_internal(uuid,uuid,jsonb)` confirmed via
`pg_proc`.

## 2. `20260917062301_ic6_drop_negative_stock_policy_column.sql`

`ALTER TABLE public.inventory_settings DROP COLUMN
negative_stock_policy;`

**Live-verified**: `information_schema.columns` query for this column
on `inventory_settings` returns zero rows; `pg_constraint` query for
`inventory_settings_negative_stock_policy_check` returns zero rows (the
CHECK was dropped automatically with the column).

**Data-impact proof**: exactly 1 live row in `inventory_settings`,
value `'block'` (the column's own DEFAULT) — no meaningful state lost.

## 3. `20260917062315_ic6_drop_stale_balance_helper_5arg_overload.sql`

`DROP FUNCTION public.inventory_get_or_create_balance_for_update(uuid,
uuid, uuid, uuid, uuid);` — the stale 5-arg overload only.

**Live-verified**: `to_regprocedure('public.inventory_get_or_create_
balance_for_update(uuid,uuid,uuid,uuid,uuid)')` returns NULL post-drop;
the 7-arg canonical signature (`...(uuid,uuid,uuid,uuid,uuid,uuid,
uuid)`) confirmed still present and unchanged; `pg_proc` row count for
this proname = 1 (exactly one overload remains).

## 4. `20260917062320_ic6_drop_dead_v1_balance_helper.sql`

`DROP FUNCTION public.inventory_v1_get_or_create_balance(uuid, uuid,
uuid, uuid);`

**Live-verified**: `to_regprocedure('public.inventory_v1_get_or_
create_balance(uuid,uuid,uuid,uuid)')` returns NULL post-drop.

## Order and dependency reasoning

1 → 2 → 3 → 4. Migrations 1 and 2 are a dependent pair (function must
stop referencing the column before the column can be dropped); 3 and 4
are independent of 1/2 and of each other, applied last since they carry
zero cross-dependency risk with the negative_stock_policy cleanup.

## Local mirroring

All 4 mirrored under their exact live-reported timestamps (`20260917062247`,
`20260917062301`, `20260917062315`, `20260917062320`) in
`apps/web/supabase-target/supabase/migrations/`, matching this project's
established live-first, mirror-second discipline. None were edited after
being applied — each fix is its own separate forward migration.
