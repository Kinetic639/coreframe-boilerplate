-- Saved views of every data table list (not just the products list).
--
-- A view is a list's address under a name: its search, filters, sort and rows
-- per page. `list_key` is the list's route without the locale
-- (e.g. `/dashboard/warehouse/items`), so any list built on the shared data
-- table gets saved views without a table or policy of its own.
--
-- Who sees what: one's own views, and the views shared in the organization.
-- Any member may save and share; one's own views are one's own to remove,
-- and a shared view may also be removed by someone with org.update.
--
-- The products list's views move here from inventory_saved_views (left in
-- place, unused, for a later cleanup).

CREATE TABLE IF NOT EXISTS public.list_saved_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  list_key text NOT NULL,
  name text NOT NULL,
  query text NOT NULL,
  is_shared boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  CONSTRAINT list_saved_views_list_key_check CHECK (list_key ~ '^/[A-Za-z0-9/_\[\]-]{0,200}$'),
  CONSTRAINT list_saved_views_name_check CHECK (length(trim(name)) BETWEEN 1 AND 160),
  CONSTRAINT list_saved_views_query_check CHECK (length(query) <= 4000)
);

CREATE INDEX IF NOT EXISTS list_saved_views_list_idx
  ON public.list_saved_views (organization_id, list_key)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS list_saved_views_user_idx
  ON public.list_saved_views (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS list_saved_views_own_name_unique_idx
  ON public.list_saved_views (organization_id, user_id, list_key, lower(name))
  WHERE deleted_at IS NULL AND is_shared = false;

CREATE UNIQUE INDEX IF NOT EXISTS list_saved_views_shared_name_unique_idx
  ON public.list_saved_views (organization_id, list_key, lower(name))
  WHERE deleted_at IS NULL AND is_shared = true;

DROP TRIGGER IF EXISTS list_saved_views_updated_at ON public.list_saved_views;
CREATE TRIGGER list_saved_views_updated_at
  BEFORE UPDATE ON public.list_saved_views
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.list_saved_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS list_saved_views_select ON public.list_saved_views;
CREATE POLICY list_saved_views_select
  ON public.list_saved_views FOR SELECT
  TO authenticated
  USING (
    public.is_org_member(organization_id)
    AND (user_id = auth.uid() OR is_shared)
  );

DROP POLICY IF EXISTS list_saved_views_insert ON public.list_saved_views;
CREATE POLICY list_saved_views_insert
  ON public.list_saved_views FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_org_member(organization_id)
    AND user_id = auth.uid()
    AND deleted_at IS NULL
  );

-- Updates are the soft delete (and a rename, later).
DROP POLICY IF EXISTS list_saved_views_update ON public.list_saved_views;
CREATE POLICY list_saved_views_update
  ON public.list_saved_views FOR UPDATE
  TO authenticated
  USING (
    public.is_org_member(organization_id)
    AND (
      user_id = auth.uid()
      OR (is_shared AND public.has_permission(organization_id, 'org.update'))
    )
  )
  WITH CHECK (
    public.is_org_member(organization_id)
    AND (
      user_id = auth.uid()
      OR (is_shared AND public.has_permission(organization_id, 'org.update'))
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.list_saved_views TO authenticated;
REVOKE ALL ON public.list_saved_views FROM anon;

-- The products list's views, as they were.
INSERT INTO public.list_saved_views
  (organization_id, user_id, list_key, name, query, is_shared, created_at, updated_at)
SELECT
  v.organization_id,
  v.user_id,
  '/dashboard/warehouse/items',
  v.name,
  coalesce(v.config ->> 'query', ''),
  v.is_shared,
  v.created_at,
  v.updated_at
FROM public.inventory_saved_views v
WHERE v.deleted_at IS NULL
  AND v.user_id IS NOT NULL
  AND v.entity = 'inventory_products'
  AND NOT EXISTS (
    SELECT 1 FROM public.list_saved_views l
    WHERE l.organization_id = v.organization_id
      AND l.list_key = '/dashboard/warehouse/items'
      AND l.user_id = v.user_id
      AND lower(l.name) = lower(v.name)
      AND l.deleted_at IS NULL
  );
