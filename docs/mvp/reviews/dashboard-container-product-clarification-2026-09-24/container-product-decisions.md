# Container / RepairOrder Stock Operating Model — Product Decisions (2026-09-24)

Scope: these decisions apply specifically to **RepairOrder-assigned stock / parts belonging to a repair order**. They do NOT define the final model for all generic free stock (see decision G).

## A. RepairOrder stock must be containerized

**Accepted rule**: parts assigned to a RepairOrder must not be stored loose as a normal operational state. Normal lifecycle: RepairOrder part → container → location. A RepairOrder may have multiple containers; a container belongs operationally to one RepairOrder. Mental model: RepairOrder → its containers → container locations → parts inside containers.

**Consistency check**: consistent with, and formalizes, the existing accepted architecture. Phase 10C already built containers as the physical-grouping mechanism for RepairOrder-assigned allocated stock, and its own correction pass (2026-09-14) already enforces that a RepairOrder-owned container can only hold that RepairOrder's own allocations. This decision makes explicit that containerization is the NORMAL path (not merely available), a constraint on future UX, not a correction to anything already built.

## B. No normal "store loose" flow for RepairOrder parts

**Accepted rule**: no normal user action equivalent to "Store loose on location" / "Move loose to location" should be offered for parts already assigned to a RepairOrder. The system may still technically observe `uncontainerized` states internally (transitional during an operation, legacy/import inconsistency, diagnostic read-model inconsistency) — this is not removed or newly forbidden at the technical level, and no existing technical read-model support should be removed. It must simply not be presented as the intended normal workflow.

**Consistency check**: no existing documentation or implementation currently offers a "store loose" UI action for RepairOrder parts (Phase 10C explicitly built no UI at all). `03-05-integration.md`'s own `uncontainerized` read-model bucket already correctly frames this as a "mid-lifecycle" (i.e., transitional) technical state — clarified in place (2026-09-24) to explicitly cross-reference this decision, so it isn't misread as describing an acceptable normal end state.

## C. Partial move from a container creates a NEW container

**Accepted user flow**: worker scans/opens a source container, selects one or more part lines and quantities to move, scans/selects the destination location, and confirms "move selected parts and create a new container." On confirmation:

1. A NEW container is created.
2. The new container is automatically assigned to the SAME RepairOrder as the source container — the user is never asked again.
3. The selected quantities are removed from the source container.
4. The selected quantities are assigned to the new container.
5. The new container receives the destination location.
6. A new container QR/label is created/generated for printing/assignment.
7. The source container remains at its original location with its remaining contents.

**Consistency check — GENUINELY NEW, NOT CURRENTLY COVERED.** Phase 10E, as currently scoped, only covers whole-container relocation (decision D below) — moving the SAME container to a new location, no new container ever created. There is no existing phase, RPC design, or task describing container-splitting-on-move. **This is recorded here as a planning finding, per explicit instruction not to invent its design in a documentation-only pass.** A future phase would need to design (not attempted here): a new-container-creation-and-split RPC, its atomicity with the source container's quantity decrement, QR/label generation timing and ownership, its interaction with the existing `inventory_allocation_container_links` quantity-conservation invariant (Phase 10C), and its own pgTAP coverage. No phase number, size estimate, or scheduling is assigned by this pass.

## D. Moving the whole container

**Accepted user flow**: scan/open container → choose Move Container → scan/select destination location → confirm → the whole container and all its contents move together. No new container is created.

**Consistency check**: exactly matches Phase 10E's existing accepted design ("one atomic operation that posts a real 801 movement for the container's contents AND updates `inventory_containers.current_location_id` together"). No correction needed. Remains Phase 10E territory, NOT STARTED, not implemented by this pass.

## E. Adding parts to an existing container

**Accepted rule**: for additional parts belonging to the SAME RepairOrder, a worker may add them to an existing container of that RepairOrder, or create a new container. Parts from different RepairOrders must never be mixed into one RepairOrder-owned container.

**Consistency check**: already implemented and live-tested. Phase 10C's own correction pass (2026-09-14, finding 2) closed exactly this cross-RepairOrder mixing gap — `inventory_add_to_container` now resolves the placing allocation's own RepairOrder via the accepted ownership chain and rejects a mismatch (`P0002`); same-RepairOrder multi-allocation-line placement into one container remains fully supported. Proven via pgTAP T15-T21. Referenced here per the task's own explicit instruction, not redesigned.

## F. Issue / release from a container

**Accepted UX intent**: a worker may issue (A) the entire container's remaining contents in one action (container may end in an empty state), or (B) only selected part lines/quantities (remaining quantities stay in the same container).

**Consistency check**: consistent with Phase 10F's existing design. "Decrements the container line's quantity... container reaching zero contents → status='empty' (reuses Phase 10C's consistency rule)" already supports both whole and partial issue as described. No task wording change was needed beyond a small clarifying pointer note added to the implementation plan confirming this compatibility explicitly. Exact runtime implementation remains Phase 10F, NOT STARTED, not implemented by this pass.

## G. Free stock / non-RepairOrder stock

**Accepted distinction**: the mandatory-container rule (A/B above) applies only to RepairOrder-assigned stock — it does NOT mean every item in Ambra must belong to a RepairOrder.

- Free stock may exist without a RepairOrder.
- Such stock must still have a known warehouse location.
- No physical stock should exist operationally without identification/labeling.
- Future product scope should support QR identification for standalone stock units where unit-level traceability is needed, with that QR identity usable as an object context for actions such as: create Ticket, create Task, move, assign to RepairOrder, add to container, view history.

**Explicit non-expansion**: current pitch scope remains location QR + container QR only. Per-part/standalone-stock-unit QR remains future/PILOT-or-later scope, not reprioritized by this pass.

**Consistency check**: consistent with, and confirms, the container-workflow audit's own existing §7 recommendation ("scope the pitch to container-level QR only... unless product confirms a genuine need to scan a single loose part... that would be new surface, not a wiring gap") and `current-pitch-scope.md`'s own already-correct "Per-piece (individual part) permanent QR identity: NOT required, correctly narrowed" row. This resolves the container-workflow audit's own Open Product Decision #6 (§29) — no correction to either document was needed beyond marking that decision RESOLVED with a cross-reference.

## Summary table (per the task's own required-outcome checklist)

| Question                                                               | Answer                                                                                                     |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Can RepairOrder stock be intentionally stored loose?                   | NO, not in normal flow (A/B)                                                                               |
| Can one RepairOrder have multiple containers?                          | YES (A)                                                                                                    |
| Can one container contain multiple parts?                              | YES (A, and already true in the existing schema)                                                           |
| Can parts from different RepairOrders share one RepairOrder container? | NO (E, already enforced live)                                                                              |
| What happens when only some parts are moved to another location?       | A new container is created, inheriting the same RepairOrder (C — NEW workflow, not yet designed/scheduled) |
| What happens when the whole container moves?                           | Same container, new location (D — matches existing Phase 10E design)                                       |
| Can selected parts be issued from a container?                         | YES, intended (F — matches existing Phase 10F design)                                                      |
| Can the whole container contents be issued?                            | YES, intended (F — matches existing Phase 10F design)                                                      |
| Can more parts be added to an existing container?                      | YES, if they belong to the same RepairOrder (E — already implemented)                                      |
| Does this imply per-part QR for pitch?                                 | NO (G)                                                                                                     |
| Can free stock exist without RepairOrder?                              | YES (G)                                                                                                    |
| Does free stock still require location/identity?                       | YES (G)                                                                                                    |
| Is standalone stock-unit QR future scope?                              | YES (G)                                                                                                    |
