# Zone 3 Phase 7 Correction Pass — DB Security Summary

Four migrations, all against `supabase-target`, applied via MCP (`apply_migration`), live
version-parity confirmed, none editing an existing applied migration in place. This file exists
so a reviewer can assess the DB-layer security changes in isolation. See `review-context.md` for
the full narrative and live-reproduction evidence; `changed-files.md` for per-file metadata.

---

## Migration 1 — `20260911183702_repair_orders_own_advisor_contact_id_fn.sql`

**Live version**: `20260911183702`. **Finding**: A.
**Object created**: function `public.get_own_advisor_contact_id(uuid)`.

### Previous behavior

No such function existed. The application resolved "the caller's own linked advisor contact"
via a plain authenticated `SELECT` against `crm_contacts`, subject to that table's own RLS.

### New SQL (exact final definition)

```sql
create or replace function public.get_own_advisor_contact_id(p_organization_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select id
  from crm_contacts
  where organization_id = p_organization_id
    and linked_user_id = (select auth.uid())
    and deleted_at is null
  limit 1;
$$;
```

### Resulting behavior

Any authenticated caller can call this RPC with any `p_organization_id` and get back either the
`crm_contacts.id` of the ONE contact (if any) linked to their own `auth.uid()` in that specific
organization, or `NULL`. There is no parameter through which a caller can request another user's
linked contact — the identity half of the lookup is always `auth.uid()`, never caller-supplied.

### Why it was necessary

The RLS-layer fix from the FIRST correction pass (`is_own_advisor_contact`, migration
`20260911172434`) did not extend to the APPLICATION layer's own separate lookup method
(`getOwnAdvisorContactId`), which used a different, RLS-subject query shape and reproduced the
identical visibility bug one layer up.

### Security implications

- `SECURITY DEFINER` + fixed `search_path` (no search-path hijack surface).
- No caller-supplied user-id parameter — cannot be used to probe another user's CRM linkage.
- Organization-scoped by an explicit parameter — the caller must already know/hold a legitimate
  organization id (which every call site sources from the server-trusted active-org context, not
  client input) for the lookup to return anything.
- Returns only a `uuid` — no other contact fields are exposed by this function.

### Live verification result

Called as `authenticated`, holding only `workshop.repair_orders.manage_own`/`.read` (no
`crm.contacts.read`): correctly resolved the real self-linked contact id; correctly returned
`NULL` when called with a different organization id.

---

## Migration 2 — `20260911183705_repair_orders_archived_terminal_for_all.sql`

**Live version**: `20260911183705`. **Finding**: B.
**Object changed**: policy `repair_orders_update` (`repair_orders`, `FOR UPDATE`) — dropped and
recreated.

### Previous behavior

```sql
-- (as it stood after the first correction pass, before THIS migration)
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

`manage_all` had no status restriction in either clause.

### New SQL (exact final definition)

```sql
create policy repair_orders_update
  on public.repair_orders
  for update
  using (
    status <> 'archived'
    and (
      has_branch_permission(organization_id, branch_id, 'workshop.repair_orders.manage_all')
      or (
        has_branch_permission(organization_id, branch_id, 'workshop.repair_orders.manage_own')
        and is_own_advisor_contact(advisor_contact_id)
      )
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

### Resulting behavior

Any row whose CURRENT `status` is `'archived'` is excluded from the UPDATE's candidate row set
entirely (`USING` evaluates `false`), for every caller and every permission tier. Archiving a
still-`open`/`closed` row is unaffected (its OLD status is never already `'archived'`).

### Why it was necessary

Live-reproduced: `manage_all` could un-archive a row, and could edit an unrelated field on an
already-archived row, via raw UPDATE — contradicting the accepted "archived is terminal for
everyone" contract.

### Security implications

Closes a real business-rule bypass reachable by any `manage_all`-holding caller via the direct
Data API — previously only the application's own `canTransitionRepairOrderStatus` helper and the
UI enforced this, both of which a direct API call bypasses entirely.

### Live verification result

As `manage_all`: archive succeeds; a subsequent raw un-archive attempt leaves `status` at
`'archived'` (silent no-op); a subsequent raw unrelated-field edit attempt leaves that field
unchanged (silent no-op). Re-ran the pre-existing `093_...` pgTAP suite unchanged — 12/12 still
passing, no regression to any already-covered legitimate path.

---

## Migration 3 — `20260911183709_repair_orders_field_invariants_trigger.sql`

**Live version**: `20260911183709`. **Finding**: C.
**Objects created**: function `public.repair_orders_enforce_invariants()`; trigger `repair_
orders_enforce_invariants_trigger` (`BEFORE INSERT OR UPDATE`, `FOR EACH ROW`) on `repair_
orders`.

### Previous behavior

`identity_status`, `created_by`, `organization_id`, `branch_id` had no DB-level write
protection beyond RLS's row-level scoping — any UPDATE reaching the table (i.e. passing RLS)
could set these fields to any value satisfying only the pre-existing, narrower CHECK constraint
(`repair_orders_resolved_requires_zl_number`, which only forbids `identity_status='resolved'`
paired with a null `zl_number` — it does not forbid the opposite inconsistency, nor does it
touch `created_by`/`organization_id`/`branch_id` at all).

### New SQL (exact final definition)

```sql
create or replace function public.repair_orders_enforce_invariants()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.identity_status := case when new.zl_number is not null then 'resolved' else 'unresolved' end;

  if tg_op = 'UPDATE' then
    new.created_by := old.created_by;
    new.organization_id := old.organization_id;
    new.branch_id := old.branch_id;
  end if;

  return new;
end;
$$;

create trigger repair_orders_enforce_invariants_trigger
  before insert or update on public.repair_orders
  for each row
  execute function public.repair_orders_enforce_invariants();
```

### Resulting behavior

- `identity_status` is unconditionally recomputed from `NEW.zl_number`'s presence on every
  INSERT and UPDATE — no client-supplied `identity_status` value ever survives; it is always
  authoritatively derived.
- On UPDATE only, `created_by`/`organization_id`/`branch_id` are reset to their `OLD` values
  regardless of what the UPDATE statement attempted to set them to — effectively immutable after
  row creation. On INSERT, these three fields are taken as given (the only legitimate write
  point).

### Why it was necessary

Live-reproduced all three: a direct UPDATE setting a fabricated `zl_number` together with
`identity_status='resolved'`; a direct UPDATE desyncing `identity_status='unresolved'` while
`zl_number` remained present; a direct UPDATE rewriting `created_by`. Determined, by examining
sibling services, that this specific pair of fields (a derived invariant already partially
policed by an existing CHECK; an audit-authorship field with no legitimate post-creation write
path anywhere in the accepted design) crosses the bar that already justified building dedicated
RPCs elsewhere in Zone 3 for invariants RLS cannot express — a lightweight trigger is the
established, minimal mechanism for this class of fix, not a new framework.

### Security implications

Closes a data-integrity gap reachable by ANY caller who can otherwise pass RLS for an UPDATE
(both `manage_own` and `manage_all`) — the invariant now holds unconditionally at the storage
layer, not merely by convention in the application code.

### Live verification result

As `manage_all`: a direct attempt to set an inconsistent `identity_status` is silently
overridden back to the value derived from `zl_number`; a direct attempt to rewrite `created_by`
is silently overridden back to the original value. Confirmed via `pg_get_functiondef` (read-only,
before writing this migration) that `materialize_repair_orders_from_session` already only ever
writes consistent `identity_status`/`zl_number` pairs and never UPDATEs `created_by`/
`organization_id`/`branch_id` on `repair_orders` — this trigger changes nothing about that RPC's
observed behavior.

---

## Migration 4 — `20260911183712_repair_orders_advisor_org_scoped_fk.sql`

**Live version**: `20260911183712`. **Finding**: D.
**Objects changed**: new constraint `crm_contacts_org_id_unique` (`crm_contacts`); constraint
`repair_orders_advisor_contact_id_fkey` (`repair_orders`) — dropped and recreated as a composite
FK.

### Previous behavior

```sql
-- original, simple FK (from Phase 2)
foreign key (advisor_contact_id) references crm_contacts(id) on delete set null
```

No organization scoping at all — any `crm_contacts.id` from ANY organization satisfied the FK.

### New SQL (exact final definitions)

```sql
alter table public.crm_contacts
  add constraint crm_contacts_org_id_unique unique (organization_id, id);

alter table public.repair_orders
  drop constraint repair_orders_advisor_contact_id_fkey;

alter table public.repair_orders
  add constraint repair_orders_advisor_contact_id_fkey
  foreign key (organization_id, advisor_contact_id)
  references public.crm_contacts (organization_id, id)
  on delete set null (advisor_contact_id);
```

### Resulting behavior

When `advisor_contact_id IS NOT NULL`, the referenced `crm_contacts` row MUST belong to the same
`organization_id` as the `repair_orders` row — enforced by Postgres itself on every INSERT/
UPDATE, for every role, unconditionally. When `advisor_contact_id IS NULL`, the constraint is not
evaluated at all (`MATCH SIMPLE`).

### Why it was necessary

Live-reproduced: `manage_all`, acting entirely within its own real organization's permission
grant, successfully assigned a `crm_contacts` row belonging to a DIFFERENT, synthetic
organization as a RepairOrder's advisor — no RLS branch, including `manage_all`'s, checked the
contact's own organization.

### Security implications

This is a storage-layer, not an authorization-layer, fix — it holds regardless of RLS policy
correctness, role, or any future/service-role code path, closing the class of bug at its
strongest possible layer per the explicit "prefer DB integrity over picker-only validation"
guidance. It CANNOT be defeated by any runtime data-access path; only a schema migration
altering/dropping the constraint itself could remove this protection.

### Live verification result

Pre-migration: zero existing `repair_orders` rows had a cross-org `advisor_contact_id` (checked
via a direct join query before adding the constraint — it was applied fully validated, not `NOT
VALID`). Post-migration, as `manage_all`: a cross-org assignment attempt correctly fails with
SQLSTATE `23503` (foreign key violation) and no partial effect; a same-org assignment still
succeeds; clearing to `NULL` still always succeeds.

---

## Cross-migration interaction notes

- Migrations 2 and 3 both add behavior to `repair_orders` UPDATE paths but do not conflict:
  Migration 2 is a POLICY (evaluated by RLS, decides whether a row is reachable at all);
  Migration 3 is a TRIGGER (evaluated after RLS has already allowed the row through, rewrites
  specific column values on the way in). A blocked-by-Migration-2 row never reaches Migration
  3's trigger at all (RLS runs before triggers in Postgres's execution model).
- Migration 4's composite FK and Migration 1's new RPC are unrelated to each other but both
  touch the advisor-assignment surface from different angles (Migration 1: can the CALLER find
  their own contact; Migration 4: is a given contact assignment VALID once attempted) — no
  overlap or conflict between them.
- None of the four migrations modify `repair_orders_insert`'s advisor-self-restriction logic
  from the first correction pass (`20260911172022`) — Migration 4's composite FK layers UNDER
  that existing RLS check, so a `manage_own` INSERT naming a cross-org contact would already be
  rejected by the pre-existing RLS `WITH CHECK` (since `is_own_advisor_contact` only ever
  resolves to a same-linked-user contact, and per the one-org-per-user product model that is
  normally same-org) before ever reaching Migration 4's FK — Migration 4's real, confirmed value
  is specifically closing the `manage_all` gap, which had no such existing restriction.
