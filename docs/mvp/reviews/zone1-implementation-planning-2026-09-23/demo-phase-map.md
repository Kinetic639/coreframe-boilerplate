# Zone 1 — DEMO READY Phase Map

Quick-reference summary of the 9 DEMO READY phases. Full detail lives in `01-auth-org-branch-access-implementation-plan.md`; this file is a navigation aid for the review bundle only.

| Phase | Name                                               | Depends on | Repo surface                                    | DB change? | Status            |
| ----- | -------------------------------------------------- | ---------- | ----------------------------------------------- | ---------- | ----------------- |
| 0     | Implementation baseline / frozen boundary          | —          | docs only                                       | NONE       | DONE (2026-09-23) |
| 1     | Centralized branch transition                      | 0          | `sidebar-branch-switcher.tsx`                   | NONE       | NOT STARTED       |
| 2     | Branch-aware DataView/query-key foundation         | 0          | `use-data-view-query.ts`, `data-view/types.ts`  | NONE       | NOT STARTED       |
| 3     | Migrate confirmed branch-scoped DataView consumers | 2          | 4 warehouse client components                   | NONE       | NOT STARTED       |
| 4     | Matcher branch-aware query key                     | 0          | `wdd-matcher.ts`, Matcher UI                    | NONE       | NOT STARTED       |
| 5     | Systematic branch-state re-sweep                   | 1, 2, 3, 4 | verification only                               | NONE       | NOT STARTED       |
| 6     | Cross-branch warehouse.location deep-link/QR       | 1          | `public-token-resolver.ts`, `LocationsPage.tsx` | NONE       | NOT STARTED       |
| 7     | DEMO READY automated closeout                      | 1-6        | 2 test files                                    | NONE       | NOT STARTED       |
| 8     | Manual DEMO READY UAT                              | 1-7        | none (verification)                             | NONE       | NOT STARTED       |

## Dependency graph

```
Phase 0 (DONE)
  |-- Phase 1 --------\
  |-- Phase 2 -- Phase 3 \
  |-- Phase 4 -----------> Phase 5 -- Phase 7 -- Phase 8
        Phase 1 --> Phase 6 --------/
```

Phases 1, 2, 4 can start in parallel immediately after Phase 0. Phase 3 needs Phase 2. Phase 6 needs Phase 1. Phase 5 needs all of 1-4. Phase 7 needs Phase 5 and Phase 6. Phase 8 needs Phase 7.

## No DB changes across the entire DEMO track

Every one of Phases 1-8 is explicitly `Supabase changes: NONE`. This is intentional and load-bearing: DEMO READY should be reachable with zero live-DB mutation risk, confirming the "DEMO-relevant" gaps identified in the pre-implementation audit are all application-layer bugs (cache identity, transition orchestration, UX), not schema or RLS defects. All schema/RLS work is PILOT-only (Phases D and E).

## Recommended implementation order (not just dependency order)

1. Phase 1 first — highest pitch-impact, smallest diff, unblocks Phase 6.
2. Phase 2 and Phase 4 in parallel with or immediately after Phase 1 — independent, low-risk foundation work.
3. Phase 3 once Phase 2 lands.
4. Phase 6 once Phase 1 lands.
5. Phase 5 once 1-4 are all done — the systemic-closure gate.
6. Phase 7 — automated closeout.
7. Phase 8 — manual UAT, the final gate to DEMO READY.
