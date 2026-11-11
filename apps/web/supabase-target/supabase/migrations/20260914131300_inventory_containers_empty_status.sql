ALTER TABLE public.inventory_containers DROP CONSTRAINT inventory_containers_status_check;
ALTER TABLE public.inventory_containers ADD CONSTRAINT inventory_containers_status_check
  CHECK (status = ANY (ARRAY['active'::text, 'sealed'::text, 'in_transit'::text, 'archived'::text, 'empty'::text]));
