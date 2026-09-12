-- Zone 3 Phase 7 correction pass -- Finding A (CONFIRMED, live-reproduced):
-- RepairOrdersService.getOwnAdvisorContactId() performed a plain authenticated
-- SELECT against crm_contacts (organization_id = :org AND linked_user_id =
-- :user), which is itself subject to crm_contacts_select's own RLS policy
-- (requires a separate crm.contacts.read grant) -- reintroducing, in the
-- APPLICATION layer, the exact same visibility bug already fixed at the RLS
-- layer by is_own_advisor_contact() (20260911172434). Live-reproduced this
-- pass: a real self-linked crm_contacts row, for which
-- is_own_advisor_contact() correctly returns true, returned ZERO rows from
-- the plain-SELECT pattern under the same actor (workshop.repair_orders.
-- manage_own + .read, no crm.contacts.read).
--
-- Consequence: a genuine manage_own advisor lacking crm.contacts.read (a) is
-- shown as a non-owner on their own RepairOrder's detail page (edit/
-- lifecycle controls incorrectly hidden), and (b) cannot self-assign during
-- manual creation through createRepairOrderAction, since its pre-check
-- compares the submitted advisor_contact_id against this same broken lookup.
--
-- Fix: a dedicated SECURITY DEFINER function, mirroring is_own_advisor_
-- contact()'s and has_branch_permission()'s established pattern -- derives
-- identity from auth.uid() only (no caller-supplied user id, no privilege
-- escalation surface), is organization-scoped (a trusted p_organization_id
-- parameter, matching the "org/branch always server-trusted" convention
-- already used throughout Zone 3's action layer), fixed search_path, and
-- returns only the minimum information necessary (a single uuid, not the
-- full contact record).
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
