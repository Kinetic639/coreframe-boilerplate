-- Zone 3 Phase 7 -- CONFIRMED LIVE BUG FIX (found while writing Phase 7's own
-- RLS tests, not a Phase 7 feature): repair_orders' ownership check
-- (advisor_contact_id -> crm_contacts.linked_user_id = auth.uid()) has been
-- broken since Phase 2's original migration for ANY actor who does not also
-- separately hold crm.contacts.read.
--
-- Root cause: repair_orders_update's (and, since the Phase 7 hardening
-- migration above, repair_orders_insert's) USING/WITH CHECK clauses express
-- the ownership check as a plain correlated subquery against crm_contacts:
--   advisor_contact_id IN (SELECT id FROM crm_contacts WHERE linked_user_id = auth.uid())
-- Unlike has_branch_permission (SECURITY DEFINER, reads
-- user_effective_permissions directly, bypassing that table's own RLS),
-- this subquery is a PLAIN reference to crm_contacts under the querying
-- role's own privileges -- so it is itself subject to crm_contacts' own
-- RLS SELECT policy, which requires the caller to separately hold
-- crm.contacts.read (crm_contacts_select: "... AND has_permission(
-- organization_id, 'crm.contacts.read') AND (visibility_scope = 'organization'
-- OR ...)"). A RepairOrder advisor who holds workshop.repair_orders.manage_own
-- but NOT crm.contacts.read -- a realistic, plausible real-world role
-- (a Workshop advisor is not automatically also a CRM user) -- has this
-- subquery silently return ZERO rows regardless of whether they really are
-- the linked advisor, so the ownership check always evaluates false. This
-- was LIVE VERIFIED this session while writing Phase 7's own RLS tests: a
-- manage_own actor genuinely linked to their own advisor contact, holding
-- workshop.repair_orders.manage_own + .read (but not crm.contacts.read),
-- could not INSERT (and, by the same broken mechanism, could not UPDATE)
-- a RepairOrder naming themselves as advisor -- a hard self-lockout on the
-- exact ownership model this table's RLS is supposed to enforce.
--
-- Fix: a dedicated SECURITY DEFINER helper (matching has_branch_permission's
-- own established pattern) that resolves "is this crm_contacts row linked to
-- the calling user" independent of the caller's own crm_contacts RLS
-- visibility. repair_orders_update and repair_orders_insert are rewritten to
-- call it instead of the raw subquery. Also closes a smaller, related gap
-- while rewriting this logic: the original subquery never excluded
-- soft-deleted crm_contacts rows (deleted_at IS NULL) -- a soft-deleted
-- contact should not count as "still my linked advisor identity" either.
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

drop policy if exists repair_orders_update on public.repair_orders;

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

drop policy if exists repair_orders_insert on public.repair_orders;

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
