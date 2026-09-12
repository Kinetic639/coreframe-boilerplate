# Zone 3 Phase 7 — Migration Summary (DB-focused reviewer aid)

Two migrations, both against `repair_orders` RLS on the `supabase-target` project. This file
exists so a reviewer who wants to assess the DB security changes in isolation doesn't have to
locate them inside the full 3,609-line diff. See `changed-files.md` for file metadata and
`review-context.md` §D/§H for the full prose writeup and live-verification method.

---

## Migration 1 — `20260911172022_repair_orders_insert_advisor_self_restriction.sql`

**Live version**: `20260911172022` (parity re-verified while preparing this bundle).
**Object changed**: `repair_orders_insert` policy (`repair_orders`, `FOR INSERT`).

### Before (live since Phase 2 — `20260910061711_repair_orders_core_schema.sql`)

```sql
create policy repair_orders_insert
  on public.repair_orders
  for insert
  with check (
    has_branch_permission(organization_id, branch_id, 'workshop.repair_orders.manage_own')
    or has_branch_permission(organization_id, branch_id, 'workshop.repair_orders.manage_all')
  );
```

No restriction on `advisor_contact_id` for either permission tier.

### After

```sql
create policy repair_orders_insert
  on public.repair_orders
  for insert
  with check (
    has_branch_permission(organization_id, branch_id, 'workshop.repair_orders.manage_all')
    or (
      has_branch_permission(organization_id, branch_id, 'workshop.repair_orders.manage_own')
      and (
        advisor_contact_id is null
        or advisor_contact_id in (
          select crm_contacts.id
          from crm_contacts
          where crm_contacts.linked_user_id = (select auth.uid())
        )
      )
    )
  );
```

**Effect**: `manage_own` may now only INSERT with `advisor_contact_id IS NULL` or their own
linked contact. `manage_all` unaffected. (This intermediate version's `manage_own` branch still
used a raw subquery against `crm_contacts` — see Migration 2 below, which replaces it with the
`SECURITY DEFINER` helper for the same reason it fixes `repair_orders_update`.)

**Why required**: Phase 7 introduces the first real INSERT path (manual creation). Without this,
a `manage_own` actor could name an unrelated contact as advisor at creation, inconsistent with
the UPDATE policy's design and self-defeating for the creator.

---

## Migration 2 — `20260911172434_repair_orders_advisor_self_check_fn.sql`

**Live version**: `20260911172434` (parity re-verified while preparing this bundle).
**Objects changed**: new function `public.is_own_advisor_contact(uuid)`; `repair_orders_update`
and `repair_orders_insert` policies (both dropped and recreated to use it).

### New function

```sql
create or replace function public.is_own_advisor_contact(p_contact_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_contact_id is not null and exists (
    select 1
    from crm_contacts
    where crm_contacts.id = p_contact_id
      and crm_contacts.linked_user_id = (select auth.uid())
      and crm_contacts.deleted_at is null
  );
$$;
```

Notes for reviewers: `SECURITY DEFINER`, `STABLE`, fixed `search_path = public, pg_temp` (no
search-path hijack surface), no dynamic SQL, no caller-supplied identity parameter (`auth.uid()`
only) — same shape as the pre-existing, already-accepted `has_branch_permission`.

### `repair_orders_update` — before (live since Phase 2, unchanged by Migration 1 above)

```sql
create policy repair_orders_update
  on public.repair_orders
  for update
  using (
    has_branch_permission(organization_id, branch_id, 'workshop.repair_orders.manage_all')
    or (
      has_branch_permission(organization_id, branch_id, 'workshop.repair_orders.manage_own')
      and (advisor_contact_id in (
        select crm_contacts.id from crm_contacts
        where crm_contacts.linked_user_id = (select auth.uid())
      ))
    )
  )
  with check (
    has_branch_permission(organization_id, branch_id, 'workshop.repair_orders.manage_all')
    or (
      has_branch_permission(organization_id, branch_id, 'workshop.repair_orders.manage_own')
      and (advisor_contact_id in (
        select crm_contacts.id from crm_contacts
        where crm_contacts.linked_user_id = (select auth.uid())
      ))
      and (status <> 'archived')
    )
  );
```

**The bug**: `advisor_contact_id in (select id from crm_contacts where ...)` runs under the
querying role's own privileges, so it is itself subject to `crm_contacts_select`'s RLS
(`crm.contacts.read` required). A `manage_own` actor without that separate CRM permission got
zero rows from this subquery regardless of real ownership — the `USING`/`WITH CHECK` clause
always evaluated `false` for them. **Live-reproduced, not assumed** — see `review-context.md`
§H.

### `repair_orders_update` — after

```sql
create policy repair_orders_update
  on public.repair_orders
  for update
  using (
    has_branch_permission(organization_id, branch_id, 'workshop.repair_orders.manage_all')
    or (
      has_branch_permission(organization_id, branch_id, 'workshop.repair_orders.manage_own')
      and is_own_advisor_contact(advisor_contact_id)
    )
  )
  with check (
    has_branch_permission(organization_id, branch_id, 'workshop.repair_orders.manage_all')
    or (
      has_branch_permission(organization_id, branch_id, 'workshop.repair_orders.manage_own')
      and is_own_advisor_contact(advisor_contact_id)
      and status <> 'archived'
    )
  );
```

### `repair_orders_insert` — after (supersedes Migration 1's version, same net policy shape)

```sql
create policy repair_orders_insert
  on public.repair_orders
  for insert
  with check (
    has_branch_permission(organization_id, branch_id, 'workshop.repair_orders.manage_all')
    or (
      has_branch_permission(organization_id, branch_id, 'workshop.repair_orders.manage_own')
      and (advisor_contact_id is null or is_own_advisor_contact(advisor_contact_id))
    )
  );
```

**Net behavioral change from before Migration 1**: `manage_own` INSERT now restricted to self/
null advisor; `manage_own` UPDATE ownership check now actually works (previously silently
false for any actor lacking `crm.contacts.read`); `manage_all` behavior unchanged throughout.

---

## Live verification record

- Both migrations applied via `mcp__supabase-target__apply_migration` (not hand-edited).
- `list_migrations` re-checked while preparing this bundle: both versions present, exactly
  matching local filenames — no drift.
- Both policies' live definitions re-queried via `pg_policies` after application.
- `is_own_advisor_contact` re-verified fixing the bug: a real self-linked `crm_contacts` row,
  invisible to the ownership check as `authenticated` before the fix, correctly resolves after.
- `093_repair_orders_header_ownership_rls_test.sql` (12 pgTAP assertions) exercises both
  policies' final shape live, as the genuinely-RLS-enforced `authenticated` role — 12/12 passing,
  zero residual data after `ROLLBACK`.
