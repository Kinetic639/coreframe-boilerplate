# IC-8 — Sections 4, 9, 27: Clean-Environment Gates

## Status: ALL BLOCKED (common root cause — Section 2/3)

Three sections in this task's own spec depend on a working clean-replay
environment:

- **Section 4 (Clean seed/bootstrap)**: requires a fully-replayed clean
  schema to seed. Not reachable — the replay fails at migration #38/200.
- **Section 9 (Full pgTAP, clean environment)**: requires the same. Not
  reachable for the same reason. (Section 10, the equivalent live-target
  run, is COMPLETE — see `test-evidence.md` — 42/42 pgTAP files pass
  against the accepted `supabase-target` schema. This is not a substitute
  for clean-environment proof, but it is real, current evidence that the
  accepted schema itself is correct.)
- **Section 27 (Clean-room app boot)**: requires a database that at least
  has the full schema (even if unseeded) to point a dev server at. Not
  reachable.

All three share the identical root cause documented in full in
`migration-reproducibility.md`: the repository's own migration directory
does not reproduce the accepted live schema from empty, due to a
much-larger-than-previously-known gap (149 live-applied migration
versions with no local file, 106 of those with no local file even by
name) predating this project's own `20260910071815` reliable-parity
boundary. Per the user's own explicit direction after this finding was
surfaced, reconstructing that full gap was declined as out-of-scope for
this pass; the narrower, already-known 7-file zone5 gap WAS reconstructed
(see `migration-reproducibility.md`), but reconstructing 7 files does not
unblock a replay that fails 31 files earlier in sequence.

## What a non-clean-room substitute DOES provide, disclosed honestly

Section 28 (Representative browser smoke) is separately assessed against
the live target directly (not a substitute for Sections 4/9/27, but a
distinct, achievable gate) — see its own entry in the final readiness
assessment.

**Not fabricated as passing, not silently skipped.** All three gates
remain BLOCKED and are counted as such in the final freeze-criteria
synthesis (`final-readiness-assessment.md`).
