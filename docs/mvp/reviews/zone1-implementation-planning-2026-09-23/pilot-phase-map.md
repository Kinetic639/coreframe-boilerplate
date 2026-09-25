# Zone 1 — PILOT READY Phase Map

Quick-reference summary of the 9 PILOT READY phases. Full detail lives in `01-auth-org-branch-access-implementation-plan.md`; this file is a navigation aid for the review bundle only. None of these are scheduled this week.

| Phase | Name                                          | Depends on                  | Repo surface                                    | DB change?                | Severity of gap closed  |
| ----- | --------------------------------------------- | --------------------------- | ----------------------------------------------- | ------------------------- | ----------------------- |
| A     | Ownership invariants                          | 0 (sequenced after Phase 8) | `roles.ts`, `organization.service.ts`, RLS, RPC | Migration + RPC           | HIGH                    |
| B     | Anti-escalation / role administration         | 0                           | `roles.ts`, `organization.service.ts`, RLS      | Migration                 | HIGH                    |
| C     | Invitation + one-org invariant                | 0                           | `accept_invitation_and_join_org` RPC            | Migration + RPC           | MEDIUM                  |
| D     | Branch RLS hardening                          | (E related, not blocking)   | new migrations only                             | Migration                 | MEDIUM-HIGH             |
| E     | Schema source-of-truth reconciliation         | 0                           | new migrations, `CLAUDE.md`                     | Migration (catch-up only) | Debt, not vulnerability |
| F     | Unsaved-work / navigation safety              | 1 (DEMO phase)              | new shared hook, 2 forms                        | NONE                      | LOW-MEDIUM              |
| G     | Live security/integration test infrastructure | 0                           | `vitest.config.ts`, CI config                   | NONE                      | Confidence gap          |
| H     | Administrative auditability                   | 0 (sequenced after A/B)     | action files, possibly new table                | Possibly migration        | MEDIUM                  |
| I     | PILOT READY manual verification               | A-H                         | none (verification)                             | NONE                      | Gate                    |

## Dependency graph

```
Phase 0 (DONE, shared with DEMO track)
  |-- Phase A --\
  |-- Phase B ---\
  |-- Phase C ----\
  |-- Phase D -----+-- Phase H --\
  |-- Phase E --/                 \
  |-- Phase F (needs DEMO Phase 1) \
  |-- Phase G --------------------- Phase I
```

Phases A, B, C, D, E, G can start independently once Phase 0 is done (and, by product-sequencing choice, once DEMO Phase 8 is reached — not a hard technical dependency). Phase F needs DEMO Phase 1's branch-switch handler to exist. Phase H is sequenced after A/B so it logs the final, hardened action shapes rather than a soon-to-change unguarded version. Phase I needs all of A-H.

## Why these 9, not the task's own 8-letter (A-H) hypothesis

The task's own starting hypothesis listed PILOT Phase H as "PILOT READY manual verification." This plan instead makes manual verification Phase I, and inserts "Administrative auditability" as its own Phase H — because `admin-security-verification.md`'s own findings and Zone 1's own accepted architecture implications name auditability as a distinct, real requirement (not a byproduct of ownership/escalation hardening), and folding it into Phase A or B would mix a cross-cutting logging concern into two phases that are each already scoped around a specific vulnerability class. This is exactly the kind of "verify whether that is the best actual shape" refinement the task instructed, not a deviation from it.

## Severity summary (for stakeholders skimming this map)

**HIGH severity, must precede any real pilot use:** Phase A (no owner-only gate, no last-owner protection), Phase B (no anti-escalation checks anywhere in role management).

**MEDIUM-HIGH:** Phase D (Matcher/Help Desk branch RLS not forced).

**MEDIUM:** Phase C (invitation one-org re-validation), Phase H (no admin audit trail).

**LOW-MEDIUM:** Phase F (unsaved-work loss risk, not a security hole).

**Debt, not vulnerability:** Phase E (missing migration source for live-correct tables), Phase G (test infrastructure gap masking confidence, not itself exploitable).
