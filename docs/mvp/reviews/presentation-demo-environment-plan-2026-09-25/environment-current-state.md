# Presentation Demo Environment Plan — Current State (Read-Only Verification)

**Date:** 2026-09-25
**Branch:** zone3-zone5-integration-audit
**HEAD SHA at time of this pass:** c300e0a7057352fb37e2ede4d186d5e8835a44de

This is a read-only verification pass. Nothing in this document reflects a mutation — every fact below was gathered via `SELECT`-only SQL or by reading files.

## Live target confirmed

- **Supabase target project ref:** `rjeraydumwechpjjzrus` (per `apps/web/CLAUDE.md`: "NEVER run local Supabase. Always use remote project ID: rjeraydumwechpjjzrus").
- **`.env.local` target:** points at this same remote project (confirmed indirectly — Phase 8's dev-server check in `docs/mvp/reviews/zone1-phase8-manual-uat-2026-09-24/` connected successfully and resolved real data from it).
- **Authoritative migration tree:** `apps/web/supabase-target/supabase/migrations` (per `apps/web/CLAUDE.md`).
- **No local Supabase use** in this pass or planned in the eventual execution — all reads and any future writes target the remote project above.
- **No mutation performed in this task.** Every query below is a `SELECT`. Confirmed via this session's own tool-call history — only `mcp__supabase-target__execute_sql` calls with `select` statements were made.

## Existing organizations (read-only query, 2026-09-24/25)

```sql
select id, name, slug, created_at from organizations where deleted_at is null order by created_at desc limit 20;
```

| Name                | Slug                           | Created    |
| ------------------- | ------------------------------ | ---------- |
| Anna's Organization | annas-organization-test-szkola | 2026-03-14 |
| Grupa               | grupa-cichy-zasada             | 2026-03-10 |
| Grupa cichy-Zasada  | -rupa-cichy-asada-5b1ea397     | 2026-03-10 |
| Diff Org name       | -iff-rg-name-6117c233          | 2026-03-10 |

**None of these is a prepared demo/pitch organization.** All 4 names and slugs indicate ad-hoc scratch/test orgs from unrelated prior testing sessions, not a deliberately-built presentation environment.

## Existing branch counts per org (read-only query)

```sql
select b.organization_id, o.name as org_name, count(*) as branch_count
from branches b join organizations o on o.id = b.organization_id
where b.deleted_at is null group by b.organization_id, o.name order by branch_count desc;
```

| Org                 | Branch count |
| ------------------- | ------------ |
| Diff Org name       | 8            |
| Grupa cichy-Zasada  | 1            |
| Grupa               | 1            |
| Anna's Organization | 1            |

**"Diff Org name" is NOT reused for the demo despite having 8 branches**, per this task's own explicit instruction ("Do not reuse an unrelated scratch org merely because it already has branches") — it has no representative products, locations, roles, or naming that would make sense in front of an audience, and reusing scratch test data for a real presentation would risk exposing test-debris artifacts (odd branch names from prior branch-numbering test churn, no printed/tested QR labels, etc.).

## Conclusion

**A genuine demo organization must be created from scratch.** See `demo-org-design.md` for the proposed design and `approval-checklist.md` for every action that would require explicit approval before execution.
