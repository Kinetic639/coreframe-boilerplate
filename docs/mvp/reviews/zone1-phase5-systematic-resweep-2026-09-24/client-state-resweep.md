# Zone 1 / Phase 5 — Client-State Re-Sweep

## Method

Searched for client-local or global state that may be branch-sensitive and could survive navigation incorrectly: Zustand slices, selected item/location/RepairOrder IDs, local session-history selections, cached filters encoding branch-scoped object IDs, persistent `localStorage`/`sessionStorage` keys.

## `localStorage` usage app-wide

```
grep -rln "localStorage\." src/ --include="*.ts" --include="*.tsx"
```

| File                                         | Purpose                                                        | Branch-sensitive?                                                      | Classification                        |
| -------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------- |
| `data-view-columns.tsx`                      | Column-visibility preferences per DataView entity              | NO — a UI preference (which columns are shown), not branch-scoped data | Safe — org/branch-agnostic preference |
| `account/preferences/appearance-section.tsx` | Color theme/appearance preference                              | NO                                                                     | Safe — user preference                |
| `dashboard-color-theme-loader.tsx`           | Same                                                           | NO                                                                     | Safe — user preference                |
| `dashboard-initial-loader.tsx`               | Gates a loading screen until Zustand's own hydration completes | NO — refers to Zustand's OWN hydration state, not branch data caching  | Safe                                  |

**`useAppStoreV2` (the V2 app store holding `activeBranchId`) does not use Zustand's `persist` middleware at all** — confirmed via grep (zero matches for `persist`/`zustand/middleware`/`localStorage` in `app-store.ts`). `activeBranchId` is purely in-memory per page load, reconciled against the deliberately tab-isolated `sessionStorage` mechanism (`session-branch.ts`, already confirmed correct) — never written to `localStorage`, so there is no risk of a stale branch value leaking across browser tabs or surviving a session it shouldn't.

## `sessionStorage` usage

Confirmed to be exactly the already-verified-correct `session-branch.ts` mechanism: tab-isolated, keyed by org, storing only the working branch ID for that specific tab. Re-confirmed this phase as safe and load-bearing for the reconciliation effect analyzed in `branch-switch-path-resweep.md`.

## Selected item / DataView URL state

DataView's own `selected` row ID lives in the URL (via `nuqs`), not in any persistent client store. Since Phase 1's redirect always navigates the user to `/dashboard/start` (a route with no `selected` param) after any successful branch switch, any previously-selected row ID is abandoned along with the navigation itself — there is no mechanism by which a stale, cross-branch `selected` ID could survive a switch and later resolve against the wrong branch's data.

## Unsaved-work / dirty-form state

Not re-investigated in depth this phase — already fully documented and explicitly deferred to PILOT Phase F in the pre-implementation audit (`branch-state-cache-inventory.md` §4: "genuinely absent as a shared/reusable mechanism... DEMO READY minimum: if this week's rehearsed choreography never has the presenter open [the Movement Editor or RepairOrder creation form] and then use the branch switcher mid-edit, nothing needs to ship for this reason alone"). Re-confirming this finding is unchanged; not re-litigated, per the task's own instruction not to reopen settled product decisions.

## Verdict

No confirmed stale-state bug found. No client-local or persistent state was found that could cause branch-crossing incorrectness beyond the already-known, already-deferred unsaved-work gap (PILOT scope, not reopened).
