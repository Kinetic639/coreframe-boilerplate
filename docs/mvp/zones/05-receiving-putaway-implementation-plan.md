# Zone 5 — Receiving / Putaway: Implementation Plan

> Status: **APPROVED FOR IMPLEMENTATION** (as of the sixth revision below). No code, migrations,
> or Supabase changes have been made yet — this remains a planning document until an explicit
> implementation turn begins, but the architecture itself is no longer open for re-litigation
> absent new evidence.
>
> History: the fourth revision replaced an initial FIFO-based ledger-trigger design (which
> fabricated RepairOrder attribution via heuristic inference whenever stock was commingled) with
> a no-inference design: the projection changes only (a) via a RepairOrder-aware caller supplying
> **explicit, operator-confirmed identity**, or (b) automatically, but **only when the answer is
> the unique, provably-correct one**. The fifth revision fixed a trigger-timing bug (pre-effect
> balance must be reconstructed from the ledger row itself, never re-queried post-effect) and
> introduced an explicit KNOWN/UNKNOWN uncertainty marker so an ambiguous movement invalidates
> confidence rather than leaving stale data readable as current. **This sixth revision corrects
> the uncertainty marker's own semantics**: it must never self-heal from arithmetic coincidence,
> an ambiguous transfer must mark _both_ ends uncertain (not just the source), and the bypass
> flag's risk classification is corrected to "correctness, not security." See §1.6a–§1.6c, §2,
> §5, §12.1, and §13 for the exact corrected mechanics. Sections not touched by any of these
> corrections (receiving buffer, `warehouse_locations.purpose`, `801` as the relocation
> primitive, `repair_order_line_movement_links` staying a business-quantity ledger,
> `container_id` out of the pitch projection, batch putaway, server-authoritative Matcher
> resolution, no fake capacity, composite FKs, reversal UNKNOWN classification) are carried
> forward unchanged — see §16 for the explicit "unchanged" list.

## 0. Scope discipline (unchanged)

```
Matcher session → 101 receipt → branch RECEIVING buffer
  → putaway analysis (current RepairOrder-attributed stock, by location)
  → operator picks destination → 801 → final location
  → RepairOrder current-location attribution stays correct — via explicit, known-true writes
    where the caller has that knowledge, and via a conservative, guess-free safety net
    everywhere else
```

## 1. The core correction: stop inferring, only ever know or refuse

### 1.1 What was wrong with the FIFO-trigger design

Given, at location A, variant X: RepairOrder 1 = 5, RepairOrder 2 = 5, ordinary/unattributed =
10 — and a plain Zone 6 `801` moving 2 units of X from A to B — **the movement itself carries no
information about which physical 2 units moved.** FIFO-by-`updated_at` invented an answer. That
keeps the projection internally self-consistent (quantities always sum correctly, never go
negative) while being potentially **factually wrong** about which RepairOrder's parts are now at
B. The product requirement — "where parts attributable to a specific RepairOrder _actually_
are" — is a physical-truth requirement, not an accounting-consistency requirement, and the two
are not the same thing here.

### 1.2 Does the repo have a physical-identity dimension that could disambiguate?

Checked: `inventory_movement_lines` carries `lot_id`, `serial_id`, `container_id` — all
nullable, all currently **dormant** (v1 has no lot/serial/costing logic running at all — "Phase
1 units are base-unit only," "No FIFO/weighted-average costing," confirmed in the engine's own
migration comments; `container_id` is confirmed unset by any current movement-creation code
path, same finding as containers generally). **None of these is populated by anything today.**
A container _would_ give exact physical identity if used (moving a container moves exactly its
contents, unambiguous by construction) — but container UI is explicitly PILOT scope, and
activating container-tracking now, merely to solve this, would be exactly the "activate the
whole container domain just because it exists" move the product owner has repeatedly warned
against.

**Conclusion, stated plainly, not hidden behind a heuristic: a generic `801` posted through
Zone 6's existing, unmodified UI cannot today carry enough information to know _which_
RepairOrder's stock (or whether ordinary stock) was moved, whenever more than one attribution
source shares the same `(location, variant)`.** This is a real, disclosed limitation of the
current engine, not a Zone 5 design gap to paper over.

### 1.3 The resolved invariant — and the pre-effect balance correction

A second, independent review round found that the ambiguity test as first stated
(`SUM(repair_order_line_locations.quantity) = inventory_balances.on_hand_quantity`) is
**wrong about timing**: `inventory_finalize_posting`'s own traced ordering is (1) resolve/lock
the balance row, (2) compute the new quantity, (3) `UPDATE inventory_balances`, (4) **then**
`INSERT inventory_stock_ledger_entries`. An `AFTER INSERT` trigger on the ledger table therefore
always sees `inventory_balances.on_hand_quantity` **already reflecting the current effect** —
comparing the projection's sum (which reflects the state _before_ this effect) against the
_post_-effect balance would falsely flag an actually-unambiguous move as ambiguous (e.g.
on-hand 5→3 after a decrease of 2, while the projection still correctly says 5 — a naive
`5 != 3` check would wrongly reject it).

**Corrected: the trigger never re-queries `inventory_balances` at all.** It reconstructs the
pre-effect on-hand quantity **only from the ledger row's own columns**
(`balance_after`, `quantity`, `direction` — all present on every
`inventory_stock_ledger_entries` row, confirmed against the tracked schema), which is also
strictly safer: it needs no extra read of a table something else might be concurrently locking.

```
pre_effect_on_hand :=
  CASE NEW.direction
    WHEN 'decrease' THEN NEW.balance_after + NEW.quantity   -- balance_after = before − quantity
    WHEN 'increase' THEN NEW.balance_after - NEW.quantity   -- balance_after = before + quantity
  END;
```

The unambiguous test becomes: `SUM(repair_order_line_locations.quantity)` at
`(location_id = NEW.location_id, variant_id = NEW.variant_id)`, read **before** this trigger
invocation makes any change, equals `pre_effect_on_hand`, **and** exactly one
`repair_order_line_id` contributes to that sum. Only then does the trigger act — decrementing
that one row by `NEW.quantity` and, if the movement line is transfer-shaped (see below),
crediting the same `repair_order_line_id` at the paired destination by the same amount. **In
every other case the trigger takes no action at all** (see §1.6 for what "no action" now also
means for the read model). No FIFO, no partial apportionment, no fabricated number — this
directly resolves the review's central objection, twice over now (no inference, and no
timing bug in the one check that remains).

Exact behavior per ledger-row shape (all five kinds the review asked to trace explicitly):

| Shape                             | `direction` | line's `source_location_id` | line's `destination_location_id` | Trigger behavior                                                                                                                                                                                         |
| --------------------------------- | ----------- | --------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `801` source effect               | `decrease`  | (this location)             | set                              | Run the test above at the **source**. If unambiguous: decrement source row, credit same `repair_order_line_id` at destination.                                                                           |
| Pure issue/`601`-shaped decrease  | `decrease`  | (this location)             | `NULL`                           | Run the test above. If unambiguous: decrement, credit nowhere.                                                                                                                                           |
| `402` decrease                    | `decrease`  | (this location)             | `NULL`                           | Same as pure issue — governed by the identical single rule, no special case (see §5).                                                                                                                    |
| `101` receipt increase            | `increase`  | `NULL`                      | (this location)                  | **No-op, unconditionally** — nothing pre-existed to infer from; `receive_repair_order_stock` writes the seed explicitly instead. Pre-effect math is irrelevant here since the branch never reads it.     |
| `801` paired destination increase | `increase`  | set (same line)             | (this location)                  | **No-op, unconditionally** — already handled by the paired decrease's own invocation, which fires first (`effect_order` 1 before 2) within the same transaction. Pre-effect math is irrelevant here too. |

This single rule (plus the two unconditional no-op rows, which need no ambiguity test at all)
also directly answers the 402-adjustment question (§5) and the
multiple-RepairOrder/ordinary-stock-mixed question (§2/§3) with one mechanism, not three special
cases.

### 1.3a Guard: physical stock only

The trigger's very first statement, before anything else (including the pre-effect
reconstruction), is:

```sql
IF NEW.balance_field IS DISTINCT FROM 'on_hand' THEN
  RETURN NULL;  -- reserved / allocated / blocked / consignment effects are not physical location
END IF;
```

`inventory_stock_ledger_entries.balance_field` and `inventory_movement_type_effects.balance_field`
both already model this exact set of values (`on_hand | reserved | allocated | blocked |
consignment`, confirmed against the tracked engine schema) — `101` and `801` today only ever use
`on_hand`, but any future reservation/allocation-type effect must never be allowed to move or
decrement physical `repair_order_line_locations` rows, since reserving stock doesn't relocate it.
This is the cheapest possible guard (a single column comparison) and is checked first, before
the `balance_field='on_hand'`-scoped fast no-op check in §1.3b.

### 1.3b Fast no-op path

Immediately after the `balance_field` guard: if no row in `repair_order_line_locations` exists
for `(organization_id, branch_id, location_id, variant_id)`, `RETURN NULL` immediately. This
keeps the overhead on the overwhelming majority of ordinary, non-RepairOrder-attributed
movements to one cheap indexed lookup, before any pre-effect reconstruction or locking happens.

### 1.4 Where does correctness come from, then, in the ambiguous case?

From the caller having and supplying **explicit identity**, not from inference. This means the
two Zone-5-owned RPCs revert to writing `repair_order_line_locations` **directly**, using their
own operator-confirmed input, rather than relying on the trigger to reconstruct their intent
after the fact:

- `receive_repair_order_stock` already resolves an exact `repair_order_line_id` per line (§9)
  before posting — it writes the seed attribution row itself. Nothing to infer.
- `putaway_repair_order_stock` already requires the operator (via the suggestion UI) to name an
  exact `repair_order_line_id` per line being moved (§4 of the prior revision, unchanged) — it
  writes the exact transfer itself. Nothing to infer, and no ambiguity-check is even needed on
  this path, because the identity is given, not deduced.

To stop the safety-net trigger from _also_ trying to propagate (and either double-applying, in
the rare case its own unambiguous condition happens to also hold, or safely no-op'ing) for
movements posted by these two RPCs, both `SET LOCAL
ambra.repair_order_attribution_authoritative = 'on'` before calling
`inventory_create_and_finalize`, and the trigger checks
`current_setting('ambra.repair_order_attribution_authoritative', true)` — if set, it skips
entirely for that transaction, deferring fully to the calling RPC's own explicit write. **This
reuses an idiom this exact engine already established** (`ambra.inventory_movement_engine`,
`SET LOCAL`-scoped, checked only inside `SECURITY DEFINER` context, never settable by a plain
client call) — it is not a new mechanism, it's the same one applied to a second, narrower
purpose.

So, precisely:

| Caller                                                                          | Attribution mechanism                                                                                               |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `receive_repair_order_stock`                                                    | Direct, explicit write (known-true) — flag set, trigger skipped                                                     |
| `putaway_repair_order_stock`                                                    | Direct, explicit write (known-true) — flag set, trigger skipped                                                     |
| Zone 6's existing relocation UI (unmodified)                                    | Safety-net trigger — **only** when unambiguous; silently _no-ops_ (does not corrupt, does not guess) when ambiguous |
| Any future generic movement (402, future WU before it's made RepairOrder-aware) | Same safety-net trigger, same rule                                                                                  |

### 1.5 Does Zone 6 need to change?

**Not for pitch, and not silently.** The honest position, per the review's own framing ("a small
generic integration may be preferable to silently guessing" — evaluated, not adopted yet):

- For pitch: the demo's own data is curated so that ambiguity never actually arises at any
  location the script touches (single RepairOrder's stock per variant per location throughout
  the rehearsed flow) — this is a **choreography** constraint on the demo, stated plainly to the
  presenter, not an architectural guarantee.
- **Recorded as the correct PILOT-scope fix, not implemented now**: Zone 6's relocation UI could
  gain a small, **domain-neutral** extension — when the source location/variant it's about to
  move has more than one attribution source, the generic engine could accept an optional,
  inert, per-line **attribution reference** (a plain string/UUID the engine stores and passes
  through to the ledger entry without interpreting it at all, exactly the way `note` or the
  header's `reference_type`/`reference_id` are already generic, engine-neutral pass-through
  fields today) — Zone 6's UI would then prompt "this location holds stock from more than one
  source — which one are you moving?" only when ambiguous, and pass whatever the operator picks
  as that opaque reference. Zone 5's trigger (or a Zone-5-owned second trigger reading that same
  reference) would then use it as _given_ identity, same as the two orchestration RPCs already
  do — no RepairOrder concept is imported into the generic engine, only an optional, uninterpreted
  string column. **This is Option B from the review's list, evaluated and recommended as the
  PILOT-scope answer** — it is the smallest correct boundary, but it is a real (if tiny) touch
  to a generic-engine table (`inventory_movement_lines` gains one nullable, inert column), so it
  is deliberately not bundled into pitch scope, where the choreography-based mitigation above is
  sufficient and requires zero engine changes.
- Option A (force all RepairOrder-attributed relocation through a RepairOrder-aware path) was
  re-evaluated and again rejected: it cannot be _enforced_ without either modifying Zone 6 (which
  the option above does more surgically and generically) or trusting operators to remember,
  which is exactly what "must not silently corrupt" is warning against.
- Option D (accept FIFO as accounting-only attribution) is available if the product owner
  explicitly overrides this recommendation later, but is not the default — the review's own
  framing treats physical truth as the requirement, and this plan follows that.

### 1.6 KNOWN vs UNKNOWN — ambiguity must invalidate, not silently persist as "current"

A further review round correctly identified a remaining honesty gap: "the trigger takes no
action" is better than guessing, but it is not the same as "the projection is still correct."
If stock physically moved out of a commingled location and the trigger (rightly) declined to
guess which RepairOrder it belonged to, the **existing** `repair_order_line_locations` rows for
that `(location, variant)` are no longer provably true — they must not keep being read back as
confidently KNOWN-current by the putaway suggestion UI.

**Evaluated options:**

- _(A)_ a validity/uncertain flag per attribution row,
- _(B)_ a separate uncertainty marker at the `(organization_id, branch_id, location_id,
variant_id)` grain,
- _(C)_ delete/zero the affected rows outright and surface "location unknown,"
- _(D)_ another minimal approach.

**Decision: (B), a small, additive, non-destructive marker table** —

```sql
CREATE TABLE public.repair_order_location_attribution_uncertain (
  organization_id UUID NOT NULL,
  branch_id       UUID NOT NULL,
  location_id     UUID NOT NULL,
  variant_id      UUID NOT NULL,
  first_uncertain_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, branch_id, location_id, variant_id),

  CONSTRAINT rolau_location_fk
    FOREIGN KEY (location_id, organization_id, branch_id)
    REFERENCES public.warehouse_locations (id, organization_id, branch_id)
);
-- No client RLS write policy -- written only by the safety-net trigger's own
-- SECURITY DEFINER context, same posture as repair_order_line_locations itself.
```

_(C)_ was rejected: deleting/zeroing the existing rows destroys the last-known state with no
compensating benefit — the honest statement isn't "we know nothing was ever here," it's "we no
longer know if this specific number is still current." A non-destructive marker preserves that
distinction and is strictly smaller than a full reconciliation workflow (which is explicitly not
being built now).

**Behavior:**

- On an ambiguous decrease (§2/§3/§5 — the test in §1.3 fails), the trigger, instead of touching
  `repair_order_line_locations`, `UPSERT`s a row here for that exact
  `(organization_id, branch_id, location_id, variant_id)`. The existing
  `repair_order_line_locations` rows for that location/variant are left untouched (not deleted,
  not zeroed) — they remain available as "last known," but are no longer surfaced as
  authoritative (see below).

### 1.6a Correction (fifth review round): UNKNOWN must not self-heal from arithmetic equality

The design above originally let the marker be "implicitly superseded" the moment the
mathematical unambiguous test happened to pass again. **This is rejected.** Once an ambiguous
physical movement has occurred, actual provenance has been lost — later observing
`SUM(attribution) == on_hand` again does not _prove_ those attribution rows still correspond to
the real physical stock; it only proves the numbers happen to line up. Numerical consistency is
not provenance recovery, and the trigger must not treat it as such.

**Corrected rule — the marker gates further automatic reasoning, it does not get bypassed by it:**
once a `(location, variant)` has an active uncertainty marker, the trigger **does not attempt the
math test again** for that bucket on any subsequent movement. It simply re-affirms (and, if the
movement is transfer-shaped, extends) the marker at whichever location(s) the movement touches,
until the marker is authoritatively cleared (§1.6b) — never merely because a later computation
would have looked unambiguous.

### 1.6b Authoritative clearing — the only ways UNKNOWN may be cleared

1. **On-hand for that `(location, variant)` reaching exactly zero.** This is the one
   automatic, opportunistic clearing the trigger performs itself — checked from `NEW.balance_after`
   directly (no reconstruction needed, since this is the ledger row's own post-effect value),
   for _every_ `on_hand` ledger entry, unconditionally, before the bypass-flag check or anything
   else. Zero stock trivially means zero ambiguity: there is nothing left to be uncertain about.
   This is the **only** case where clearing does not require full-bucket authoritative knowledge
   from a human/business action, because "empty" is itself complete knowledge of the bucket.
2. **A future, explicit attribution-reconciliation operation** (PILOT scope, not built now) that
   authoritatively re-establishes the attribution of the **entire** affected `(location,
variant)` bucket — not just one line. This is deliberately not designed in detail here beyond
   naming it as the eventual mechanism; no reconciliation UI is built for pitch.
3. **A future container/scan flow that proves physical identity** (PILOT/LATER, per the
   container-deferral decision already made) — genuinely observing what's physically present
   would also constitute full-bucket authoritative knowledge.

**Explicitly rejected as a clearing mechanism**: a single RepairOrder-aware RPC call
(`receive_repair_order_stock`/`putaway_repair_order_stock`) writing or moving **one**
`repair_order_line_id`'s stock at a marked bucket does **not** clear the marker for that bucket
on its own — it proves that one line's own quantity is now known-true (its row is written
directly and is itself trustworthy), but it does not prove anything about _other_ stock that may
still be sitting at that same `(location, variant)`, attributed or not, which is exactly the
"more than one trusted movement" gap the review is guarding against. The marker stays until the
bucket empties (rule 1) or an explicit, full-bucket reconciliation happens (rules 2/3).

**For pitch: UNKNOWN is sticky.** The only clearing path pitch data will ever realistically hit
is rule 1 (a location emptying out), and the demo's own choreography avoids triggering UNKNOWN in
the first place (§1.5). Sticky UNKNOWN is the deliberate, accepted behavior — preferable to any
form of false certainty.

### 1.6c Read model contract (corrected)

Every consumer of `repair_order_line_locations` (the putaway suggestion query, in particular)
must treat a `(location, variant)` with an active uncertainty marker as **UNKNOWN**, full stop —
**never re-derived or re-checked against the live math at read time** (that re-check is exactly
the self-healing behavior §1.6a rejects). The read model's only question is "does an active
marker row exist for this bucket" — if yes, UNKNOWN; if no, KNOWN. It must either omit an
UNKNOWN bucket from confident `[Put here]`-eligible suggestions entirely, or surface it in a
clearly separate, visibly-labeled section (e.g. "Location attribution requires verification") —
**UNKNOWN must never render identically to KNOWN.** Which of the two (omit vs. separate section)
remains a UI-copy/product choice, not an architecture one. See §11.3 for the exact DTO field.

This is deliberately the smallest honest representation: one small table, no workflow, no
per-row status machine, no self-healing — a location/variant either has no marker (read the
projection with confidence) or has one (treat it as unknown until an authoritative clearing
event, §1.6b, removes it).

## 2. Commingled same-variant stock across multiple RepairOrders — final policy

**Never auto-attributed.** If more than one `repair_order_line_id` holds a positive quantity at
the same `(location, variant)`, the safety-net trigger takes no action on
`repair_order_line_locations` for any plain movement touching that stock — and, per §1.6, marks
that `(location, variant)` UNKNOWN rather than leaving stale rows silently readable as current.
This is exactly the situation the PILOT-scope Zone 6 attribution-reference extension (§1.5) is
designed to prevent from recurring. RepairOrder-aware callers (receive/putaway RPCs) are
unaffected for the one line they explicitly write, since they always supply exact identity — but
per §1.6b, their write does **not**, by itself, clear a pre-existing marker on the bucket they
touch, since it can't vouch for _other_ stock that may still be there.

**Ambiguous transfer-shaped movements (`801`) make BOTH ends uncertain, not just the source.**
If an `801` moves quantity out of an ambiguous source `(A, X)`, the arriving quantity at the
destination `(B, X)` is _also_ of unknown provenance — we don't know whether any RepairOrder's
stock (and how much) was among the units that moved. The trigger therefore marks **both** `(A,
X)` and `(B, X)` UNKNOWN on an ambiguous transfer, unconditionally, regardless of whether `B`
previously had any attribution rows at all. It does not attempt to reason about which end is
"more" uncertain — both are, symmetrically.

## 3. Ordinary/unattributed stock mixed with RepairOrder stock — final policy

Same rule as §2, same mechanism, same §1.6 marking: if the pre-effect attributed sum at
`(location,variant)` is less than the reconstructed pre-effect on-hand there (i.e., some stock
is unattributed), the trigger treats **any** decrease at that location/variant as ambiguous,
takes no action on the projection rows, and marks that `(location, variant)` UNKNOWN. It does
not assume the decrease came from the unattributed portion, and does not assume it came from the
attributed portion. Guessing either way would be exactly the kind of fabrication being corrected
here.

## 4. Generic Zone 6 `801` — does it need attribution-aware input?

**Not for pitch.** For PILOT, yes, in the narrow, evaluated form of §1.5 (an optional, inert,
per-line attribution-reference field, prompted only when ambiguous) — this is the smallest
correct boundary found, preferred over silently guessing (rejected) and over an unenforceable
"must always use a RepairOrder-aware path" rule (rejected). Not implemented in this pass.

## 5. `402` adjustment — final behavior

Governed by the exact same single rule as §2/§3 — no special-cased logic for `402` specifically.
A `402` decrease at a location where RepairOrder-attributed and ordinary stock coexist (the
review's own example: RO-attributed 5, ordinary 10, adjustment −3) is **ambiguous by the same
test** (pre-effect attributed sum ≠ pre-effect on-hand) and the trigger does nothing to
`repair_order_line_locations`, instead marking that `(location, variant)` UNKNOWN per §1.6. The
adjustment still posts normally through the unmodified generic engine (stock still correctly
decreases in `inventory_balances`) — only the RepairOrder-attribution _projection_ is left
unchanged (and flagged non-authoritative), honestly reflecting that no evidence exists to say
whose stock was corrected.

**Only the source is marked** — `402` (like any pure decrease/issue-shaped movement) has no
paired destination location at all, so there is no second bucket to mark. This is the explicit
difference from §2's transfer case: a pure decrease's uncertainty is single-ended by
construction, not by choice. A future ambiguous _pure increase_ (a standalone credit with no
paired decrease — the shape a future reversal might take, per §8) is deliberately **not**
designed here; that behavior depends on a contract that does not exist yet and is not guessed.

## 6. Concurrency / locking — final design

Two layers, one already free:

1. **Already provided by the unmodified generic engine**: `inventory_finalize_posting` calls
   `inventory_get_or_create_balance` / `inventory_v1_get_or_create_balance`, which locks the
   `inventory_balances` row for `(organization_id, branch_id, location_id, variant_id)` `FOR
UPDATE` before applying any effect. Two concurrent movements touching the _same_
   `(org,branch,location,variant)` are therefore **already serialized** by the engine itself,
   before either one's ledger insert (and therefore before either trigger firing) can proceed —
   this is not a new guarantee Zone 5 has to build, it's inherited for free from the existing
   posting path.
2. **Added, defense-in-depth, matching this repo's own idiom**: inside the safety-net trigger,
   before reading `repair_order_line_locations` rows for the ambiguity check and (if
   unambiguous) decrementing/crediting them, the trigger issues `SELECT ... FOR UPDATE` on the
   specific row(s) at that `(location, variant)`. This mirrors the same "row-lock before
   read-modify-write" pattern already used by `inventory_finalize_posting` itself and by both
   existing precedent RPCs (`materialize_repair_orders_from_session`,
   `approve_wdd_matcher_session`) — not a new locking strategy, the established one, applied
   here too. `CHECK (quantity >= 0)` remains a correctness backstop, not the concurrency
   mechanism — the review's objection that it's insufficient alone is accepted and corrected.

Both orchestration RPCs (receive/putaway) also lock the specific `repair_order_line_locations`
row(s) they're about to write, `FOR UPDATE`, before their own explicit writes, for the same
reason.

### 6.1 Test-design honesty for concurrency

This repo already has an established, explicitly-honest convention for exactly this limitation
(found verbatim in `supabase/tests/091_repair_orders_materialization_rpc_test.sql`): **"true
two-connection concurrent-call testing cannot be expressed in a single pgTAP script."** That
file proves (a) the row lock exists in the function body via structural inspection and (b)
sequential idempotent replay produces correct, non-duplicated results — and explicitly defers
genuine simultaneous-execution proof to a separate live-DB integration test phase. This plan
adopts the identical convention, not a new one:

- **pgTAP** (Phase 3/6 tests): prove the `FOR UPDATE` statement is present in the trigger and
  both RPC bodies (structural/text assertion), and prove sequential replay (call twice in a row,
  or interleave two logical operations within one script's serial execution) produces correct,
  non-duplicated, non-negative results.
- **Explicitly out of pgTAP's reach, deferred to a live-DB integration test** (not written in
  this pass — same status as Zone 3's own "Phase 15" deferral): two genuinely separate database
  sessions (e.g. two `pg`/Supabase service-role connections in a Node/Vitest integration test)
  opening overlapping transactions against the same `(org, branch, location, variant)`, with a
  deliberate delay to force interleaving, asserting: no double-consumption of the same
  attribution, no negative `quantity`, no lost destination credit, and a final projection state
  consistent with the sum of both operations. This is recorded as a required test, explicitly
  not claimed as already proven by pgTAP alone.

## 7. Ordering semantics — final

**Removed.** There is no FIFO, no `updated_at`-based ordering, and no heuristic ordering of any
kind left in the design — §1.3's single-attribution-source test either finds a unique answer or
finds none; there is nothing left to order. The review's specific objection (`updated_at` isn't
true receipt-age, since it changes on every modification) is moot because the mechanism it was
describing no longer exists.

## 8. Reversal — final classification

**UNKNOWN / REQUIRES CONTRACT VERIFICATION — not automatic.** No reversal RPC exists yet
anywhere in the engine (confirmed, unchanged finding). The safety-net trigger's current logic for
transfer-shaped movements (treat the decrease as authoritative, credit the paired destination,
skip the corresponding increase) assumes a reversal is represented as a _symmetric_ paired
decrease+increase within one movement, like `801` — but the review correctly notes a reversal of
an _issue_ could instead be a **standalone increase against the original source location**, with
no paired decrease at all in that same movement (it references `original_movement_id`, per
`inventory_movement_headers`' existing dormant reversal columns, rather than re-decreasing
anything). If that's the eventual shape, the trigger's current "skip increases when the line has
a source_location_id" rule would be silently wrong for it — it would ignore a reversal's
increase entirely, believing a paired decrease already handled it, when none exists.

**This plan does not guess that contract.** It records the explicit dependency: whoever designs
the engine-wide reversal RPC must define, and this trigger must then be updated to match,
exactly which of these (or another) shapes a reversal takes, before reversal can be said to
"restore spatial attribution correctly." Until then, reversal is out of scope and unclaimed.

## 9. Receipt provenance resolution — corrected contract

```
source_line_id (p_lines[i].source_line_id) IS NULL:
  → allowed; line is received as an ordinary, unattributed 101 line.

source_line_id IS NOT NULL, resolves to exactly one repair_order_line_id
(via wdd_matcher_lines → workshop_source_document_lines → repair_order_line_source_links
 → repair_order_lines):
  → attributed receipt; seed row written to repair_order_line_locations,
    relation_type='receipt' row written to repair_order_line_movement_links.

source_line_id IS NOT NULL, resolves to zero rows:
  → HARD ERROR. The whole call is rejected (not just that line silently dropped to
    unattributed) — a caller that supplied provenance and got nothing back has broken
    lineage, not "no lineage."

source_line_id IS NOT NULL, resolves to more than one candidate:
  → HARD ERROR, for the same reason — ambiguous provenance must never be silently resolved
    by picking one.
```

This replaces the prior revision's implicit "fall back to unattributed on any resolution
failure" behavior, which the review correctly identified as capable of silently hiding broken
lineage as if it were simply "no lineage."

## 10. Proven cardinality of the Matcher → RepairOrderLine chain

Checked directly against the tracked migration (not assumed):

- `repair_order_line_source_links.workshop_source_document_line_id` **has** a UNIQUE constraint
  (`repair_order_line_source_links_source_line_unique UNIQUE
(workshop_source_document_line_id)`) — confirmed. This hop (`workshop_source_document_line_id
→ repair_order_line_id`) is genuinely 1:0-or-1, enforced by the database.
- `workshop_source_document_lines.wdd_matcher_line_id` — confirmed, by direct read of
  `20260910061711_repair_orders_core_schema.sql:387,401` — carries **only** a plain FK
  (`REFERENCES public.wdd_matcher_lines(id) ON DELETE SET NULL`) and a **non-unique** index
  (`workshop_source_document_lines_matcher_line_idx`). **There is no UNIQUE constraint on this
  column.** The database does **not** prevent more than one `workshop_source_document_lines`
  row from referencing the same `wdd_matcher_line_id`.

**Conclusion: ambiguity at the first hop (`wdd_matcher_line_id →
workshop_source_document_lines`) is structurally possible, not merely assumed impossible.**
Whether Zone 3's materialization RPC happens to only ever create one such row per Matcher line
in practice is a behavioral property of that RPC's current logic, not a database guarantee — and
this plan does not rely on it being true. This is precisely why §9's "resolves to more than one
candidate → HARD ERROR" is a real, load-bearing check against a real, reachable condition, not
defensive boilerplate against something already impossible.

## 11. Final `repair_order_line_locations` schema and pair-integrity strategy

### 11.1 Corrected pair-integrity decision

The prior revision kept both `repair_order_id` and `repair_order_line_id` on the table with the
consistency between them enforced only by the RPC, and concluded a DB-level fix wasn't available
without touching Zone 3's `repair_order_lines` table. **That conclusion was overly conservative
and is corrected here.** `repair_order_lines` already has both `id` (PK) and `repair_order_id`
(FK column) — a composite `UNIQUE (id, repair_order_id)` constraint on those two
**already-existing** columns is trivial to add (exactly the same "PK is already unique, so a
superset composite is too" pattern already used for
`warehouse_locations_id_org_branch_unique`/`branches_id_organization_id_unique`) and requires
**no new column and no change to Zone 3's Tier-2 RLS design** — that design was specifically
about not duplicating `organization_id` onto child tables, not about avoiding composite
constraints on columns already present.

**Decision: Option B — keep both columns, add the composite FK.** This closes the exact gap the
review identified (DB proves the pair is real, not just the RPC) with a single, tiny, additive
constraint on a table Zone 3 already shipped, touching none of its columns or RLS policies.

### 11.2 Final schema

```sql
CREATE TABLE public.repair_order_line_locations (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id            UUID NOT NULL,
  repair_order_id      UUID NOT NULL,
  repair_order_line_id UUID NOT NULL,
  variant_id           UUID REFERENCES public.inventory_variants(id),
  location_id          UUID NOT NULL,
  quantity              NUMERIC NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT rol_locations_unique UNIQUE (repair_order_line_id, location_id),

  -- Layer 1a: location must genuinely belong to this row's own org/branch
  -- (reuses the already-existing warehouse_locations_id_org_branch_unique constraint).
  CONSTRAINT rol_locations_location_fk
    FOREIGN KEY (location_id, organization_id, branch_id)
    REFERENCES public.warehouse_locations (id, organization_id, branch_id),

  -- Layer 1b: repair_order_id must genuinely belong to this row's own org/branch
  -- (new composite-unique constraint on repair_orders, mirroring the same existing pattern).
  CONSTRAINT rol_locations_repair_order_fk
    FOREIGN KEY (repair_order_id, organization_id, branch_id)
    REFERENCES public.repair_orders (id, organization_id, branch_id),

  -- Layer 1c (NEW, corrects §11.1's prior gap): repair_order_line_id must genuinely belong to
  -- repair_order_id -- a new composite-unique constraint on repair_order_lines(id,
  -- repair_order_id), which requires no new column on that table.
  CONSTRAINT rol_locations_line_fk
    FOREIGN KEY (repair_order_line_id, repair_order_id)
    REFERENCES public.repair_order_lines (id, repair_order_id)
);

CREATE INDEX rol_locations_repair_order_idx ON public.repair_order_line_locations (repair_order_id) WHERE quantity > 0;
CREATE INDEX rol_locations_lookup_idx ON public.repair_order_line_locations (location_id, variant_id) WHERE quantity > 0;
```

Companion migration (additive, mirrors an existing pattern verbatim):

```sql
-- On repair_order_lines (Zone 3's table -- no new column, no RLS change):
ALTER TABLE public.repair_order_lines
  ADD CONSTRAINT repair_order_lines_id_repair_order_id_unique UNIQUE (id, repair_order_id);
```

All three composite FKs are now real, DB-enforced, immune to any RPC bug — closing the review's
"the DB does not currently enforce that the line belongs to that exact RepairOrder" objection
completely, not partially.

The uncertainty marker table (§1.6) is the one additional schema object introduced solely to
represent the KNOWN/UNKNOWN distinction — no other schema change exists for that purpose alone.

### 11.3 Putaway read-model DTO (final, with attribution status)

```ts
type RepairOrderStorageSuggestion = {
  locationId: string;
  locationCode: string | null;
  locationName: string;
  distinctRepairOrderLines: number;
  currentQuantity: number; // read directly from repair_order_line_locations
  variants: Array<{ variantId: string; sku: string; productName: string; quantity: number }>;
  containerSummary: null; // reserved shape for PILOT; no backing column in pitch
  attributionStatus: "known" | "unknown"; // NEW — 'unknown' when an active marker (§1.6)
  // exists for this (location, variant)
};
```

Query behavior (corrected, no self-heal): a `(location, variant)` with **any** active row in
`repair_order_location_attribution_uncertain` is treated as UNKNOWN purely on that row's
existence — the read model never re-runs §1.3's math test to decide whether to trust it anyway
(§1.6a/§1.6c). It is either **omitted** from the confident suggestion list entirely, or returned
with `attributionStatus: 'unknown'` in a visibly separate, clearly-labeled bucket the UI never
merges into `[Put here]`-eligible suggestions. Exactly which of these two (omit vs. separate bucket) is a UI-copy decision for Phase 5, not an
architecture one — either satisfies "never present UNKNOWN attribution as a confident suggestion."

## 12. Does the ledger trigger remain, change, or get rejected?

**Remains, but narrowed and demoted from "primary propagation mechanism" to "conservative safety
net."** It no longer performs any inference (§7). It only ever acts when the answer is
mathematically the only possible one (§1.3), skips entirely for calls from the two
RepairOrder-aware RPCs (§1.4's `SET LOCAL` flag), and is explicitly not claimed to keep the
projection correct for every possible movement — only for the unambiguous subset, with the
ambiguous subset's limitation stated plainly (§1.5) rather than hidden.

## 12.1 Bypass-flag security classification

The plan reuses a `SET LOCAL`-scoped custom GUC
(`ambra.repair_order_attribution_authoritative`) to let the two orchestration RPCs suppress the
safety-net trigger while they perform their own explicit writes — modeled directly on this
engine's own existing `ambra.inventory_movement_engine` flag (used by the immutability triggers
on `inventory_movement_headers`/`lines`). Its exact convention and security posture, verified
against how that existing flag is documented and used, not assumed:

- **Exact GUC name (new)**: `ambra.repair_order_attribution_authoritative`. Namespaced under
  `ambra.*`, matching the one existing precedent exactly.
- **Who can set it**: only the PL/pgSQL body of `receive_repair_order_stock` and
  `putaway_repair_order_stock`, via a literal, unconditional `SET LOCAL` statement inside their
  own function bodies. It is **not** a function parameter — no caller, of any privilege level,
  can pass a value that becomes this GUC's setting. `SET LOCAL` is also transaction-scoped: it
  cannot leak into, or be pre-set by, a separate client call before invoking the RPC.
- **Can an ordinary authenticated Data API (PostgREST) caller forge it?** No, and not because of
  a permission grant — because PostgREST's request surface (table CRUD + calling named,
  parameter-typed RPC functions) never exposes a raw `SET`/`SET LOCAL` statement to a client at
  all. A client cannot submit "run this arbitrary SQL" through PostgREST; it can only invoke a
  function with its declared parameters, and the flag is not one of them. (A hypothetical
  direct, privileged Postgres connection — not the Data API — is a different, pre-existing
  attack surface this flag does not change and is out of Zone 5's scope, same as it already is
  for the existing `ambra.inventory_movement_engine` flag.)
- **Is it a security boundary, or duplicate-work suppression?** **Duplicate-work suppression
  only — explicitly not authorization, and not relied upon as one.** All real authorization
  still comes from: RLS on `inventory_movement_headers`/`lines` (unchanged), the RPCs' own
  internal `has_branch_permission(...)` checks (§2.3/§4.2, unchanged by this correction), and the
  fact that `repair_order_line_locations` has **no client-writable RLS policy at all** —
  regardless of this flag's state, a plain client can never write to that table directly, only
  through the two `SECURITY DEFINER` RPCs or the trigger.
- **Worst-case blast radius if the flag were somehow set when it shouldn't be** (still assessed,
  even though the mechanism above makes it unreachable via the Data API): the safety-net trigger
  simply skips its own conservative propagation for that one ledger insert. **Stated precisely,
  per the final correction: this is a correctness problem, not a security one, and the two must
  not be conflated.** An improperly-set flag could cause attribution staleness (a row that should
  have been auto-propagated, or marked UNKNOWN, stays as it was) — that is a real defect class,
  already the same category of limitation §1.6 discloses for the ordinary ambiguous case, and it
  is taken seriously as such. What it does **not**, by itself, cause — under any circumstance,
  forged flag or not — is unauthorized inventory access, cross-org/cross-branch access, or an RLS
  bypass: those are independently enforced by RLS on every underlying table, by the RPCs' own
  `has_branch_permission` checks, and by `repair_order_line_locations` (and the uncertainty
  table) having no client-writable policy regardless of this flag's state. Security is not
  resting on this flag in any part; only propagation timeliness is.

## 13. Final trigger algorithm (pseudocode, corrected for no-self-heal + both-ends marking)

```
FUNCTION repair_order_location_attribution_sync() RETURNS trigger AS $$
BEGIN
  -- 1.3a: physical stock only
  IF NEW.balance_field IS DISTINCT FROM 'on_hand' THEN
    RETURN NULL;
  END IF;

  -- 1.6b rule 1: the ONE automatic clearing path -- zero stock trivially means zero
  -- ambiguity. Runs unconditionally, even under the bypass flag below, since it is a
  -- statement about physical reality (nothing left), not a re-trust of prior math.
  IF NEW.balance_after = 0 THEN
    DELETE FROM repair_order_location_attribution_uncertain
      WHERE organization_id = NEW.organization_id AND branch_id = NEW.branch_id
        AND location_id = NEW.location_id AND variant_id = NEW.variant_id;
  END IF;

  -- Duplicate-work suppression (12.1) -- RepairOrder-aware RPCs already wrote their own
  -- explicit truth for the one line they touched; they do NOT get to clear a bucket-wide
  -- marker just by writing (1.6b), so nothing further is needed here besides skipping.
  IF current_setting('ambra.repair_order_attribution_authoritative', true) = 'on' THEN
    RETURN NULL;
  END IF;

  -- 1.3b: fast no-op path -- nothing attributed AND nothing already flagged uncertain here.
  IF NOT EXISTS (
    SELECT 1 FROM repair_order_line_locations
    WHERE organization_id = NEW.organization_id AND branch_id = NEW.branch_id
      AND location_id = NEW.location_id AND variant_id = NEW.variant_id
  ) AND NOT EXISTS (
    SELECT 1 FROM repair_order_location_attribution_uncertain
    WHERE organization_id = NEW.organization_id AND branch_id = NEW.branch_id
      AND location_id = NEW.location_id AND variant_id = NEW.variant_id
  ) THEN
    RETURN NULL;
  END IF;

  -- Only decreases are ever actionable; increases are either paired-and-already-handled,
  -- or pure receipts the receiving RPC handles explicitly (1.3 table).
  IF NEW.direction <> 'decrease' THEN
    RETURN NULL;
  END IF;

  -- Look up the movement line once, needed on both the marker-gate and the math branch.
  SELECT destination_location_id INTO v_dest FROM inventory_movement_lines WHERE id = NEW.movement_line_id;

  -- 1.6a: the marker GATES further reasoning -- it is never bypassed by a later math check
  -- that happens to look unambiguous. Once uncertain, always uncertain, until 1.6b clears it.
  IF EXISTS (
    SELECT 1 FROM repair_order_location_attribution_uncertain
    WHERE organization_id = NEW.organization_id AND branch_id = NEW.branch_id
      AND location_id = NEW.location_id AND variant_id = NEW.variant_id
  ) THEN
    -- Re-affirm at source (idempotent) and extend to destination if transfer-shaped --
    -- stock of already-unknown provenance is now moving further, spreading the uncertainty.
    INSERT INTO repair_order_location_attribution_uncertain (organization_id, branch_id, location_id, variant_id)
      VALUES (NEW.organization_id, NEW.branch_id, NEW.location_id, NEW.variant_id)
      ON CONFLICT DO NOTHING;
    IF v_dest IS NOT NULL THEN
      INSERT INTO repair_order_location_attribution_uncertain (organization_id, branch_id, location_id, variant_id)
        VALUES (NEW.organization_id, NEW.branch_id, v_dest, NEW.variant_id)
        ON CONFLICT DO NOTHING;
    END IF;
    RETURN NULL;
  END IF;

  -- No pre-existing marker: safe to attempt the math test, fresh, for this movement only.
  -- 1.3: reconstruct pre-effect on-hand from the ledger row itself, never re-query balances.
  pre_effect_on_hand := NEW.balance_after + NEW.quantity;

  SELECT sum(quantity), count(DISTINCT repair_order_line_id)
    INTO attributed_sum, distinct_lines
    FROM repair_order_line_locations
    WHERE organization_id = NEW.organization_id AND branch_id = NEW.branch_id
      AND location_id = NEW.location_id AND variant_id = NEW.variant_id
    FOR UPDATE;                                              -- §6 concurrency

  IF attributed_sum IS DISTINCT FROM pre_effect_on_hand OR distinct_lines <> 1 THEN
    -- Ambiguous: never guess. Mark BOTH ends UNKNOWN (§2/§5), leave existing rows untouched.
    INSERT INTO repair_order_location_attribution_uncertain (organization_id, branch_id, location_id, variant_id)
      VALUES (NEW.organization_id, NEW.branch_id, NEW.location_id, NEW.variant_id)
      ON CONFLICT DO NOTHING;
    IF v_dest IS NOT NULL THEN
      -- Transfer-shaped (801): destination is uncertain too, unconditionally, even if it
      -- had zero prior attribution rows of its own.
      INSERT INTO repair_order_location_attribution_uncertain (organization_id, branch_id, location_id, variant_id)
        VALUES (NEW.organization_id, NEW.branch_id, v_dest, NEW.variant_id)
        ON CONFLICT DO NOTHING;
    END IF;
    -- v_dest IS NULL (pure decrease, e.g. 402/future issue): source only -- no second bucket.
    RETURN NULL;
  END IF;

  -- Unambiguous: exactly one repair_order_line_id accounts for 100% of pre-effect on-hand.
  SELECT repair_order_line_id, repair_order_id INTO v_line_id, v_ro_id
    FROM repair_order_line_locations
    WHERE organization_id = NEW.organization_id AND branch_id = NEW.branch_id
      AND location_id = NEW.location_id AND variant_id = NEW.variant_id;

  UPDATE repair_order_line_locations
    SET quantity = quantity - NEW.quantity, updated_at = now()
    WHERE repair_order_line_id = v_line_id AND location_id = NEW.location_id;

  IF v_dest IS NOT NULL THEN
    INSERT INTO repair_order_line_locations
      (organization_id, branch_id, repair_order_id, repair_order_line_id, variant_id, location_id, quantity)
    VALUES (NEW.organization_id, NEW.branch_id, v_ro_id, v_line_id, NEW.variant_id, v_dest, NEW.quantity)
    ON CONFLICT (repair_order_line_id, location_id)
    DO UPDATE SET quantity = repair_order_line_locations.quantity + NEW.quantity, updated_at = now();
  END IF;
  -- v_dest IS NULL: pure decrease (issue/402-shaped) -- credited nowhere, by design.

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## 14. Exact pitch implementation phases (revised)

**PHASE 0 — Fresh verification (PITCH, gate)** — unchanged.

**PHASE 1 — Receiving-location schema** — unchanged.

**PHASE 2 — `repair_order_line_locations` + uncertainty marker + full pair/org/branch integrity**
Now includes all three composite FKs (§11.2), the new
`repair_order_lines_id_repair_order_id_unique` constraint, **and** the new
`repair_order_location_attribution_uncertain` table (§1.6) in the same phase, since the trigger
built in Phase 3 depends on both existing first.
Tests: RLS isolation; all three composite-FK rejections (location from wrong branch;
RepairOrder from wrong org/branch; `repair_order_line_id` that doesn't belong to the claimed
`repair_order_id`); UPSERT/decrement never negative; uncertainty-marker table has no
client-writable RLS policy.

**PHASE 3 — Safety-net trigger (revised scope, corrected timing + no-self-heal + both-ends + guard)**
Objective: the corrected trigger (§13's pseudocode) — `balance_field='on_hand'` guard first
(§1.3a); the zero-clears-marker rule (§1.6b rule 1), unconditional and first; pre-effect balance
reconstructed **from the ledger row's own `balance_after`/`quantity`/`direction`, never
re-queried from `inventory_balances`** (§1.3); the `ambra.repair_order_attribution_authoritative`
`SET LOCAL` bypass check (§12.1); a **marker-gate that runs before the math test and is never
bypassed by it** (§1.6a) — once a bucket is marked, the trigger re-affirms/extends the marker
rather than re-attempting the math; **both-ends marking** on a newly-detected ambiguous transfer
(§2); row locking (§6).
Tests, all pgTAP, against synthetic ledger rows, before either orchestration RPC exists:

- `balance_field <> 'on_hand'` (e.g. a synthetic `'reserved'` effect) → no-op, verified the
  projection and the uncertainty table are both untouched.
- Single attribution source, fully covers reconstructed pre-effect on-hand → propagates
  correctly (transfer-shaped: source decrements, destination credits the same
  `repair_order_line_id`; pure-decrease-shaped: source decrements, credits nowhere).
- **Timing-correctness proof, specifically**: a decrease where `NEW.balance_after` is already
  post-effect (e.g. on-hand goes 5→3 for a decrease of 2, projection still correctly says 5) is
  correctly recognized as unambiguous and propagates — proving the fix, not just asserting it.
- **Ambiguous transfer marks BOTH ends**: two attribution sources at source `(A, X)` → a plain
  `801` `A → B` takes no action on `repair_order_line_locations` at either end, **and** inserts
  uncertainty-marker rows for **both** `(A, X)` and `(B, X)` — including the case where `B` had
  zero prior attribution rows of its own.
- **Ambiguous pure decrease marks only the source**: the same commingled setup with a `402`
  (no destination) marks only `(A, X)`, never a second bucket.
- One attribution source + unattributed stock coexisting → no projection change, source marked
  (and destination too, if transfer-shaped).
- No attribution and no existing marker at the location/variant → no-op, cheap (fast-path).
- `SET LOCAL ambra.repair_order_attribution_authoritative = 'on'` suppresses the trigger even in
  the otherwise-unambiguous case (proves the flag works, proves no double-application with the
  RPCs' own writes) — and still allows the zero-clears rule to run (proves the two are
  independent).
- **No-self-heal proof (the specific defect this pass fixes)**: mark `(A, X)` UNKNOWN via one
  ambiguous movement, then post a _second_, independently-unambiguous-looking movement at
  `(A, X)` (attributed sum now happens to equal pre-effect on-hand for a single line) — assert
  the trigger does **not** propagate it and does **not** clear the marker; it only re-affirms the
  marker. This is the load-bearing test for the whole correction; a passing test here is what
  makes the "sticky until authoritative clearing" claim provable, not just asserted.
- **Zero clears the marker**: with `(A, X)` marked UNKNOWN, a movement that brings `on_hand` at
  `(A, X)` to exactly zero clears the marker — verified as the _only_ automatic clearing path,
  and verified it clears even while the bypass flag is set (independent of the RPC-vs-trigger
  distinction).
- **A single RepairOrder-aware write does not clear a bucket-wide marker**: with `(A, X)` marked
  UNKNOWN (from commingled RO1+RO2+ordinary stock), a `putaway_repair_order_stock` call moving
  only RO1's known line out of `A` does **not** clear the marker for `(A, X)` — it correctly
  leaves it marked, since RO2/ordinary stock there remains unaccounted for.
- Concurrency: see §6.1 — pgTAP proves the `FOR UPDATE` lock statement is present and proves
  correct sequential replay; genuine two-session concurrency is a separate, explicitly deferred
  live-DB integration test (not written in this phase).

**PHASE 4 — `receive_repair_order_stock` RPC + wiring**
Objective: §9's corrected contract (hard errors on zero/ambiguous resolution, §10's proven
cardinality risk as the reason the check is load-bearing); sets the authoritative flag; writes
the seed `repair_order_line_locations` row and the `repair_order_line_movement_links` row
directly, itself, `FOR UPDATE`-locked.
Tests: the three resolution outcomes from §9 (null → unattributed; unique → attributed; zero or
multiple → hard error, tested as two distinct cases); atomicity; org/branch/variant
cross-validation (unchanged from before).

**PHASE 5 — Putaway read model + suggestion UI**
Objective: §11.3's DTO, including the new `attributionStatus: 'known' | 'unknown'` field.
Suggestions are sourced from `repair_order_line_locations`, now only ever populated by
provably-correct writes (explicit-RPC, or provably-unambiguous trigger propagation with correct
pre-effect timing) — strictly more trustworthy than the removed FIFO design. The query must
join against `repair_order_location_attribution_uncertain` and exclude (or clearly separate)
any `(location,variant)` currently marked uncertain — this is new work versus the prior
revision, not a no-op UI carry-forward.
Tests: suggestion list correctly omits/separates an UNKNOWN-marked location; suggestion list
shows a KNOWN location normally; empty state.

**PHASE 6 — `putaway_repair_order_stock` RPC + wiring**
Objective: batch contract unchanged from the prior revision; now also sets the authoritative
flag and writes `repair_order_line_locations` directly (reverted from "let the trigger do it").
Tests: the full worked example, with the second hop (`801 2 A→B`) posted as a **plain,
unmodified `801`, relying on the safety-net trigger's unambiguous-case propagation** (the demo
data is single-RepairOrder-clean at that location by construction, so this is the provably-safe
case, not a lucky FIFO guess); batch (one call, multiple lines, one destination, one document);
atomicity; row-lock proof.

**PHASE 7 — Presentation UAT** — unchanged, plus: rehearsal explicitly avoids creating
commingled attribution at any location the script touches, and the presenter is briefed on the
§1.5 limitation as a known, disclosed boundary, not something to claim works universally.

## 15. Remaining product decisions

- Whether to schedule the §1.5 Zone 6 attribution-reference extension for early PILOT (it is now
  a well-scoped, evaluated design, not an open question) — a prioritization call, not an
  architecture one.
- `purpose` value copy/labels (unchanged, cosmetic).
- Putaway UI entry-point placement (unchanged open item, depends on Zone 3's actual RepairOrder
  Workshop UI).
- Whether the presenter should explicitly narrate the "generic relocation of commingled stock is
  a known limitation" point during the pitch, or only be prepared to answer if asked — a
  presentation-script choice.

## 16. Unchanged from prior revisions (explicit list, per instruction not to relitigate)

- `101` lands in the branch's `warehouse_locations.purpose = 'receiving'` location.
- One receiving location per branch, enforced by a partial unique index.
- `801` remains the only relocation primitive; no new movement type.
- `repair_order_line_movement_links.relation_type` stays `receipt | issue | reversal` — no
  `'putaway'` value, ever.
- `repair_order_line_movement_links` remains the business-quantity ledger only.
- `container_id` stays out of the pitch-scope projection table.
- Putaway is batch: one call, one destination, one `801` document, multiple lines.
- Matcher provenance resolution is server-authoritative (now additionally hard-erroring on
  broken/ambiguous provenance, §9).
- No fake capacity model of any kind.
- Containers remain PILOT UI scope; the backend (`relocateContainerAction`,
  `findContainersByReferenceAction`) remains documented as more ready than initially assumed,
  unused in pitch.
