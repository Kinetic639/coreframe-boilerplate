# IC-6A Review Context

**Phase**: IC-6A — Opening Stock Active-Path Repair (narrow pre-IC-7
correctness pass). IC-0 through IC-6 and IC-7A remain ACCEPTED/FINAL,
not reopened. Full IC-7, IC-8, and Phase 10D are explicitly NOT started.

## 0. Starting-state discrepancy (disclosed, not silently handled)

Two discrepancies were found and are disclosed here rather than
silently resolved or ignored:

1. **IC-6 is still not committed.** HEAD remains at
   `daeba1132b05295bb3a8221f6d218e77bfb36487`, a pre-existing commit
   labeled "ic6" that (per IC-6's own review bundle) actually contains
   only IC-4/IC-5 work. IC-6's real changes (4 migrations, 1 TS
   deletion, 1 new pgTAP file, 3 doc updates, the `ic-6-review/`
   bundle) remain uncommitted in the working tree, exactly as left at
   the end of that phase, per the standing "never commit without
   explicit instruction" policy. IC-6A was built directly on top of
   this uncommitted-but-content-complete state, matching what "IC-0
   through IC-6 are ACCEPTED and FINAL" means in practice for this
   session. Nothing was committed by this pass either.
2. **The git index was found unexpectedly staged** at the start of
   this pass (all of IC-6's own files showing as staged, not just
   present) even though the IC-6 pass had explicitly run `git restore
--staged .` twice at its own close. `git log`/`git reflog` confirmed
   HEAD never moved and no commit was created — only the index state
   changed, most likely a side effect of one of the background
   regression agents (which run with full tool access as general-
   purpose agents) invoking `git add` while investigating, without
   being asked to. No data was at risk (staging is reversible and
   non-destructive), but this is flagged explicitly since an agent
   silently changing repository state without being asked is worth
   surfacing. Corrected via `git restore --staged .` before any IC-6A
   work began; no commit occurred at any point.

## 1. Bug reconfirmed?

Yes, independently, from scratch. `InventoryProductsService.
createOpeningStockMovement` (private method) is called from
`createEnhancedProduct` whenever `input.track_inventory &&
input.branch_id && input.opening_location_id`, for every variant with
`opening_quantity > 0`. It called `.rpc("inventory_create_draft_
movement", ...)` then `.rpc("inventory_post_movement", ...)`. A fresh
live `pg_proc` query for both exact names returned zero rows — neither
exists under any signature. `createEnhancedProduct` is reachable from
a real, active server action (`createEnhancedInventoryProductAction` in
`src/app/actions/warehouse/inventory/index.ts`).

## 2. Exact active call chain

`createEnhancedInventoryProductAction` (action, requires
`WAREHOUSE_PRODUCTS_MANAGE`, plus `WAREHOUSE_INVENTORY_OPERATE` when
opening stock is involved) → `InventoryProductsService.
createEnhancedProduct` (service) → [product/variants created via
`inventory_create_enhanced_product`] → if
`track_inventory && branch_id && opening_location_id`:
`InventoryProductsService.createOpeningStockMovement` (private helper)
→ **[FIXED]** `inventory_create_and_finalize` (canonical RPC, movement
type `401`).

## 3. Old missing RPC names confirmed absent

Yes. Live `pg_proc` query for `inventory_create_draft_movement` and
`inventory_post_movement`: zero rows for both, confirmed twice (once
during IC-6's own audit, once independently at the start of this
pass). Post-fix, a repo-wide grep confirms zero ACTIVE code references
to either name anywhere in `src/` — the only remaining hits are (a)
historical-migration-text regression tests asserting on ALREADY-
APPLIED migration files' own SQL content (not active callers, left
untouched per the immutable-history convention) and (b) one stale doc
comment (confirmed harmless — the function it describes,
`inventory_approve_count_session`, does not call the dead names
internally; the comment itself is simply outdated prose, disclosed but
not edited since it's outside this pass's own narrow scope).

## 4. Final canonical RPC chosen

`inventory_create_and_finalize(p_organization_id, p_branch_id,
p_movement_type_code, p_lines, p_operation_date, p_document_date,
p_counterparty_name, p_external_reference, p_note, p_idempotency_key,
p_actor_user_id)` — Option A from the task's own preferred-options
list ("if opening stock is simply a generic catalog-defined stock
increase").

## 5. Why that RPC is semantically correct for opening stock

Opening stock is exactly "a real initial physical inventory increase
for the newly-created variant at the selected branch/location," with
no counterparty and no source location — a single atomic operation is
both sufficient and strictly smaller/safer than the old two-call
draft-then-post pattern (a network failure between the two old calls
could leave an orphaned draft; a single RPC call cannot). Read in full:
`inventory_create_and_finalize` performs actor-identity verification
(`p_actor_user_id IS DISTINCT FROM auth.uid()` → `28000`) and a
branch-scoped permission check (`warehouse.inventory.operate` OR
`warehouse.inventory.adjust` → `42501`) BEFORE calling `inventory_
create_draft` then `inventory_finalize_posting` internally — the exact
same IC-7A-hardened entry point every other manual movement in the
system uses. Not `inventory_receive_stock` (Option B) — its own
receiving semantics (PO/supplier receipt) don't match a catalog-
initiated opening balance. Not the raw `inventory_create_draft` +
`inventory_finalize_posting` two-call form (Option C) — opening stock
needs no intermediate draft-review stage.

## 6. Final movement type/code

`401` — "Inventory Count Adjustment (Increase)". Live movement-type
catalog query confirmed this is the ONLY seeded, active,
`allows_manual_entry = true` type whose own location requirements
(`requires_destination_location = true`, `requires_source_location =
false`) match opening stock's destination-only shape. No dedicated
"opening balance" type exists in the catalog (confirmed via a
dedicated live query for `name_en ILIKE '%opening%'` — zero rows,
active or soft-deleted). Not `101` (receipt — reserved for goods
received from a PO/supplier, not a catalog-initiated balance). No new
type was seeded, per the task's own explicit "do not seed a new type
unless no existing type semantically fits" instruction.

## 7. Final actor/permission behavior

Unchanged/already-correct, confirmed by reading the action layer:
`createEnhancedInventoryProductAction` already required
`WAREHOUSE_INVENTORY_OPERATE` (`= "warehouse.inventory.operate"`,
confirmed via a real existing test assertion in `rls-permission-
invariants.test.ts`) whenever opening-stock fields are set — an EXACT
match to one of the two permissions the canonical RPC itself checks.
This means the "product creation succeeds but opening stock fails for
a permission reason" scenario the task asked about is already
impossible: the action layer blocks the ENTIRE operation (before any
product/variant row is created) if the user lacks that permission and
attempted to set opening stock. No new permission check was added; the
existing gate was verified correct and left unchanged. The canonical
RPC's own actor-identity check means the real, current
`auth.uid()`-backed user id is always the actor — no spoofing surface
exists (verified live, see item 17 below).

## 8. opening_quantity=0 result

No movement RPC call at all — the `lines` filter
(`opening_quantity != null && Number(opening_quantity) > 0`) excludes
zero/null-quantity variants before the RPC is ever invoked; if ALL
variants have zero/null opening quantity, `lines.length === 0` short-
circuits to `{success: true, data: {movement_id: null}}`. Proven by
Vitest Scenario A.

## 9. opening_quantity>0 result

`inventory_create_and_finalize` is called once with a `p_lines` array
containing one entry per nonzero-quantity variant, correct
`p_organization_id`/`p_branch_id`/`p_actor_user_id`/`p_movement_type_
code = '401'`/`p_external_reference = productId`. Proven by Vitest
Scenario B (mocked shape) and pgTAP `109_...` Scenarios B–E (live,
real DB effects).

## 10. Multi-variant result

Each variant's own opening quantity is posted as an independent line
entry in the SAME single RPC call, each carrying its own correct
`variant_id`/`quantity` — proven not to cross-contaminate even when
variants are filtered (a zero-quantity variant earlier in the array
does not shift a later variant's own id) — proven by Vitest Scenarios
D and E.

## 11. Retry/idempotency result

Proven live (not just asserted): pgTAP `109_...` Scenario F calls the
IDENTICAL request (same `p_idempotency_key = 'product-opening-stock-'
|| productId`) a second time — `status` returns `'posted'` again (not
an error), `on_hand_quantity` remains EXACTLY 5 (not 10), the
movement-header count and ledger-entry count both remain unchanged
from the first call. Root cause read directly from both function
bodies: `inventory_create_draft`'s own idempotency lookup (keyed on
`organization_id + idempotency_key`) short-circuits to the EXISTING
header on a retry; `inventory_finalize_posting_internal` independently
guards against re-posting (`IF v_header.status = 'posted' THEN RETURN
... END IF`, before any balance/ledger effect is applied) — so even if
the draft-lookup path were ever bypassed, the finalize step alone would
still prevent double-application. Idempotency key strategy unchanged
from the old code (`product-opening-stock-${productId}`, one key per
product covering all its variants' lines in one movement) — this was
already the correct, deterministic design; not modified.

## 12. Error-path result

A canonical-RPC error (e.g., a permission or invariant rejection)
propagates as a truthful `{success: false, error: <message>}` — no
error is swallowed or misrepresented — AND triggers the EXISTING
compensating cleanup (`cleanupFailedEnhancedProductCreate`, archives
the just-created product/variants), exactly as it did before this fix,
since that call site and control flow in `createEnhancedProduct` were
not touched. Proven by Vitest Scenario C.

## 13. Live balance result

Proven live via pgTAP `109_...`: before, no balance row exists (`on_
hand` implicitly 0); after, `on_hand_quantity = 5` exactly (Scenarios A
and B/D).

## 14. Movement/ledger/audit result

Proven live: exactly one new `inventory_movement_headers` row
(`movement_type_code = '401'`, real generated `document_number`,
`external_reference = productId`, `posted_by` = the real actor);
exactly one new `inventory_stock_ledger_entries` row (`direction =
'increase'`, `quantity = 5`); exactly one `inventory_movement_audit_
log` row with `action = 'posted'` and the real actor's user id
(Scenarios C, D, E).

## 15. Anon rejection result

Confirmed via the re-run of `105_ic7a_movement_engine_security_
boundary_test.sql` (29/29, unchanged) — Scenario K proves `anon` has
zero EXECUTE on `inventory_create_and_finalize` (and its constituent
`inventory_create_draft`/`inventory_finalize_posting`) at all,
SQLSTATE `42501`. This is movement-type-agnostic (the EXECUTE grant is
checked by Postgres before the function body — including the `p_
movement_type_code` parameter — ever runs), so 105's own existing
proof against type `101` covers type `401` identically; not
duplicated in the new `109_...` file.

## 16. No-permission rejection result

Same re-run, Scenario L — an authenticated actor holding zero inventory
permission is rejected by both `inventory_create_draft` and `inventory_
create_and_finalize`, SQLSTATE `42501`, BEFORE movement-type validation
runs (confirmed by reading the function body: the permission check
precedes the `p_movement_type_code` lookup). Movement-type-agnostic for
the same reason as item 15.

## 17. Actor-spoof rejection result

Same re-run, Scenario O — a real, permissioned actor attempting to post
as a DIFFERENT user id is rejected by both `inventory_create_draft` and
`inventory_create_and_finalize`, SQLSTATE `28000`
(`p_actor_user_id IS DISTINCT FROM auth.uid()`), which runs as the
FIRST check in the function body, before movement-type validation.
Movement-type-agnostic for the same reason as items 15–16.

## 18. IC-7A regression result

`105_ic7a_movement_engine_security_boundary_test.sql`: **29/29, 0
failures**, re-run in full as part of the closing regression (see
test-evidence.md) — confirms the exact hardened entry point the IC-6A
fix now calls remains fully closed to anon/no-permission/spoofed-actor
callers, and that every legitimate authenticated flow (including
`inventory_create_and_finalize` itself, exercised by the original P0
exploit-replay Scenario Q) still succeeds unchanged.

## 19. Relevant pgTAP result

Full 097–108 regression re-run: **402/402 assertions, 0 failures, 12/12
files PASS** — confirms zero regression from this TS-only change (the
SQL/database layer was never touched — no migration exists for IC-6A).
New `109_ic6a_opening_stock_repair_test.sql`: **16/16, 0 failures**,
independently verified live. Combined IC-6A-relevant total: **418/418,
0 failures**.

## 20. Vitest result

Full suite: **4456 passed / 32 failed / 8 skipped / 9 todo (4505
total)** — the 32 failures are the SAME pre-existing, unrelated
failures already confirmed baseline-noise during IC-6 (auth/
invitations/sidebar/QR-label rendering/org RLS — zero overlap with
`inventory-products.service.ts` or its test file); the +5 tests over
IC-6's own 4500-test baseline are exactly this pass's own 5 new
opening-stock scenarios (A–E), all passing. Focused re-run of
`inventory-products.service.test.ts` alone: **15/15, 0 failures**.

## 21. Typecheck/lint/build

`pnpm type-check`: 0 errors. `pnpm lint`: 0 errors, 319 pre-existing
warnings (unchanged baseline). `pnpm build`: succeeded cleanly
(required and run — this pass changes real application/service
TypeScript).

## 22. Whether any migration was required

No. The correct current canonical capability (`inventory_create_and_
finalize`, movement type `401`, with a supported `p_lines` shape and a
supported `p_external_reference` substitute for the old `reference_
type`/`reference_id` concept) already existed live in full — confirmed
via direct `pg_get_functiondef` reads before writing any code, per §14's
own explicit instruction. No migration was created merely to make old
application code compile.

## 23. Files changed

2 TypeScript files modified (`inventory-products.service.ts`, its own
test file), 1 new pgTAP file. See `changed-files.md`.

## 24. Bundle path/counts

`docs/inventory/reviews/ic-6a-opening-stock-repair-review/` — 4 files
(`diff.patch`, `changed-files.md`, `review-context.md`,
`test-evidence.md`; no `migration-summary.md`, since no migration
occurred, per the task's own explicit instruction).

## 25. From-scratch reproducibility — remains OPEN, assigned to IC-8

IC-6 confirmed local from-scratch migration replay is BROKEN (7
historical live Zone-5 migrations were never locally mirrored). This
was explicitly NOT touched in IC-6A (§16 of this pass's own task text:
"Do not solve that in IC-6A"). It is hereby reconfirmed still OPEN and
is assigned as a HARD GATE to **IC-8 final hardening / reproducibility
closure** — `docs/inventory/inventory-core-implementation-plan.md`'s
own existing IC-8 section is the appropriate, already-present home for
this (no more specific dedicated gate exists in the current plan); IC-8
must not be marked FINAL while a clean database cannot be constructed
from repository migrations alone. See `inventory-core-progress.md`'s
own updated language for the exact wording added.

## 26–28. Full IC-7 / IC-8 / Phase 10D status

All three confirmed NOT STARTED. IC-6A touched only one private
TypeScript method, its own test file, and added one new pgTAP file —
no security-boundary work, no reproducibility work, no new module
work.

## 29. Whether IC-6A is FINAL

Yes. The bug is fixed at its one confirmed active call site, using the
current canonical engine exclusively (no direct writes, no resurrected
legacy RPCs, no bypass of IC-1/IC-7A), proven both by mock-level Vitest
and live pgTAP integration evidence, with zero regression across the
full existing suite.

## 30. Whether safe to proceed to full IC-7

Yes — with the from-scratch reproducibility gap (item 25) explicitly
carried forward as IC-8's own hard gate, and the two IC-6-discovered,
still-open findings (posted-header GUC bypass; `inventory_cancel_
movement`'s missing actor-check) remaining full IC-7's own tracked
scope, unchanged and undiminished by this pass.
