# IC-1 — Migration Summary

Three forward migrations, applied via Supabase MCP `apply_migration` against
`supabase-target`, live-verified via `pg_get_functiondef`/`pg_get_
constraintdef` after each apply, then mirrored locally under their exact
live-reported version/timestamp. No already-applied migration was edited.

## 1. `20260915062211_ic1_inventory_balances_on_hand_nonnegative_check`

```sql
ALTER TABLE public.inventory_balances
  ADD CONSTRAINT inventory_balances_on_hand_nonnegative
  CHECK (on_hand_quantity >= 0);
```

**Why**: IC-0 live-verified the two sibling CHECK constraints
(`inventory_balances_allocated_nonnegative`, `inventory_balances_
reserved_nonnegative`) already existed; `on_hand_quantity >= 0` did not.
**Data safety**: all 37 existing `inventory_balances` rows live-queried
before this migration — zero violate it. Safe forward migration, no data
repair needed.

## 2. `20260915062244_ic1_inventory_finalize_posting_hard_invariant`

`CREATE OR REPLACE FUNCTION public.inventory_finalize_posting(...)`. Two
changes to the existing, unmodified-otherwise function body:

1. **Balance-getter replacement**: `v_balance_id := inventory_v1_get_or_
create_balance(...)` (bare uuid) → `v_balance := inventory_get_or_
create_balance_for_update(...)` (full row, `FOR UPDATE`-locked). IC-0
   confirmed the v1 helper had exactly one production caller — this
   function — and that the replacement's lot/serial-agnostic call shape is
   behaviorally identical to v1's own implicit NULL/NULL behavior. The old
   helper is NOT dropped (that's IC-6's job); this migration proves its
   remaining caller count is now zero.

2. **New hard invariant**, inserted immediately before the pre-existing
   `on_hand < 0` check, evaluated only when `balance_field='on_hand' AND
direction='decrease'`:

   ```sql
   IF v_new_qty < (v_balance.reserved_quantity + v_balance.allocated_quantity) THEN
     RAISE EXCEPTION 'Movement would strand committed stock: ...'
       USING ERRCODE = 'P0003';
   END IF;
   ```

   Unconditional (no `negative_stock_policy` gate — no sanctioned bypass
   caller exists yet). New SQLSTATE `P0003`, extending the project's
   existing `P0`-family convention (`P0001` default RAISE, `P0002`
   "not found").

## 3. `20260915062422_ic1_inventory_finalize_posting_fix_ambiguous_overload`

Same-day forward fix. Migration 2's balance-getter call used 5 positional
arguments. `inventory_get_or_create_balance_for_update` has two overloads —
a true 5-arg one and a 7-arg one whose trailing two parameters
(`p_lot_id`, `p_serial_id`) both default to `NULL`. A 5-positional-argument
call is genuinely ambiguous between them (`42725: function ... is not
unique`) — live-reproduced when re-running the characterization scenario
immediately after migration 2 was applied, not a hypothetical. Fixed by
passing all 7 positional arguments explicitly (trailing two `NULL::uuid`),
matching the exact call convention `inventory_create_allocation`'s own body
already uses. Functionally identical to the 5-arg call — no new lot/serial
behavior exposed. Migration 2 itself was never edited.

## Post-apply live verification performed

- `pg_get_constraintdef` on the new CHECK — confirmed present, correct
  definition, alongside the two pre-existing sibling constraints.
- `pg_get_functiondef` on `inventory_finalize_posting` after each of
  migrations 2 and 3 — confirmed `uses_new_helper=true`, `still_uses_
v1=false`, `has_new_invariant_code=true`, `has_sum_check=true`.
- Re-ran the full receive→reserve→allocate→putaway characterization
  scenario live after migration 3 — confirmed the fix resolved the
  ambiguity and produces the exact expected rejection/success behavior (see
  `review-context.md` item 1 for the full transcript).
- Confirmed via `prosrc` search across every function that `inventory_v1_
get_or_create_balance` now has zero remaining production callers.
