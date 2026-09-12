-- Zone 3 Phase 7 -- harden repair_orders_insert so a manage_own-only actor
-- (not manage_all) can only set advisor_contact_id to NULL or to their OWN
-- linked crm_contacts row at INSERT time, mirroring the ownership shape the
-- existing repair_orders_update policy already enforces (WITH CHECK requires
-- the post-update advisor_contact_id to remain in the caller's own linked
-- contacts for a manage_own-only actor).
--
-- Before this migration, repair_orders_insert's WITH CHECK only required
-- manage_own OR manage_all -- a manage_own-only actor could INSERT a row
-- naming ANY crm_contacts.id as advisor_contact_id, including a contact
-- linked to a different user entirely. That is not a privilege escalation
-- (the row still requires correct organization_id/branch_id and a real
-- workshop.repair_orders.* grant), but it is a genuine product/business-rule
-- inconsistency relative to the already-accepted ownership model: a
-- manage_own advisor who does not also set themselves as the assigned
-- advisor would immediately create a RepairOrder they can never again edit
-- via manage_own (repair_orders_update's own ownership check requires the
-- CURRENT advisor_contact_id to already be the caller's own linked contact),
-- and could also silently misattribute ownership to an unrelated contact.
--
-- manage_all is entirely unaffected -- it may still set advisor_contact_id
-- to any contact (or leave it null) at INSERT time, matching its existing
-- "can manage any order in branch" authority on UPDATE.
drop policy if exists repair_orders_insert on public.repair_orders;

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
