# Cleanup / Reset Strategy (Proposal Only)

Defined BEFORE any creation, per this task's own explicit ordering requirement.

## Identification (deterministic naming/prefixing)

Every demo artifact is namespaced so it can be found, verified, and removed as a complete set, without touching any unrelated org's data:

- **Organization:** name `Ambra Demo`, slug `ambra-demo` — unique, greppable, unambiguous.
- **Branches:** `Warszawa`, `Kraków` — scoped under the `Ambra Demo` org's own `organization_id`, so even though these are common real-world names, they're only ever queried/identified in combination with the parent org, never globally.
- **Products:** all SKUs prefixed `AMB-DEMO-` (e.g. `AMB-DEMO-001`).
- **Locations:** codes prefixed `WAW-`/`KRK-` and scoped to the `Ambra Demo` org's branches.
- **RepairOrder:** reference prefixed/tagged `RO-DEMO-` (exact format TO VERIFY DURING EXECUTION against whatever the real reference-number generator produces — if it can't be prefixed, the org-scoping alone is sufficient for identification).
- **User accounts:** placeholder emails should use a clearly demo-scoped domain/local-part convention when real addresses are chosen (e.g. `presenter+ambra-demo@...`) — TO BE DECIDED by whoever picks the real addresses, but the recommendation is a `+ambra-demo` tag or a dedicated test-domain mailbox, not a real production-adjacent personal address.

## Reset

Because every artifact is scoped under one `organization_id` (`Ambra Demo`), a full reset is a single, well-defined operation: soft-delete (matching this app's own established `deleted_at` convention, used throughout — locations, branches, products, etc. all already support soft delete) every row scoped to that `organization_id`, in dependency order (movements → balances → locations → products; RepairOrder + lines; Matcher sessions; QR assignments → QR codes; role assignments → memberships; branches; organization itself last). This should be done via the app's own delete/deactivate UI wherever available (Category A, matching the creation-method preference), falling back to the same server actions used for creation (Category B) only where no UI delete path exists.

**A hard/permanent delete (as opposed to the app's own soft-delete) is NOT recommended** — it would bypass RLS/soft-delete invariants the app relies on everywhere else, and isn't necessary: a soft-deleted demo org simply stops appearing in normal use and can be safely left in place indefinitely, exactly like the existing scratch/test orgs already sitting in this same project.

## Cleanup between rehearsals

If the demo needs to be re-run multiple times before the actual pitch (rehearsals), the SAME org should be reused and only the "live" data reset — e.g. the exact Matcher session that gets materialized live, or a movement posted live during the branch-switch walkthrough — rather than recreating the whole org each time. This keeps QR labels (physically printed, expensive to redo) valid across rehearsals, since QR-A1/QR-B1 are tied to the location records, not to any transient session/movement data.

## Separation from real/scratch orgs

- Never reuse "Diff Org name" or any of the other existing scratch orgs (see `environment-current-state.md`) — confirmed those are unrelated prior test debris, not to be touched or built upon.
- The demo org's data should never be queried or joined against another organization's data in any UAT script or fixture-creation script — every fixture-creation step in `phase8-human-uat-runbook.md`'s companion execution (not this bundle) should filter explicitly by the `Ambra Demo` `organization_id`.
