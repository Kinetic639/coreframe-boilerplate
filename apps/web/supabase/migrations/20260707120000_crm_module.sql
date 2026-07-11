-- ============================================================================
-- CRM / Kontrahenci Module
-- ============================================================================

-- Permissions ----------------------------------------------------------------

INSERT INTO public.permissions (slug, name, category, action, description)
VALUES
  ('crm.*', 'CRM Wildcard', 'crm', '*', 'All CRM permissions'),
  ('crm.read', 'CRM Read', 'crm', 'read', 'View the CRM module shell'),
  ('crm.parties.read', 'CRM Parties Read', 'crm', 'read', 'View kontrahenci and billable parties'),
  ('crm.parties.create', 'CRM Parties Create', 'crm', 'create', 'Create kontrahenci and billable parties'),
  ('crm.parties.update', 'CRM Parties Update', 'crm', 'update', 'Update kontrahenci and billable parties'),
  ('crm.parties.delete', 'CRM Parties Delete', 'crm', 'delete', 'Archive kontrahenci and billable parties'),
  ('crm.contacts.read', 'CRM Contacts Read', 'crm', 'read', 'View CRM contacts'),
  ('crm.contacts.create', 'CRM Contacts Create', 'crm', 'create', 'Create CRM contacts'),
  ('crm.contacts.update', 'CRM Contacts Update', 'crm', 'update', 'Update CRM contacts'),
  ('crm.contacts.delete', 'CRM Contacts Delete', 'crm', 'delete', 'Archive CRM contacts'),
  ('module.crm.access', 'CRM Module Access', 'module', 'access', 'Enter the CRM module')
ON CONFLICT (slug) DO NOTHING;

DO $$
DECLARE
  v_owner_id uuid;
  v_member_id uuid;
  v_perm_id uuid;
BEGIN
  SELECT id INTO v_owner_id FROM public.roles WHERE name = 'org_owner' AND is_basic = true LIMIT 1;
  SELECT id INTO v_member_id FROM public.roles WHERE name = 'org_member' AND is_basic = true LIMIT 1;

  IF v_owner_id IS NOT NULL THEN
    SELECT id INTO v_perm_id FROM public.permissions WHERE slug = 'crm.*';
    IF v_perm_id IS NOT NULL THEN
      INSERT INTO public.role_permissions (role_id, permission_id, allowed)
      VALUES (v_owner_id, v_perm_id, true)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  IF v_member_id IS NOT NULL THEN
    FOR v_perm_id IN
      SELECT id
      FROM public.permissions
      WHERE slug IN ('module.crm.access', 'crm.read', 'crm.parties.read', 'crm.contacts.read')
    LOOP
      INSERT INTO public.role_permissions (role_id, permission_id, allowed)
      VALUES (v_member_id, v_perm_id, true)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
END;
$$;

-- Entitlements ---------------------------------------------------------------

UPDATE public.subscription_plans
SET enabled_modules = array_append(enabled_modules, 'crm'),
    updated_at = now()
WHERE name IN ('professional', 'enterprise')
  AND NOT ('crm' = ANY(enabled_modules));

-- Schema ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.crm_number_sequences (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sequence_key text NOT NULL,
  next_value integer NOT NULL DEFAULT 1 CHECK (next_value > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, sequence_key),
  CONSTRAINT crm_number_sequences_known_key CHECK (sequence_key IN ('counterparty'))
);

CREATE TABLE IF NOT EXISTS public.crm_parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  counterparty_number integer NOT NULL CHECK (counterparty_number > 0),
  party_kind text NOT NULL DEFAULT 'organization' CHECK (party_kind IN ('organization', 'individual')),
  display_name text NOT NULL CHECK (char_length(trim(display_name)) > 0 AND char_length(display_name) <= 300),
  legal_name text,
  tax_id text,
  vat_id text,
  regon text,
  krs text,
  email text,
  phone text,
  website text,
  logo_storage_path text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  notes text,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (organization_id, counterparty_number)
);

CREATE TABLE IF NOT EXISTS public.crm_party_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  party_id uuid NOT NULL REFERENCES public.crm_parties(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('supplier', 'client', 'contractor', 'vendor', 'partner', 'receiver', 'payer', 'other')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (party_id, role)
);

CREATE TABLE IF NOT EXISTS public.crm_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  linked_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  visibility_scope text NOT NULL DEFAULT 'organization' CHECK (visibility_scope IN ('private', 'branch', 'organization')),
  owner_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  first_name text,
  last_name text,
  display_name text NOT NULL CHECK (char_length(trim(display_name)) > 0 AND char_length(display_name) <= 300),
  email text,
  phone text,
  mobile text,
  avatar_storage_path text,
  job_title text,
  notes text,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT crm_contacts_private_owner_required CHECK (
    visibility_scope <> 'private' OR owner_user_id IS NOT NULL
  ),
  CONSTRAINT crm_contacts_branch_required CHECK (
    visibility_scope <> 'branch' OR branch_id IS NOT NULL
  )
);

CREATE TABLE IF NOT EXISTS public.crm_party_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  party_id uuid NOT NULL REFERENCES public.crm_parties(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  relationship_type text NOT NULL DEFAULT 'primary' CHECK (relationship_type IN ('primary', 'billing', 'sales', 'technical', 'owner', 'representative', 'other')),
  is_primary boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (party_id, contact_id, relationship_type)
);

CREATE TABLE IF NOT EXISTS public.crm_party_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  party_id uuid NOT NULL REFERENCES public.crm_parties(id) ON DELETE CASCADE,
  address_type text NOT NULL DEFAULT 'registered' CHECK (address_type IN ('registered', 'billing', 'shipping', 'correspondence', 'other')),
  is_default boolean NOT NULL DEFAULT false,
  country text,
  city text,
  postal_code text,
  street text,
  building_number text,
  unit_number text,
  region text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.warehouse_item_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_products(id) ON DELETE CASCADE,
  party_id uuid NOT NULL REFERENCES public.crm_parties(id) ON DELETE RESTRICT,
  is_primary boolean NOT NULL DEFAULT false,
  supplier_sku text,
  lead_time_days integer CHECK (lead_time_days IS NULL OR lead_time_days >= 0),
  minimum_order_quantity numeric CHECK (minimum_order_quantity IS NULL OR minimum_order_quantity >= 0),
  purchase_price numeric CHECK (purchase_price IS NULL OR purchase_price >= 0),
  currency_code text,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (item_id, party_id)
);

-- Indexes --------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS crm_parties_org_deleted_idx ON public.crm_parties (organization_id, deleted_at);
CREATE INDEX IF NOT EXISTS crm_parties_org_status_idx ON public.crm_parties (organization_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS crm_parties_org_display_idx ON public.crm_parties (organization_id, display_name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS crm_parties_org_number_idx ON public.crm_parties (organization_id, counterparty_number) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS crm_party_roles_org_role_idx ON public.crm_party_roles (organization_id, role);
CREATE INDEX IF NOT EXISTS crm_party_roles_party_idx ON public.crm_party_roles (party_id);

CREATE INDEX IF NOT EXISTS crm_contacts_org_deleted_idx ON public.crm_contacts (organization_id, deleted_at);
CREATE INDEX IF NOT EXISTS crm_contacts_owner_idx ON public.crm_contacts (owner_user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS crm_contacts_branch_idx ON public.crm_contacts (branch_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS crm_contacts_linked_user_idx ON public.crm_contacts (linked_user_id) WHERE linked_user_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS crm_contacts_org_display_idx ON public.crm_contacts (organization_id, display_name) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS crm_party_contacts_party_idx ON public.crm_party_contacts (party_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS crm_party_contacts_contact_idx ON public.crm_party_contacts (contact_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS crm_party_contacts_one_primary_idx
  ON public.crm_party_contacts (party_id)
  WHERE is_primary = true AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS crm_party_addresses_party_idx ON public.crm_party_addresses (party_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS crm_party_addresses_one_default_idx
  ON public.crm_party_addresses (party_id, address_type)
  WHERE is_default = true AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS warehouse_item_suppliers_item_idx ON public.warehouse_item_suppliers (item_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS warehouse_item_suppliers_party_idx ON public.warehouse_item_suppliers (party_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS warehouse_item_suppliers_one_primary_idx
  ON public.warehouse_item_suppliers (item_id)
  WHERE is_primary = true AND deleted_at IS NULL;

-- Storage --------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'crm-party-logos',
    'crm-party-logos',
    false,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  ),
  (
    'crm-contact-avatars',
    'crm-contact-avatars',
    false,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  )
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS crm_party_logos_select ON storage.objects;
CREATE POLICY crm_party_logos_select
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'crm-party-logos'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND public.is_org_member((storage.foldername(name))[1]::uuid)
    AND public.has_permission((storage.foldername(name))[1]::uuid, 'crm.parties.read')
  );

DROP POLICY IF EXISTS crm_party_logos_insert ON storage.objects;
CREATE POLICY crm_party_logos_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'crm-party-logos'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND (storage.foldername(name))[2] = 'parties'
    AND public.is_org_member((storage.foldername(name))[1]::uuid)
    AND public.has_permission((storage.foldername(name))[1]::uuid, 'crm.parties.update')
  );

DROP POLICY IF EXISTS crm_party_logos_update ON storage.objects;
CREATE POLICY crm_party_logos_update
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'crm-party-logos'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND public.is_org_member((storage.foldername(name))[1]::uuid)
    AND public.has_permission((storage.foldername(name))[1]::uuid, 'crm.parties.update')
  )
  WITH CHECK (
    bucket_id = 'crm-party-logos'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND (storage.foldername(name))[2] = 'parties'
    AND public.is_org_member((storage.foldername(name))[1]::uuid)
    AND public.has_permission((storage.foldername(name))[1]::uuid, 'crm.parties.update')
  );

DROP POLICY IF EXISTS crm_party_logos_delete ON storage.objects;
CREATE POLICY crm_party_logos_delete
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'crm-party-logos'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND public.is_org_member((storage.foldername(name))[1]::uuid)
    AND public.has_permission((storage.foldername(name))[1]::uuid, 'crm.parties.update')
  );

DROP POLICY IF EXISTS crm_contact_avatars_select ON storage.objects;
CREATE POLICY crm_contact_avatars_select
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'crm-contact-avatars'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND public.is_org_member((storage.foldername(name))[1]::uuid)
    AND public.has_permission((storage.foldername(name))[1]::uuid, 'crm.contacts.read')
  );

DROP POLICY IF EXISTS crm_contact_avatars_insert ON storage.objects;
CREATE POLICY crm_contact_avatars_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'crm-contact-avatars'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND (storage.foldername(name))[2] = 'contacts'
    AND public.is_org_member((storage.foldername(name))[1]::uuid)
    AND public.has_permission((storage.foldername(name))[1]::uuid, 'crm.contacts.update')
  );

DROP POLICY IF EXISTS crm_contact_avatars_update ON storage.objects;
CREATE POLICY crm_contact_avatars_update
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'crm-contact-avatars'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND public.is_org_member((storage.foldername(name))[1]::uuid)
    AND public.has_permission((storage.foldername(name))[1]::uuid, 'crm.contacts.update')
  )
  WITH CHECK (
    bucket_id = 'crm-contact-avatars'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND (storage.foldername(name))[2] = 'contacts'
    AND public.is_org_member((storage.foldername(name))[1]::uuid)
    AND public.has_permission((storage.foldername(name))[1]::uuid, 'crm.contacts.update')
  );

DROP POLICY IF EXISTS crm_contact_avatars_delete ON storage.objects;
CREATE POLICY crm_contact_avatars_delete
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'crm-contact-avatars'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND public.is_org_member((storage.foldername(name))[1]::uuid)
    AND public.has_permission((storage.foldername(name))[1]::uuid, 'crm.contacts.update')
  );

-- Triggers -------------------------------------------------------------------

DROP TRIGGER IF EXISTS crm_parties_updated_at ON public.crm_parties;
CREATE TRIGGER crm_parties_updated_at
  BEFORE UPDATE ON public.crm_parties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS crm_contacts_updated_at ON public.crm_contacts;
CREATE TRIGGER crm_contacts_updated_at
  BEFORE UPDATE ON public.crm_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS crm_party_contacts_updated_at ON public.crm_party_contacts;
CREATE TRIGGER crm_party_contacts_updated_at
  BEFORE UPDATE ON public.crm_party_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS crm_party_addresses_updated_at ON public.crm_party_addresses;
CREATE TRIGGER crm_party_addresses_updated_at
  BEFORE UPDATE ON public.crm_party_addresses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS warehouse_item_suppliers_updated_at ON public.warehouse_item_suppliers;
CREATE TRIGGER warehouse_item_suppliers_updated_at
  BEFORE UPDATE ON public.warehouse_item_suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Number allocation ----------------------------------------------------------

CREATE OR REPLACE FUNCTION public.next_crm_counterparty_number(org_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_number integer;
BEGIN
  IF org_id IS NULL THEN
    RAISE EXCEPTION 'Organization id is required';
  END IF;

  IF NOT public.is_org_member(org_id) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO public.crm_number_sequences (organization_id, sequence_key, next_value)
  VALUES (org_id, 'counterparty', 1)
  ON CONFLICT (organization_id, sequence_key) DO NOTHING;

  SELECT next_value
  INTO v_number
  FROM public.crm_number_sequences
  WHERE organization_id = org_id
    AND sequence_key = 'counterparty'
  FOR UPDATE;

  UPDATE public.crm_number_sequences
  SET next_value = v_number + 1,
      updated_at = now()
  WHERE organization_id = org_id
    AND sequence_key = 'counterparty';

  RETURN v_number;
END;
$$;

REVOKE ALL ON FUNCTION public.next_crm_counterparty_number(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_crm_counterparty_number(uuid) TO authenticated;

-- RLS ------------------------------------------------------------------------

ALTER TABLE public.crm_number_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_party_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_party_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_party_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_item_suppliers ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.crm_parties FORCE ROW LEVEL SECURITY;
ALTER TABLE public.crm_party_roles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.crm_contacts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.crm_party_contacts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.crm_party_addresses FORCE ROW LEVEL SECURITY;

CREATE POLICY crm_number_sequences_select_member ON public.crm_number_sequences
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

CREATE POLICY crm_parties_select ON public.crm_parties
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.is_org_member(organization_id)
    AND public.has_permission(organization_id, 'crm.parties.read')
  );

CREATE POLICY crm_parties_insert ON public.crm_parties
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_org_member(organization_id)
    AND public.has_permission(organization_id, 'crm.parties.create')
  );

CREATE POLICY crm_parties_update ON public.crm_parties
  FOR UPDATE TO authenticated
  USING (
    public.is_org_member(organization_id)
    AND (
      (deleted_at IS NULL AND public.has_permission(organization_id, 'crm.parties.update'))
      OR public.has_permission(organization_id, 'crm.parties.delete')
    )
  )
  WITH CHECK (
    public.is_org_member(organization_id)
    AND (
      (deleted_at IS NULL AND public.has_permission(organization_id, 'crm.parties.update'))
      OR public.has_permission(organization_id, 'crm.parties.delete')
    )
  );

CREATE POLICY crm_parties_delete_deny ON public.crm_parties
  FOR DELETE TO authenticated
  USING (false);

CREATE POLICY crm_party_roles_select ON public.crm_party_roles
  FOR SELECT TO authenticated
  USING (
    public.is_org_member(organization_id)
    AND public.has_permission(organization_id, 'crm.parties.read')
    AND EXISTS (
      SELECT 1 FROM public.crm_parties p
      WHERE p.id = party_id AND p.organization_id = crm_party_roles.organization_id AND p.deleted_at IS NULL
    )
  );

CREATE POLICY crm_party_roles_insert ON public.crm_party_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_org_member(organization_id)
    AND public.has_permission(organization_id, 'crm.parties.update')
  );

CREATE POLICY crm_party_roles_delete ON public.crm_party_roles
  FOR DELETE TO authenticated
  USING (
    public.is_org_member(organization_id)
    AND public.has_permission(organization_id, 'crm.parties.update')
  );

CREATE POLICY crm_contacts_select ON public.crm_contacts
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.is_org_member(organization_id)
    AND public.has_permission(organization_id, 'crm.contacts.read')
    AND (
      visibility_scope = 'organization'
      OR (visibility_scope = 'private' AND owner_user_id = (select auth.uid()))
      OR (
        visibility_scope = 'branch'
        AND branch_id IS NOT NULL
        AND public.has_branch_permission(organization_id, branch_id, 'crm.contacts.read')
      )
    )
  );

CREATE POLICY crm_contacts_insert ON public.crm_contacts
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_org_member(organization_id)
    AND public.has_permission(organization_id, 'crm.contacts.create')
    AND (
      visibility_scope <> 'private'
      OR owner_user_id = (select auth.uid())
    )
    AND (
      visibility_scope <> 'branch'
      OR (
        branch_id IS NOT NULL
        AND public.has_branch_permission(organization_id, branch_id, 'crm.contacts.create')
      )
    )
  );

CREATE POLICY crm_contacts_update ON public.crm_contacts
  FOR UPDATE TO authenticated
  USING (
    public.is_org_member(organization_id)
    AND (
      (deleted_at IS NULL AND public.has_permission(organization_id, 'crm.contacts.update'))
      OR public.has_permission(organization_id, 'crm.contacts.delete')
    )
    AND (
      visibility_scope <> 'private'
      OR owner_user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    public.is_org_member(organization_id)
    AND (
      (deleted_at IS NULL AND public.has_permission(organization_id, 'crm.contacts.update'))
      OR public.has_permission(organization_id, 'crm.contacts.delete')
    )
    AND (
      visibility_scope <> 'private'
      OR owner_user_id = (select auth.uid())
    )
  );

CREATE POLICY crm_contacts_delete_deny ON public.crm_contacts
  FOR DELETE TO authenticated
  USING (false);

CREATE POLICY crm_party_contacts_select ON public.crm_party_contacts
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.is_org_member(organization_id)
    AND public.has_permission(organization_id, 'crm.parties.read')
  );

CREATE POLICY crm_party_contacts_insert ON public.crm_party_contacts
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_org_member(organization_id)
    AND public.has_permission(organization_id, 'crm.parties.update')
    AND EXISTS (
      SELECT 1 FROM public.crm_parties p
      WHERE p.id = party_id AND p.organization_id = crm_party_contacts.organization_id AND p.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM public.crm_contacts c
      WHERE c.id = contact_id AND c.organization_id = crm_party_contacts.organization_id AND c.deleted_at IS NULL
    )
  );

CREATE POLICY crm_party_contacts_update ON public.crm_party_contacts
  FOR UPDATE TO authenticated
  USING (
    public.is_org_member(organization_id)
    AND public.has_permission(organization_id, 'crm.parties.update')
  )
  WITH CHECK (
    public.is_org_member(organization_id)
    AND public.has_permission(organization_id, 'crm.parties.update')
  );

CREATE POLICY crm_party_contacts_delete_deny ON public.crm_party_contacts
  FOR DELETE TO authenticated
  USING (false);

CREATE POLICY crm_party_addresses_select ON public.crm_party_addresses
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.is_org_member(organization_id)
    AND public.has_permission(organization_id, 'crm.parties.read')
  );

CREATE POLICY crm_party_addresses_insert ON public.crm_party_addresses
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_org_member(organization_id)
    AND public.has_permission(organization_id, 'crm.parties.update')
  );

CREATE POLICY crm_party_addresses_update ON public.crm_party_addresses
  FOR UPDATE TO authenticated
  USING (
    public.is_org_member(organization_id)
    AND public.has_permission(organization_id, 'crm.parties.update')
  )
  WITH CHECK (
    public.is_org_member(organization_id)
    AND public.has_permission(organization_id, 'crm.parties.update')
  );

CREATE POLICY crm_party_addresses_delete_deny ON public.crm_party_addresses
  FOR DELETE TO authenticated
  USING (false);

CREATE POLICY warehouse_item_suppliers_select ON public.warehouse_item_suppliers
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.is_org_member(organization_id)
    AND public.has_permission(organization_id, 'warehouse.products.read')
    AND public.has_permission(organization_id, 'crm.parties.read')
  );

CREATE POLICY warehouse_item_suppliers_insert ON public.warehouse_item_suppliers
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_org_member(organization_id)
    AND public.has_permission(organization_id, 'warehouse.products.manage')
    AND public.has_permission(organization_id, 'crm.parties.read')
  );

CREATE POLICY warehouse_item_suppliers_update ON public.warehouse_item_suppliers
  FOR UPDATE TO authenticated
  USING (
    public.is_org_member(organization_id)
    AND public.has_permission(organization_id, 'warehouse.products.manage')
  )
  WITH CHECK (
    public.is_org_member(organization_id)
    AND public.has_permission(organization_id, 'warehouse.products.manage')
  );

CREATE POLICY warehouse_item_suppliers_delete_deny ON public.warehouse_item_suppliers
  FOR DELETE TO authenticated
  USING (false);

GRANT SELECT ON public.crm_number_sequences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_parties TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.crm_party_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_contacts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_party_contacts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_party_addresses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.warehouse_item_suppliers TO authenticated;

COMMENT ON TABLE public.crm_parties IS 'Kontrahenci: invoice-capable parties such as suppliers, clients, contractors, and individual clients.';
COMMENT ON COLUMN public.crm_parties.counterparty_number IS 'Plain integer kontrahent number, auto-assigned per organization.';
COMMENT ON TABLE public.crm_contacts IS 'Human CRM contacts, including optional linked app users and scoped private/branch/org visibility.';
COMMENT ON TABLE public.warehouse_item_suppliers IS 'Warehouse item supplier terms referencing CRM parties with supplier role.';
