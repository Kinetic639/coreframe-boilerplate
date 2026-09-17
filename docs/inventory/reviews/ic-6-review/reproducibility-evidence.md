# IC-6 From-Scratch Reproducibility Evidence

## Environment limitation (unchanged from every prior IC phase)

No local Docker/Supabase stack is available in this environment (per
`CLAUDE.md`: "NEVER run local Supabase. Always use remote project").
A genuine from-scratch `supabase db reset`-style rebuild against a
fresh local Postgres instance could not be executed. This limitation
is disclosed explicitly, as in every prior IC phase's own bundle.

## Finding: from-scratch reproducibility is CONFIRMED BROKEN — a

## pre-existing condition, not something IC-6 introduced

This is a correction to an earlier, overly optimistic draft of this
file written mid-phase, before the Zone-5 gap (§9D item 11) had been
checked as precisely as it ultimately was. The accurate finding,
matching `inventory-core-architecture.md` §9D item 12:

Confirmed live and precisely: **no locally-mirrored migration creates**
the `repair_order_line_locations` table, the `repair_order_location_
attribution_uncertain` table, the `repair_order_location_attribution_
sync` trigger binding, or the ORIGINAL `CREATE FUNCTION` for
`resolve_branch_receiving_location`/`receive_repair_order_stock` (the
locally-mirrored IC-3 migration for the latter is a `CREATE OR
REPLACE`, which assumes a pre-existing definition it does not itself
provide). These objects were created live by 7 `zone5_*`-named
migrations (`zone5_receiving_location_purpose`, `zone5_repair_order_
spatial_attribution_schema`, `zone5_attribution_sync_trigger`,
`zone5_attribution_sync_trigger_max_uuid_fix`, `zone5_receive_repair_
order_stock_rpc_v2`, `zone5_putaway_repair_order_stock_rpc`, `zone5_
receive_repair_order_stock_use_canonical_attach`) that exist live but
were never locally mirrored — predating this IC-phase project's own
mirroring discipline.

**Consequence**: a `supabase db reset` (or equivalent) replayed against
ONLY the currently-mirrored local migration files would fail the first
time it reached a migration that references `repair_order_line_
locations` or the other objects above (a "relation does not exist" /
"function does not exist" error) — because no local migration creates
them from scratch. This is a genuine, currently-real reproducibility
gap, not a theoretical one.

## This is pre-existing, not introduced or worsened by IC-6

This condition predates IC-6 entirely (it predates this whole
IC-phase project's own local-mirroring discipline). IC-6 did not
create it, and none of IC-6's own 4 migrations depend on any object
that exists only via one of the 7 unmirrored migrations — each of
IC-6's own migrations targets an object created by an already-mirrored
migration (`inventory_v1_get_or_create_balance`/`inventory_get_or_
create_balance_for_update` from IC-1; `inventory_settings`/`inventory_
finalize_posting_internal` from IC-0/IC-1). So IC-6 itself does not
make the from-scratch reproducibility story any WORSE than it already
was — but it does not make it any better either, and this file's own
earlier draft was wrong to imply otherwise.

## What IC-6 did verify precisely (a genuine improvement over prior

## phases' own looser treatment of this gap)

1. **Migration application order verified**: IC-6's own 4 migrations
   were applied live in correct dependency order (the `inventory_
finalize_posting_internal` fix before the `negative_stock_policy`
   column drop), with each step live-verified independently before the
   next was applied.
2. **No squash of applied live migration history** — all 4 are
   separate, timestamped, forward-only files.
3. **The Zone-5 gap is now itemized precisely** (the exact 7 migration
   names and the exact objects each one alone provides), rather than
   merely "flagged" as in earlier phases' own looser treatment — this
   IS a genuine improvement in the honesty/precision of this project's
   own disclosure, even though it does not close the gap itself.

## Decision (Option A, unchanged from IC-5's own prior choice)

Leave the gap explicitly documented (the itemized list above) rather
than fabricate a "baseline snapshot" migration reconstructing complex
historical schema/RLS/trigger state from current live introspection —
the risk of a subtle, silent omission in a hand-reconstructed baseline
was judged higher than the cost of leaving an honestly-documented,
precisely-itemized gap for a future, dedicated phase to close
deliberately. No fake historical timestamps were created.

## Conclusion

From-scratch reproducibility is **BROKEN today**, for a pre-existing
reason IC-6 did not cause and did not worsen. This is disclosed
plainly rather than hedged. Closing it is not IC-6's own job (it is
neither a "legacy writer/helper" nor something this phase's own
migrations touch) — it is a candidate for a future, dedicated
migration-baseline phase.
