# WU (Normal Issue) and Legacy Stock Entry — Movement Contract Design

> **DESIGN DOCUMENT. Nothing in this document has been implemented.** No migrations were created or applied, no application code was changed, Supabase MCP was used strictly read-only throughout. This follows and builds directly on `docs/mvp/zones/07-normal-issue-movement-audit.md`.
>
> Evidence classification: **LIVE VERIFIED**, **REPO VERIFIED**, **HISTORICAL** (from `archive/web-legacy-snapshot/`, a superseded legacy system with a different table architecture — informative about intended conventions, not automatically binding on the current engine), **NEW CONVENTION** (proposed, no supporting evidence, requires product-owner sign-off).
>
> Date: 2026-09-10.
>
> **CORRECTION PASS (2026-09-10, same day):** three specific points corrected per product-owner review — (1) reservation accounting split into aggregate-balance vs. reservation-line vs. allocation-line levels, with the exact outstanding formula derived from live RPC bodies, not assumed; (2) allocation's pitch/pilot classification re-evaluated against the actual active pitch script (finding: the container/QR/layout workflow exists only in an explicitly-labeled _future-vision, not-current_ script — see Allocation Behavior below); (3) issue-above-reservation changed from a soft warning to a mandatory explicit override. Codes 201/105 and their category/doc-type/numbering are **unchanged and reconfirmed**, per instruction not to reopen them without new hard evidence (none was found that would invalidate them).

---

## Existing Movement Architecture

Unchanged from the prior audit — config-driven engine (`inventory_movement_types` + `inventory_movement_type_effects` + `inventory_document_types` + `inventory_document_sequences`), generic `inventory_create_draft`/`inventory_finalize_posting` RPCs, `inventory_movement_audit_log` + `inventory_stock_ledger_entries` for history. Not re-derived here; see the prior audit for the full trace.

**One new load-bearing finding this pass**: `inventory_movement_type_effects.balance_field` CHECK constraint (LIVE VERIFIED) already allows `'on_hand'`, `'reserved'`, `'allocated'`, `'blocked'`, `'consignment'` — the schema was **designed** to let a movement type declaratively affect the reservation balance, not just on-hand stock. However, `inventory_finalize_posting`'s current body (REPO/LIVE VERIFIED, exact source read this session) contains:

```sql
IF v_effect.balance_field = 'on_hand' THEN
  SELECT on_hand_quantity INTO v_current_qty FROM inventory_balances WHERE id = v_balance_id;
ELSE
  RAISE EXCEPTION 'v1 only supports on_hand balance field, got %', v_effect.balance_field;
END IF;
```

So the _engine_ only implements `on_hand` today — reservation-balance effects are a **designed but unbuilt extension point**, not a live capability. This directly shapes the WU reservation-consumption recommendation below: the cleanest fix is a small, **engine-wide** extension of this one branch (not a WU-specific bolt-on), because the schema already anticipated it.

`inventory_balances` (LIVE VERIFIED) already has the matching columns: `on_hand_quantity`, `reserved_quantity`, `allocated_quantity`, `available_quantity`, `blocked`, `consignment`.

**Category CHECK constraint** (LIVE VERIFIED, `mvt_types_category_check`) already allows: `receipt`, `issue`, `transfer`, `adjustment`, `reservation`, `quality`, `bin_operation`, `consignment`, `other`. **`issue` is already a valid category value with zero live movement type using it yet** — direct, strong evidence the engine was designed with a future issue-type movement in mind.

## Historical Numeric Convention (HISTORICAL evidence, `archive/web-legacy-snapshot/`)

The archived legacy system (a different table architecture — `movement_types`, not today's `inventory_movement_types`) documents a full SAP-style numbering scheme that the **current** target schema's live codes (101, 311, 401, 402) already partially and consistently instantiate (101 = receipt family start, 311 = transfer family, 401/402 = adjustment family — all match the archived family ranges exactly). This is strong indirect evidence the numbering _convention_ (not the old implementation) was intentionally carried forward into the rewritten engine.

Two entries in that historical catalog are **exact conceptual matches** for this task's two movements:

| Code    | Name (historical)                                 | Doc         | Stock effect    | Notes (historical)                                                                                                                                                                                                                   |
| ------- | ------------------------------------------------- | ----------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **105** | Initial Stock / _Stan początkowy_                 | `PZ-I`      | `+1` (increase) | "Opening stock / inventory start". Implementation-status doc: **Requires Approval: Yes** (manager-level), no reservation involvement.                                                                                                |
| **201** | Goods Issue (Sales) / _Wydanie towaru do klienta_ | `WZ`        | `-1` (decrease) | "Zmniejsza stan magazynu". Implementation-status doc: **Reservation: Yes** (always ties to a reservation), **Requires Approval: Optional**, **Movement Request: Yes** (starts as a request workflow).                                |
| 102/202 | Reversal pairs for 101/201                        | `PZ-`/`WZ-` | inverse         | Confirms the historical convention already modeled reversal as **a new, paired movement** — the same conclusion the live-engine audit reached independently from the schema's `original_movement_id`/`reversal_movement_id` columns. |

This is exactly the kind of "historical movement-code reference" the task asked to be checked, and it lines up with live evidence (the `issue`/`reservation` category values already being valid) rather than contradicting it — two independent sources (historical docs, live CHECK constraints) converge on the same conclusion.

---

## Accepted Movement Semantics

- **101** = new physical delivery, Ambra already tracking.
- **Legacy Stock Entry** = physical stock existed before Ambra tracked it, onboarded now. Progressive, repeatable, per-batch.
- **401/402** = correction of an already-Ambra-tracked balance.
- **WU** = real physical issue against a RepairOrder, consumes reservation, decreases on-hand.

None of these four are interchangeable even where stock effect direction coincides (101 and Legacy Stock Entry are both `+destination`; 402 and WU are both `-source`) — per the audit's own proof for why 401/402 must not be reused for WU, the same reasoning applies symmetrically: **category and movement-type identity carry the "why," which reporting, audit, and future accounting integration all depend on.**

---

## WU Contract

- **Movement code: `201`.** EVIDENCE-BASED (historical exact match: "Goods Issue for Sale/Order" already named 201; live `category='issue'` already valid and unused; live 101/311/401/402 already prove the historical family-range convention was carried forward).
- **Category: `issue`.** LIVE VERIFIED as an already-valid, currently-unused category value.
- **`cost_impact`: `decrease`.**
- **Document type: code `WZ`** (_Wydanie Zewnętrzne_ — "external issue"), name "Goods Issue", matching the existing two-letter Polish-document-code convention already live for `PZ`/`MM`/`INW`. EVIDENCE-BASED (exact historical match).
- **`requires_source_location = true`, `requires_destination_location = false`** (mirrors 402's shape — issue removes from a source bin, no destination).
- **`requires_reference`: recommend `true`** — a WU without a RepairOrder reference is not a valid WU under the accepted product semantics ("WU IS a real stock movement... link the movement to RepairOrder"). This is a natural use of the field the engine already has, not new wiring.

### Stock effect

One `inventory_movement_type_effects` row: `target='source'`, `balance_field='on_hand'`, `direction='decrease'`, `is_required=true` — structurally identical in shape to `402`, distinct `movement_type_id`.

**Corrected this pass — the "reserved decrease" effect cannot be a second, unconditional, full-line-quantity declarative row.** Reservation/allocation consumption must be **capped at whatever is actually outstanding**, which the generic effects loop cannot know from static config alone (see Reservation/Allocation Behavior below for the exact mechanism and why this still stays inside the generic engine, not a WU-specific bolt-on). The declarative effects table for WU's movement type therefore stays with **exactly the one required `on_hand` row above** — the reserved/allocated consumption is a second, _generic but computed_ step inside `inventory_finalize_posting` (not a second `inventory_movement_type_effects` row), triggered by a new, still domain-agnostic config flag (see Implementation Plan). This correction directly answers point 3/4 of the requested response: **no, a raw declarative effect row cannot safely use the full movement-line quantity for `reserved`/`allocated`; it requires computed, capped consumption**, which is generic-engine logic (reservation/allocation matching by variant+location+org+branch), not RepairOrder-specific.

### Reservation & Allocation Behavior — two distinct accounting levels

**This section replaces the prior single "Reservation behavior" section. Three levels exist, not two, and they must not be conflated:**

| Level                      | Table                                                                                        | What it tracks                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Aggregate balance**      | `inventory_balances.reserved_quantity`, `.allocated_quantity`, `.on_hand_quantity`           | A live, org/branch/location/variant(/lot/serial)-scoped running total — the number the UI shows as "currently reserved/allocated/on-hand at this location." Maintained by every reservation/allocation/movement RPC that touches it.                                                                                                                              |
| **Reservation commitment** | `inventory_reservation_lines.reserved_quantity` / `released_quantity` / `fulfilled_quantity` | The **original business claim** (`reserved_quantity`, never rewritten after creation) plus its two terminal dispositions (`released_quantity` = given back unused; `fulfilled_quantity` = actually consumed).                                                                                                                                                     |
| **Allocation assignment**  | `inventory_allocation_lines.allocated_quantity` / `fulfilled_quantity`                       | A **specific location/lot/serial pin** against some quantity (optionally drawn from a reservation line), plus how much of that specific pin has been physically issued. No `released_quantity` column exists on this table (LIVE VERIFIED, confirmed again this pass) — allocation has only two states per line: allocated, and fulfilled-out-of-that-allocation. |

**Exact outstanding formulas, derived from live RPC bodies (not assumed):**

- **Reservation line outstanding** = `reserved_quantity - released_quantity - fulfilled_quantity`. **LIVE VERIFIED, quoted verbatim** from `inventory_release_reservation`'s own body: `v_remaining := v_line.reserved_quantity - v_line.released_quantity - v_line.fulfilled_quantity;`. `released_quantity` **is** part of the live model and **must** be included — confirms the correction's own hypothesis exactly.
- **Allocation line outstanding** = `allocated_quantity - fulfilled_quantity`. **LIVE VERIFIED, quoted verbatim** from `inventory_release_allocation`'s own body: `v_remaining := v_line.allocated_quantity - v_line.fulfilled_quantity;`. No `released_quantity` term — the column doesn't exist on this table.

**Release-case worked example** (reserved 5, fulfilled 2, released 1): outstanding = `5 - 1 - 2 = 2`. The historical commitment (`reserved_quantity = 5`) stays visible and unchanged; `fulfilled_quantity` and `released_quantity` are the two ways the original 5 has since been disposed of; only the un-disposed remainder (2) is still live/actionable.

**What `inventory_release_reservation` already does today** (LIVE VERIFIED, exact body read this pass) — this is the pattern WU fulfillment must mirror: for each line, compute `v_remaining` via the formula above, then `UPDATE inventory_balances SET reserved_quantity = greatest(0, reserved_quantity - v_remaining)` and `UPDATE inventory_reservation_lines SET released_quantity = released_quantity + v_remaining`. **WU's fulfillment step is the structural twin of this**: instead of `released_quantity += consumed` it does `fulfilled_quantity += consumed`, and instead of releasing the _entire_ remaining amount it releases only _what this specific WU line actually consumes_ (`LEAST(movement_line.quantity, reservation_line_outstanding)` — see the capping mechanism below).

**A critical, previously-unstated live finding that changes the fulfillment target**: `inventory_create_allocation` (LIVE VERIFIED, exact body read this pass), when an allocation is created **against** a reservation line (`p_reservation_line_id` provided), **already increments `inventory_reservation_lines.fulfilled_quantity`** and **already decrements `inventory_balances.reserved_quantity` / increments `.allocated_quantity`** — _at allocation-creation time_, not at issue time. This means **"fulfilled" on a reservation line, in the live system as it exists today, already means "converted into a concrete allocation," not "physically issued."** `inventory_allocation_lines.fulfilled_quantity` starts at 0 and is untouched by any existing RPC — it is the correct, and only correct, place for "physically issued" to be recorded when an allocation exists.

**Therefore the corrected WU fulfillment rule, precisely** (fixing the prior turn's design, which risked double-counting):

1. **If the WU line is issued against an existing allocation line**: increment `inventory_allocation_lines.fulfilled_quantity` by the consumed amount; decrement `inventory_balances.allocated_quantity` by the same amount (mirroring `inventory_release_allocation`'s exact pattern, but as a _fulfill_ not a _release_). **Do NOT touch `inventory_reservation_lines.fulfilled_quantity` again** — it was already incremented when the allocation was created; touching it a second time at WU time would double-count.
2. **If the WU line is issued against a reservation line directly, with no allocation ever created**: increment `inventory_reservation_lines.fulfilled_quantity` by the consumed amount; decrement `inventory_balances.reserved_quantity` by the same amount — mirroring exactly what `inventory_create_allocation` already does for the allocation case, applied one level up.
3. **If the WU line has no matching reservation or allocation at all**: neither balance-level counter is touched; only `on_hand_quantity` decreases.

In every case, `on_hand_quantity` decreases by the _full_ movement-line quantity — reservation/allocation bookkeeping is a separate, additional step layered on top, never a substitute for the physical decrease.

**Capping mechanism (answers "does the generic engine have enough information alone")**: No — a bare declarative effect row cannot express "consume up to what's outstanding, capped." The capping computation (`LEAST(line.quantity, outstanding)`) requires a lookup against `inventory_reservation_lines`/`inventory_allocation_lines` matched by `(organization_id, branch_id, variant_id, location_id[, lot_id, serial_id])` — this is **generic inventory logic** (it never references RepairOrder, `reference_type`, or any Zone 3 table), so it can and should live **inside** `inventory_finalize_posting` as a new, still domain-agnostic capability, gated by a new explicit config flag on the movement type (not by `code='201'`) — see Implementation Plan.

**Worked partial-issue-above-reservation example** (issue 5, reservation outstanding 3, override approved — ties into Correction 3 below): `on_hand -= 5` (unconditional, full line quantity); reservation/allocation consumption is capped at `LEAST(5, 3) = 3`, so `reserved_quantity -= 3` and `fulfilled_quantity += 3`; the remaining `5 - 3 = 2` is unreserved-issued and touches no reservation/allocation counter at all. Movement-line quantity stays `5`; RepairOrderLine attribution (`repair_order_line_movement_links.applied_quantity`) stays `5` — the _physical_ issue is never split, only the _reservation bookkeeping_ is capped.

### Allocation Behavior — conceptual model and pitch scope (new section)

**Conceptual stage model, exactly as specified — not collapsed:**

```
RepairOrderLine
    ↓
Reservation   = business commitment / demand claim
    ↓
Allocation    = specific stock/location(/lot/serial) assignment
    ↓
Container     = physical grouping of allocated quantities
    ↓
WU            = physical issue
```

**Allocation is PITCH-scope only if the pitch demonstrates real container/layout workflow — checked directly against the active pitch docs, not assumed either way:**

- `docs/mvp/mvp-readiness.md` (the master tracker) explicitly states its scope source is `ambra-skrypt-prezentacji.md` ("Źródło zakresu: [skrypt prezentacji](ambra-skrypt-prezentacji.md)") — **this is the canonical, currently-active pitch script.** A full-text search of it for `container`/`kontener`/`allocation`/`alokacj` found **zero matches** for a RepairOrder-parts-layout workflow; its only QR-related content is an unrelated Help Desk feature (attaching a QR code to a physical part tied to a support ticket, not a RepairOrder/container flow).
- `docs/mvp/mvp-readiness-full-vision-pitch-script.md` **does** contain exactly the described workflow, verbatim: _"2. Utwórz kontener, zeskanuj jego kod QR, zeskanuj kod QR lokalizacji docelowej... 3. → System zapisuje pełne powiązanie: zlecenie, część, kontener, lokalizacja..."_ — a precise match for "RepairOrder → reservation → container → QR → location → WU." **However, this exact document self-declares, in its own opening lines: "To NIE jest scenariusz tego, co działa dzisiaj... Stan faktyczny na dziś: 2 z 19 obszarów są zweryfikowane jako gotowe (patrz `docs/mvp-readiness-pitch-script.md` — to jest scenariusz do faktycznego użycia teraz). Nie używaj tego scenariusza tak, jakby wszystko w nim opisane już działało."** ("This is NOT a scenario of what works today... do not use this scenario as if everything in it already works.")

**Verified conclusion, not assumed**: the container/QR/physical-layout workflow exists **only** in a document explicitly and repeatedly self-labeled as a future/aspirational vision, not the current pitch. The actual currently-active, tracker-referenced pitch script contains no such workflow for RepairOrder parts. **Per the correction's own stated rule ("treat allocation as PITCH unless current approved pitch docs explicitly prove otherwise") — the current approved pitch docs DO explicitly prove otherwise.** This is reported plainly rather than silently resolved either way, because it directly contradicts the correction's stated expectation: **if the actual intended near-term demo has since evolved to include the container/QR flow beyond what `ambra-skrypt-prezentacji.md` currently documents, that is a real scope decision only the product owner can make — this design does not assume it.** Absent that explicit confirmation, this design classifies **allocation as PILOT/optional-for-pitch**, with reservation-only (no allocation, no container) as the pitch-sufficient path — see Pitch/Pilot Scope below for the exact fallback behavior this implies.

**Allocation fulfillment semantics** (LIVE VERIFIED, see the formulas above): `allocation_line` outstanding = `allocated_quantity - fulfilled_quantity`, no `released_quantity` participates (column doesn't exist). When WU issues against an allocation, it increments `inventory_allocation_lines.fulfilled_quantity` and decrements `inventory_balances.allocated_quantity` — it does **not** re-touch the reservation line's `fulfilled_quantity` (already incremented at allocation-creation time, per the live finding above).

### Container Behavior (corrected)

**Container relationship to allocation — single source of truth, no duplication**: `inventory_container_lines.quantity` (LIVE VERIFIED, real physical quantity) should be understood as **a physical grouping label layered on top of an allocation, not an independent quantity ledger**. Recommend: when a container is used, its `inventory_container_lines` row for a given variant/lot/serial should track quantities that are **also** represented by a corresponding `inventory_allocation_lines` row (same variant/location/lot/serial) — the container is "where I physically put the allocated stock," not a second place that independently claims quantity. **This avoids the double-source-of-truth risk the correction explicitly asked to avoid.** For pitch-fallback (no allocation, no container — reservation-only WU), this relationship is simply unused; nothing about it blocks the simpler path.

- **Must container quantity decrease on issue?** Yes, when a WU line names a `container_id` (already exists, nullable, on `inventory_movement_lines`) — decrement the matching `inventory_container_lines.quantity` by the consumed amount, in the same generic, config-gated step as the reservation/allocation capping logic above (matching by `container_id` + `variant_id` + lot/serial is simpler than reservation matching, since `container_id` is explicit on the line — no ambiguity to resolve).
- **Source location from container**: unchanged from the prior pass — UX default only (pre-fill), not hard-coupled at the schema/RPC level.
- **Multiple containers per WU / per line**: unchanged from the prior pass — one WU can span multiple containers via multiple lines; one line consumes from at most one container (two movement lines, not a new join table, if a logical issue must span two containers).
- **Same RepairOrderLine spread across multiple containers/allocations** (new test scenario, see Test Strategy): fully supported by the existing many-to-one shape — `repair_order_line_movement_links` already allows many `inventory_movement_lines` rows (and therefore many containers/allocations, one per line) to attribute to the same `repair_order_line_id`; no new schema needed.
- **Container becomes empty/released at zero quantity**: unchanged — follow-up bookkeeping, not required for WU's core correctness.

### RepairOrder / RepairOrderLine linkage

Exactly as already accepted: header `reference_type='repair_order'`, `reference_id=repair_orders.id` (matches the existing free-text convention already used identically by `inventory_reservations`/`inventory_allocations`/`inventory_containers`); line-level `repair_order_line_movement_links (repair_order_line_id, inventory_movement_line_id, applied_quantity, relation_type='issue')` — Zone 3's own table, already migrated, RLS'd, and pgTAP-tested. No new reference contract needed.

### Permission

**Normal WU (within reservation, or no reservation at all): `warehouse.inventory.operate`** — unchanged, matches 101/801's existing usage exactly.

**Corrected this pass — over-reservation override requires a stronger gate, not the same permission as normal issuing.** Per Correction 3: **`warehouse.inventory.adjust`**, reused (not a new permission), required specifically for the override action (Case C below). Reasoning: `adjust` already models "elevated trust to deviate from the expected/normal path" in this codebase (it already gates 401/402 and, per this same document, Legacy Stock Entry) — issuing beyond a formal reservation commitment is exactly that class of deviation, even though the underlying stock effect (`on_hand` decrease) is identical to a normal WU. Reusing `adjust` here is consistent with its existing role rather than inventing a third tier.

**Final over-reservation issue behavior (replaces the prior "soft warning" recommendation):**

- **Case A — no reservation exists**: WU allowed for any `operate`-holding user if physical stock permits (unchanged: `negative_stock_policy` still governs physical-stock blocking). `reserved_quantity`/`fulfilled_quantity` untouched.
- **Case B — reservation exists, requested quantity ≤ outstanding**: normal WU, `operate` sufficient. Capped-consumption logic (above) applies with no capping actually needed (requested ≤ outstanding, so the full requested amount is consumed from the reservation/allocation).
- **Case C — reservation exists, requested quantity > outstanding**: **hard-blocked by default.** The WU cannot post through the normal path at all. An **explicit override action** is required: (1) explicit user confirmation (a distinct UI action, not a checkbox pre-ticked or a dismissible toast), (2) a **mandatory reason** (free text, not optional), (3) the acting user must hold **`warehouse.inventory.adjust`**, not merely `operate`. Only once all three are satisfied does the WU proceed, with reservation/allocation consumption capped at the outstanding amount (per the worked example above) and the excess recorded as unreserved-issued.
- **Over-physical-stock rule, unchanged**: hard block via `negative_stock_policy='block'`, and **the override never bypasses this** — an approved reservation-override still cannot push `on_hand_quantity` negative; that check is independent and always enforced.

**Audit mechanism for the override reason**: `inventory_movement_audit_log.reason_code`/`reason_text` (LIVE VERIFIED, existing columns, already used by `inventory_cancel_movement` for exactly this kind of free-text justification — direct precedent). Recommend `reason_code='over_reservation_override'` (structured, filterable) + `reason_text` = the user's mandatory free-text reason. **No new schema** — reuses the existing audit-log columns exactly as an already-precedented pattern, satisfying "prefer existing audit infrastructure."

### Transaction boundary (corrected — engine-boundary violation fixed)

**The prior turn's recommendation — adding `p_repair_order_line_map` directly to `inventory_finalize_posting` — is a real violation of the generic-engine boundary and is withdrawn.** Even NULL-defaulted and behaviorally inert for existing callers, a parameter _named_ `repair_order_line_map` bakes RepairOrder vocabulary into the generic engine's own public signature — exactly the anti-pattern the correction warned against, just expressed in a parameter name instead of an `IF` branch.

**Corrected architecture, in two layers:**

1. **Generic engine layer — `inventory_finalize_posting` stays domain-agnostic, but gains two small, still-generic capabilities** (see Implementation Plan for the exact config mechanism):
   - Handles `balance_field='reserved'`/`'allocated'` for `on_hand`-paired decrease effects, with **capped, matched consumption** against `inventory_reservation_lines`/`inventory_allocation_lines` (matched by organization/branch/variant/location[/lot/serial] — never by `reference_type` or any RepairOrder concept).
   - Decrements the matching `inventory_container_lines.quantity` when a movement line names a `container_id` (already a plain, generic column).
   - Both capabilities are gated by a new, generic boolean config flag on the movement type (e.g. `consumes_reservation`), **not** by `code = '201'` — any future non-WU "issue"-category movement type gets this behavior for free, for the same evidence-based reason 201 gets it.
   - **`inventory_finalize_posting`'s signature does not change.** No new parameters.

2. **Domain orchestration layer — new, Zone 3/workshop-owned RPC**, e.g. `workshop_post_repair_order_issue(p_actor_user_id uuid, p_movement_id uuid, p_repair_order_line_map jsonb)`. This is where RepairOrder vocabulary correctly lives — it is not part of the generic inventory engine's namespace/ownership. Its body: (a) calls the **unmodified** `inventory_finalize_posting(p_movement_id, p_actor_user_id)` as its first statement (one transaction, since a PL/pgSQL function body is one transaction per top-level call), which handles on_hand + reserved/allocated + container effects entirely generically; (b) in the **same** transaction, inserts `repair_order_line_movement_links` rows from `p_repair_order_line_map`; (c) if an override was used, writes the `reason_code`/`reason_text` onto the header via the same statement flow (or the finalize call itself, if the override reason is threaded through as a plain text parameter to the _generic_ finalize call — acceptable, since "a movement can carry an operator-supplied reason" is itself a generic concept `inventory_cancel_movement` already established, not RepairOrder-specific).

This satisfies every constraint: the generic engine remains provably domain-agnostic (verifiable by reading its signature and body — no RepairOrder reference anywhere), while full atomicity is preserved because the _entire_ operation (posting + reservation/allocation/container effects + RepairOrder linkage) still happens inside one transaction, just one layer higher than previously proposed.

**Full atomic scope, restated per the correction's own checklist** — all inside the one `workshop_post_repair_order_issue` transaction: movement posting (header+lines, generic) → on_hand decrease (generic) → aggregate reserved/allocated decrease (generic, capped) → reservation-line/allocation-line `fulfilled_quantity` increase (generic) → container quantity decrease (generic) → `repair_order_line_movement_links` insertion (domain-specific, this layer only) → override audit (`reason_code`/`reason_text`, generic column, RepairOrder-specific _value_). Nothing is left to a second, separate call.

### Audit behavior

Inherited automatically: `inventory_movement_audit_log` (create+post events, already generic) + `inventory_stock_ledger_entries` (append-only ledger, already generic) + `reason_code`/`reason_text` for the override case (above). **Additional metadata recommended**: `reference_type`/`reference_id` already carries RepairOrder context, and `repair_order_line_movement_links` already carries line-level provenance; no new audit columns required. **Recommend** the WU orchestration layer (the new `workshop_post_repair_order_issue` RPC's caller, i.e. the Zone 3 service layer) also emit a Zone 3 `platform_events` entry (e.g. `workshop.repair_orders.parts_issued`, via `eventService.emit()`, Mode A, matching this session's already-established `workshop.repair_orders.materialized` pattern) — a RepairOrder-domain-facing event, separate from and in addition to the inventory-domain's own `inventory_movement_audit_log`.

### Reversal behavior

No generic reversal RPC exists for **any** movement type yet (engine-wide gap, confirmed again this pass). Recommend: **one generic `inventory_reverse_movement(p_movement_id, p_actor_user_id, p_reason)` RPC, engine-wide**, that (a) reads the original movement's lines + its type's effects, (b) creates a new draft+posted movement of a paired "reversal" type (matching the historical 102/202 pairing convention — e.g. `201` reversed by a new type `202`, `105` reversed by `102`-equivalent or its own pair) with every effect's `direction` inverted, (c) sets `original_movement_id`/`reversal_movement_id` on both rows. For WU specifically, reversing should **also** restore the reservation (decrement `fulfilled_quantity` back down) and restore container quantity — handled by the _same_ extended-effects mechanism recommended above (a reversal of a `balance_field='reserved'` decrease effect is just an increase effect, fully generic). **Not required for pitch** (see Pitch/Pilot below) — flagged as a Pilot-hardening item, but the design above shows it can be built generically, benefiting 101/401/402/801/WU/Legacy Stock alike, not WU-specific.

### Pitch / Pilot classification

**WU = PITCH.** Unchanged, reconfirmed. Verified against the active demo script framing and the RepairOrder → Matcher → materialize → receive → **issue** story arc.

**Corrected this pass — explicit fallback path for pitch, given allocation's re-evaluated scope (see Allocation Behavior above):** the pitch-required WU path is **reservation-only** (Case A/B above, `operate` permission, no allocation, no container) unless the product owner confirms the container/QR/layout workflow is genuinely part of the near-term demo (contradicting what `ambra-skrypt-prezentacji.md` currently documents). Allocation and container consumption remain fully designed and ready to build, but are **not** assumed PITCH-required by this document absent that explicit confirmation.

---

## Legacy Stock Entry Contract

- **Movement code: `105`.** EVIDENCE-BASED (exact historical match: "Initial Stock" / "Stan początkowy" / "Opening stock / inventory start" — a precise, direct conceptual match for "stock that existed before Ambra tracked it").
- **Category: `receipt`.** LIVE VERIFIED valid value; matches the historical grouping ("100-199: Receipts"). The distinction from a real 101 delivery is carried by the **movement type's own identity** (code/name/document type), not by category — exactly how 401 and 402 already coexist under the shared `adjustment` category while remaining clearly distinguishable.
- **`cost_impact`: `increase`.**
- **Document type: recommend code `PZ-I`** (EVIDENCE-BASED, exact historical match, name "Initial Stock Receipt" / _Przyjęcie — stan początkowy_). **Open alternative, NEW CONVENTION**: a fully separate prefix such as `LS` (Legacy Stock) if the product owner wants visual separation from real `PZ` receipts in reports/filters — `PZ-I` groups alphabetically/visually next to `PZ` (arguably desirable, since it IS a receipt-shaped event) while `LS` would stand apart (arguably clearer for pilot operators who must never confuse the two). **Recommend `PZ-I` as the default** given it is the directly evidenced option, but this is explicitly flagged as an open product decision below.
- **UI label recommendation**: "Wprowadzenie stanu początkowego" / "Legacy Stock Onboarding" — never "Przyjęcie" (receipt) alone in the UI, to keep operators from confusing it with a real delivery, even though the underlying `category` is `receipt`.
- **`requires_source_location = false`, `requires_destination_location = true`** (identical shape to 101/401).
- **`requires_reference`: recommend `true`** — see Duplicate-onboarding safeguards below; the reference field is the cheapest available anti-duplication mechanism the engine already has.

### Stock effect

One `inventory_movement_type_effects` row: `target='destination'`, `balance_field='on_hand'`, `direction='increase'`, `is_required=true` — **identical shape to 101**, distinct `movement_type_id`/`code`/`category`-label-pairing (category is shared with 101 as noted, but code/name/document type are not). **No custom posting logic needed** — `inventory_create_draft`/`inventory_finalize_posting` handle this exactly as they handle 101/401 today, zero engine changes.

### Progressive use — explicitly supported

Yes, by construction: each Legacy Stock Entry is an independent movement header/lines pair, exactly like any other movement. Monday's `+5` and Wednesday's `+3` are two separate, fully audited, independently reversible movements that both post to the same `inventory_balances` row via ordinary `on_hand_quantity` accumulation — no batching/aggregation mechanism is needed or should be built; the existing ledger (`inventory_stock_ledger_entries`) already accumulates correctly across any number of separate movements the same way it does for repeated 101 deliveries.

### Required fields / metadata

| Field                                                                                                 | Belongs on                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Required?                   |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `organization_id`, `branch_id`                                                                        | Header (existing columns)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Yes, always                 |
| `variant_id`, `unit_id`, `quantity`                                                                   | Line (existing columns)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Yes, always                 |
| Destination location                                                                                  | Line (`destination_location_id`, existing)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Yes, always                 |
| Operator                                                                                              | Header (`created_by`/`posted_by`, existing)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Automatic, already captured |
| **Reason/source**                                                                                     | Header (`external_reference`, existing) — recommend **required** for this movement type via `requires_reference=true`                                                                                                                                                                                                                                                                                                                                                                                                                                 | Yes                         |
| Onboarding date                                                                                       | Header (`operation_date`, existing — already generic "when did this happen" field)                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Yes, reuse as-is            |
| Optional note                                                                                         | Header (`note`, existing)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Optional                    |
| **Optional source/reference document** (e.g. a paper count sheet, a photo, an old system's record ID) | Header (`source_document_reference`, existing column — already present and unused by 101/401/402 today)                                                                                                                                                                                                                                                                                                                                                                                                                                               | Optional                    |
| **RepairOrder context, if discovered during onboarding**                                              | **Recommend: header `reference_type`/`reference_id` should NOT be used for this** (that pair is reserved for the movement's _ownership_ semantics, and Legacy Stock Entry must never imply RepairOrder ownership of the stock — see next section). If provenance-only context is wanted, the existing `note` field is sufficient for pitch/pilot; a dedicated `metadata` jsonb column does not exist on `inventory_movement_headers` today and **should not be added** for this alone — reusing `note` is simpler and matches "do not over-engineer." | Optional, `note` only       |

Nothing here requires a new column. Every field needed already exists on `inventory_movement_headers`/`inventory_movement_lines`.

### Duplicate-onboarding safeguards

Realistic, evaluated options:

- **Mandatory source/reason** (`requires_reference=true` on the movement type): **recommend adopting** — cheap, already-generic mechanism, forces the operator to write _something_ identifying why this stock is being onboarded (a location note, a discovery description), which is the single highest-value, lowest-friction safeguard available without new schema.
- **Location-specific onboarding**: already true by construction (`destination_location_id` required per line) — Monday's and Wednesday's entries at _different_ locations are inherently distinguishable in the ledger even for the same SKU, which is exactly the safety property wanted without blocking progressive onboarding.
- **Reference/import batch ID, onboarding batch IDs**: **not recommended as a hard requirement for pitch/pilot** — would require new schema (no batch-grouping column exists today) for a benefit the `external_reference` field can already approximate informally (operator writes a batch label into the reference text). Revisit only if pilot volume proves manual reference text insufficient.
- **Operator confirmation**: already inherent — every movement requires `created_by`/`posted_by`, an explicit two-step draft→finalize action, not a passive/automatic process.
- **Warning when a current Ambra balance already exists for that SKU+location**: **recommend as a UI-layer soft warning, not a DB-layer block** — e.g. "This location already shows 5 units of SKU ABC in Ambra — are you sure this is a NEW physical discovery, not the same units?" This is exactly the safety the example scenario calls for, without making progressive onboarding impossible (a real second discovery, e.g. a different physical batch in a different bin, is legitimate and must not be blocked).
- **External source reference / count-session linkage**: **not recommended for pitch** — `inventory_count_sessions`-adjacent infrastructure (Zone 15/warehouse audits, not re-verified this pass) is a heavier mechanism than progressive pilot onboarding needs; the `external_reference` field is sufficient at this stage.
- **Stronger permission than normal receipt**: **recommend yes** — see Permissions below; this is the single strongest, cheapest, most justified safeguard given the historical spec's own "Requires Approval: Yes" flag for exactly this movement type.

**Net recommendation**: `requires_reference=true` (mandatory reason/source text) + a stronger permission (below) + a UI soft-warning when a balance already exists. No new schema, no batch-ID system, no mandatory pre-count. Safety without blocking progressive rollout.

### Permission model

Historical doc explicitly flags Initial Stock as **"Requires Approval: Yes"** — unique among the receipt family (101/103/104 are "No"/"Optional"). This is a direct, on-point signal. **Recommend: reuse `warehouse.inventory.adjust`** (not `operate`) — `adjust` already exists specifically as the stronger of the two "can create movements" permissions (used today for 401/402, the other movement family with real risk of inflating/deflating reported stock without a real-world delivery behind it), and Legacy Stock Entry shares that exact risk profile (creates stock with no corresponding external document). **Do not invent a new permission** — `adjust` already models "elevated trust to change stock levels without a normal delivery," which is precisely this movement's risk. A manager-only gate can additionally be applied at the role-assignment level (who is granted `adjust`) without needing a third inventory permission slug.

### RepairOrder relationship

**Recommend: no `reference_type='repair_order'` on Legacy Stock Entry as a rule** — physical stock introduced by this movement is generic inventory until a separate reservation act ties it to a RepairOrder, exactly as specified. **Optional provenance is useful, but should not reuse the ownership-carrying `reference_type`/`reference_id` pair** (reusing it would be genuinely ambiguous — the same columns mean "this movement is FOR this RepairOrder" on 101/WU, so reusing them here would incorrectly suggest ownership). If the discovery-during-old-RepairOrder-onboarding scenario is common enough to want to record, the plain `note` field is sufficient and already available — **recommend not building a dedicated provenance column for this now**; it is a real but low-frequency scenario the generic `note` field already covers adequately without new schema.

### Transaction boundary

**Stays fully on the existing, unmodified path**: `inventory_create_draft` → `inventory_finalize_posting`, exactly as 101/401/402 already use them, zero extension. This movement needs none of WU's extra reservation/container/RepairOrder-link wiring — it is the simplest possible new movement type, purely a config addition.

### Audit behavior

Fully inherited, unmodified: `inventory_movement_audit_log` + `inventory_stock_ledger_entries` + frozen line snapshots. The `document_type_code` (`PZ-I`, distinct from `PZ`) is itself the primary mechanism that makes "why did this stock enter the ledger" self-evident in every report/ledger view keyed on document type — no additional metadata needed.

### Reversal behavior

Same engine-wide `inventory_reverse_movement` RPC recommended for WU (see above) — a wrong Legacy Stock Entry is reversed by a new, paired inverse movement, never by editing/deleting the posted row. **Not required for pitch.**

### Pitch / Pilot classification

**Legacy Stock Entry = PILOT**, confirmed against the active demo workflow: the pitch script's demonstrated flow is Matcher → materialize → receive (101) → issue (WU) using freshly-imported/demo data, not pre-existing "legacy" stock — there is no pitch-script moment that requires demonstrating historical-stock onboarding. This matches the task's own expected direction and is **verified**, not merely assumed, against the current zone/pitch documentation (Zone 3's architecture doc and the Zone 3 implementation plan's DEMO READY gate make no mention of a legacy-stock concept; the concept exists solely in this session's own audit/design work, not in any pitch-readiness requirement seen in `docs/mvp/`).

---

## Movement Code Recommendation Summary

| Movement           | Code    | Category  | `cost_impact` | Doc type                           | Basis          |
| ------------------ | ------- | --------- | ------------- | ---------------------------------- | -------------- |
| WU                 | **201** | `issue`   | `decrease`    | `WZ`                               | EVIDENCE-BASED |
| Legacy Stock Entry | **105** | `receipt` | `increase`    | `PZ-I` (alt: `LS`, NEW CONVENTION) | EVIDENCE-BASED |

## Numbering

Both should use the existing `<DOC_CODE>/{year}/{seq:6}` template, unchanged:

- WU → `WZ/2026/000001`
- Legacy Stock Entry → `PZ-I/2026/000001`

**Explicitly reuse today's org-wide numbering (branch_id IS NULL sequence row) unchanged for pitch** — the prior audit already found current live behavior is org-wide, not per-branch, for every existing type; there is no product requirement here forcing a change, and changing it would be an engine-wide behavior change affecting 101/401/402/801 too, out of scope for these two new types.

## Posted Immutability

Confirmed gap (prior audit): header UPDATE RLS does not check `status`, so a caller with `operate`/`adjust` could directly `.update()` a posted header's fields outside the finalize RPC. **Minimal engine-wide fix**: add `AND status = 'draft'` to `inventory_movement_headers_update`'s RLS policy `USING`/`WITH CHECK` clauses (mirroring the pattern already used for `inventory_movement_lines_update`, which already does exactly this) — a single, small, already-precedented RLS change. **Classification: PITCH** — this is a real, currently-live security/integrity gap on _existing_ movement types (101/401/402/801), not something newly introduced by WU or Legacy Stock; it should be fixed regardless of WU/Legacy Stock's own timeline, and is cheap enough (one policy edit, matching an existing sibling policy exactly) not to defer.

## Reversal Strategy

One generic `inventory_reverse_movement` RPC, engine-wide, deriving inverse effects from `inventory_movement_type_effects` (see WU Reversal section for the mechanics). **Classification: PILOT** — schema is ready, permission (`warehouse.inventory.reverse`) is already RLS-wired, but no pitch scenario requires demonstrating a correction; building it well (generically, benefiting all five+ movement types) is worth doing once, unhurried, in pilot hardening rather than rushed for pitch.

## Test Strategy

**WU** — unit: capped-consumption arithmetic (`LEAST(line.quantity, outstanding)`), reservation-vs-allocation fulfillment-target selection logic, quantity validation; service: issue-reserved, partial issue, multiple WU per RepairOrder, one WU/multiple RepairOrderLines, same-SKU-different-lines independence, issue-above-physical-stock (hard reject); DB/RPC: atomic posting, branch/org isolation, permission denial, duplicate-submit idempotency (reuse `inventory_create_draft`'s `p_idempotency_key`, verify it still holds for code 201).

**Corrected/added this pass — explicit reservation-accounting and override tests:**

1. Reservation 5, WU issues 2 → `on_hand -2`; aggregate `reserved -2`; reservation line's own `reserved_quantity` **remains 5** (never rewritten); `fulfilled_quantity` becomes 2.
2. Reservation 5, already `fulfilled=2` → WU issues 3 more → reservation becomes fully fulfilled (outstanding `5-0-5=0`); aggregate `reserved` decreases by 3 more.
3. Reserved 5, fulfilled 2, released 1 → assert outstanding = `5-1-2=2` exactly (the corrected three-term formula, not `reserved-fulfilled`).
4. Issue 5 with reservation outstanding 3 **+ approved override**: `on_hand -5`; aggregate `reserved -3` (not 5); `fulfilled_quantity +3` (not 5); unreserved-issued = 2 (derived, not stored); movement-line quantity = 5; `repair_order_line_movement_links.applied_quantity` = 5; audit row carries `reason_code='over_reservation_override'` + the mandatory `reason_text`.
5. Same operation attempted **without** an override (no explicit confirmation / no reason / caller holds only `operate` not `adjust`) → **rejected**, no partial posting.
6. Issue with no reservation at all → allowed under normal `operate` permission; `on_hand` decreases; `reserved`/`fulfilled` untouched.
7. Issue above physical `on_hand` → hard-blocked via `negative_stock_policy`, **even when an override was granted for the reservation check** (override never bypasses the physical-stock check — explicit negative test).
8. Allocation fulfillment during WU: issuing against an allocation increments `inventory_allocation_lines.fulfilled_quantity` and decrements `inventory_balances.allocated_quantity`, and does **not** re-increment the parent reservation line's `fulfilled_quantity` (already incremented at allocation-creation time — explicit double-count-prevention test).
9. Partial allocation fulfillment: allocation outstanding correctly computed as `allocated_quantity - fulfilled_quantity` (no `released_quantity` term) across multiple partial WU issues against the same allocation.
10. WU from a container: `inventory_container_lines.quantity` decreases by the consumed amount; the corresponding allocation's `fulfilled_quantity` also updates correctly; `on_hand` balance correct — all three stay consistent (no double-source-of-truth drift).
11. The same `RepairOrderLine` spread across multiple containers/allocations (multiple WU movement lines, each with a different `container_id`) → all correctly attribute to the same `repair_order_line_id` via separate `repair_order_line_movement_links` rows; no cross-attribution.
12. Rollback: if the reservation/allocation/container/link update step fails partway (simulated), the entire WU — including the `on_hand` stock movement itself — must not remain partially posted (proves the corrected single-transaction orchestration boundary, mirroring Zone 3's own already-proven atomicity-on-forced-failure test pattern from the materialization RPC).

**Legacy Stock Entry** — unchanged from the prior pass (Corrections 1–3 do not affect this movement): `+destination` correctness, same-SKU-multiple-batches, different-locations, progressive `+5` then `+3` = `8`, audit distinguishes `PZ-I` from `PZ`, no default RepairOrder ownership, branch isolation, permission denial (`operate`-only rejected, `adjust`-holder succeeds), duplicate-submit idempotency, subsequent normal reservation against onboarded stock.

## Implementation Plan (future, not this turn)

1. Engine-wide, generic: add a boolean config flag (e.g. `inventory_movement_types.consumes_reservation`) and teach `inventory_finalize_posting` to, when set, perform **capped** reservation/allocation/container consumption alongside the existing `on_hand` effect — matched by organization/branch/variant/location(/lot/serial)/`container_id`, never by movement code or `reference_type`. No new parameters on the function signature.
2. Engine-wide: RLS fix — `inventory_movement_headers_update` gains `status='draft'` check. (PITCH)
3. Config: seed `105`/`PZ-I` (Legacy Stock Entry) — pure config, zero code. (PILOT)
4. Config: seed `201`/`WZ` (WU), `consumes_reservation=true`, one required `on_hand` decrease effect row. (PITCH)
5. New, domain-owned (not generic engine): `workshop_post_repair_order_issue(p_actor_user_id, p_movement_id, p_repair_order_line_map)` — wraps the unmodified `inventory_finalize_posting`, adds `repair_order_line_movement_links` insertion, in one transaction. (PITCH, WU/Zone-3-specific by design)
6. New: WU-side service/action layer + override UI (explicit confirmation + mandatory reason field, gated on `warehouse.inventory.adjust` for the override path specifically). (PITCH)
7. Later, PILOT: generic `inventory_reverse_movement` RPC.
8. Later, PILOT: allocation/container UI (layout workflow) — only if the product owner confirms it's pitch-scope; otherwise pilot-hardening.
9. Later, PILOT: reservation/allocation-header auto-transition to `fulfilled`/cosmetic container-empty release.

## Open Product Decisions

1. **Legacy Stock document code**: `PZ-I` vs `LS`. Unchanged, still open.
2. **Allocation/container pitch scope**: this pass found the container/QR/layout workflow exists only in the explicitly-labeled future-vision script, not the active pitch script — **defaulting to PILOT/optional** unless the product owner explicitly confirms the near-term demo now includes it. This is the single most consequential open decision from this pass — it determines whether item 8 above is PITCH or PILOT work.
3. **`consumes_reservation` config-flag naming/shape** — proposed as a boolean; confirm this is sufficient or whether a richer config (e.g. per-effect matching strategy) is wanted later.
4. **Container QR / whether moving a container changes child-item effective location** — still UNRESOLVED from the prior audit.
5. **Override UX exact wording/confirmation flow, and Legacy Stock's separate "balance already exists" warning wording** — product/UX decisions, not architectural.

**Closed this pass** (previously open, now resolved by live evidence, no longer listed above): the exact reservation-outstanding formula (was open, now `reserved - released - fulfilled`, LIVE VERIFIED); whether the `reserved`-balance-field extension can be a simple declarative effect row (resolved: no, it requires capped/computed consumption, still generic); whether `p_repair_order_line_map` belongs on `inventory_finalize_posting` (resolved: no, moved to a new domain-owned orchestration RPC); over-reservation issue behavior (resolved: hard-block-with-override, not soft-warning).
