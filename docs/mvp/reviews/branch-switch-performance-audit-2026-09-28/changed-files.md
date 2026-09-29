# Changed Files

```
?? docs/mvp/reviews/branch-switch-performance-audit-2026-09-28/
```

**Investigation only.** No application code, test, config, migration or RLS file was changed.

- **Temporary instrumentation:** none was added. All timings came from external `curl` probes, the dev server's own per-request log output, and read-only SQL.
- **Dev server:** started for measurement and stopped afterwards (confirmed via `lsof`).
- **Live Supabase (`rjeraydumwechpjjzrus`):** read-only only. `SELECT`s against `user_preferences`, `users`, `branches`, `pg_trigger` and `pg_policies`, plus timed `SELECT`s run as the `authenticated` role inside explicitly **rolled-back** transactions. One of those transactions created a session temp table (`_t`, `ON COMMIT DROP`) to hold timings; it was discarded with the rollback. No row in any real table was inserted, updated or deleted.
- **Not committed.**
