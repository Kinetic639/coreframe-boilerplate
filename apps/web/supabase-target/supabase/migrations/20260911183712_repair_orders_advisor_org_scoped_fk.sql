-- Zone 3 Phase 7 correction pass -- Finding D (CONFIRMED, live-reproduced):
-- repair_orders.advisor_contact_id -> crm_contacts.id was a SIMPLE foreign
-- key with no organization scoping, and is_own_advisor_contact() only checks
-- linked_user_id = auth.uid() (correctly, for its own narrow purpose) but
-- never the contact's own organization_id against the RepairOrder's.
-- manage_all's RLS branch has no advisor_contact_id restriction at all.
--
-- Live-reproduced this pass: created a synthetic second organization ("org
-- B") with a crm_contacts row inside it, then, as the genuinely-RLS-enforced
-- authenticated role holding workshop.repair_orders.manage_all in the real
-- org ("org A"), successfully set an org-A RepairOrder's advisor_contact_id
-- to the org-B contact's id -- a real cross-tenant data-integrity violation,
-- confirmed live, not assumed.
--
-- Fix, per explicit instruction to "prefer DB integrity over picker-only
-- validation" and to make "every ownership helper/check organization-aware
-- at minimum": a composite foreign key, not an RLS patch -- this is a hard
-- storage-layer integrity constraint enforced for EVERY caller (manage_own,
-- manage_all, and any future/service-role code path), not merely an
-- authorization gate that a future RLS change could accidentally loosen.
-- crm_contacts.id is already globally unique (its own primary key), so
-- crm_contacts_org_id_unique (organization_id, id) is a same-data-always-
-- valid addition -- live-verified zero existing repair_orders rows violate
-- this before adding it. MATCH SIMPLE (Postgres's default composite-FK
-- match mode) means the constraint is trivially satisfied whenever
-- advisor_contact_id IS NULL (unassigned -- nothing to check); when it IS
-- NOT NULL, organization_id is already NOT NULL on repair_orders, so BOTH
-- columns are always checked together, and the referenced (organization_id,
-- id) pair must exist in crm_contacts -- the contact must belong to the
-- SAME org as the RepairOrder, full stop, independent of RLS/role.
--
-- ON DELETE SET NULL (advisor_contact_id) uses Postgres 15+'s column-list
-- SET NULL syntax (confirmed live on PostgreSQL 17.6) so only
-- advisor_contact_id is cleared on a (today purely theoretical, since
-- crm_contacts is soft-deleted throughout this app) hard-delete of the
-- referenced contact -- organization_id, which is NOT NULL on repair_orders,
-- is correctly left untouched rather than a tuple-wide SET NULL attempting
-- (and failing) to null out a NOT NULL column.
alter table public.crm_contacts
  add constraint crm_contacts_org_id_unique unique (organization_id, id);

alter table public.repair_orders
  drop constraint repair_orders_advisor_contact_id_fkey;

alter table public.repair_orders
  add constraint repair_orders_advisor_contact_id_fkey
  foreign key (organization_id, advisor_contact_id)
  references public.crm_contacts (organization_id, id)
  on delete set null (advisor_contact_id);
