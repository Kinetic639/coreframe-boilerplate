# Zone 1 / Phase 7 — Blocker Closeout

## DEMO-track blockers (expected reconciliation per the task)

| Blocker                                                    | Status before Phase 7                      | Status after Phase 7                   |
| ---------------------------------------------------------- | ------------------------------------------ | -------------------------------------- |
| BLOCKER-Z1-001 (branch switch no refresh)                  | RESOLVED (Phase 1)                         | RESOLVED — unchanged                   |
| BLOCKER-Z1-002 (4 consumers branch-agnostic cache keys)    | RESOLVED (Phases 2-3)                      | RESOLVED — unchanged                   |
| BLOCKER-Z1-003 (Matcher session-list branch-agnostic key)  | RESOLVED (Phase 4)                         | RESOLVED — unchanged                   |
| BLOCKER-Z1-004 (QR cross-branch silent drop)               | RESOLVED, CORRECTED (Phase 6 + correction) | RESOLVED — unchanged                   |
| BLOCKER-Z1-005 (2 test/mock-drift files)                   | OPEN                                       | **RESOLVED (2026-09-24)** — this phase |
| BLOCKER-Z1-018 (stale QrTargetDescriptor.validate() JSDoc) | RESOLVED (Phase 6)                         | RESOLVED — unchanged                   |

**All DEMO-scope automated blockers are now RESOLVED.** No DEMO automated blocker remains open.

## PILOT-track blockers — confirmed left OPEN/DEFERRED, not touched

| Blocker                                                                      | Status                        | Touched this phase?                                                    |
| ---------------------------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------- |
| BLOCKER-Z1-006 (no owner-only gate on org_owner grant/revoke)                | OPEN, deferred, PILOT Phase A | No                                                                     |
| BLOCKER-Z1-007 (no ownerCount>=1 enforcement)                                | OPEN, deferred, PILOT Phase A | No                                                                     |
| BLOCKER-Z1-008 (no anti-privilege-escalation check)                          | OPEN, deferred, PILOT Phase B | No                                                                     |
| BLOCKER-Z1-009 (invitation acceptance doesn't re-validate one-org invariant) | OPEN, deferred, PILOT Phase C | No                                                                     |
| BLOCKER-Z1-010 (wdd*matcher*\*/helpdesk_tickets RLS not FORCED)              | OPEN, deferred, PILOT Phase D | No                                                                     |
| BLOCKER-Z1-011 (organization-rls-integration.test.ts env-loading gap)        | OPEN, deferred, PILOT Phase G | No — explicitly out of scope per the plan's own "Out of scope" section |
| BLOCKER-Z1-012 (no unsaved-work navigation guard)                            | OPEN, deferred, PILOT Phase F | No                                                                     |
| BLOCKER-Z1-013 (no admin action auditability)                                | OPEN, deferred, PILOT Phase H | No                                                                     |

Confirmed via `git diff` on the progress tracker: none of these 8 blocker entries' text was modified by this phase.

## Other tracked items — confirmed left as-is

| Item                                                         | Status                                | Touched this phase?                                                                                                     |
| ------------------------------------------------------------ | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| BLOCKER-Z1-014/015 (missing migration source, PILOT Phase E) | OPEN, deferred                        | No                                                                                                                      |
| BLOCKER-Z1-016 (stale CLAUDE.md ref)                         | RESOLVED (Phase 1)                    | No — already resolved before this phase                                                                                 |
| BLOCKER-Z1-017 (3 nuqs-crash client suites)                  | OPEN, unassigned, out of Zone 1 scope | Re-verified still failing (see `full-regression-results.md`), explicitly NOT fixed — matches the plan's own instruction |

## Verification method

`git diff` on `docs/mvp/zones/01-auth-org-branch-access-progress.md`'s "Active blockers" section confirms the ONLY line changed is BLOCKER-Z1-005's own status line (OPEN → RESOLVED). Every PILOT blocker line, and BLOCKER-Z1-017's line, is byte-for-byte unchanged.
